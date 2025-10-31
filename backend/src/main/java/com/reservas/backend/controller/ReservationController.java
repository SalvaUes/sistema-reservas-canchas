package com.reservas.backend.controller;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.reservas.backend.model.Court;
import com.reservas.backend.model.Reservation;
import com.reservas.backend.model.User;
import com.reservas.backend.repository.PaymentRepository;
import com.reservas.backend.repository.ReservationRepository;

import jakarta.transaction.Transactional;

@Service
public class ReservationController {

    private final ReservationRepository reservationRepository;
    private final PaymentRepository paymentRepository;

    public ReservationController(ReservationRepository reservationRepository,
                                 PaymentRepository paymentRepository) {
        this.reservationRepository = reservationRepository;
        this.paymentRepository = paymentRepository;
    }

    /**
     * Obtiene todas las reservas y actualiza estados automáticamente.
     * Solo marca como FINISHED las que ya pasaron; no confirma reservas automáticamente.
     */
    public List<Reservation> findAllReservations() {
        List<Reservation> reservations = reservationRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        for (Reservation r : reservations) {
            if ("PENDING".equals(r.getStatus()) &&
                LocalDateTime.of(r.getDate(), r.getEndTime()).isBefore(now)) {
                r.setStatus("FINISHED");
                reservationRepository.save(r);
            }
        }
        return reservations;
    }

    public Optional<Reservation> findReservationById(UUID id) {
        return reservationRepository.findById(id);
    }

    public List<Reservation> findReservationsByCourtAndDate(UUID courtId, LocalDate date) {
        return reservationRepository.findByCourtIdAndDate(courtId, date);
    }

    /**
     * Intenta crear una nueva reserva validando conflictos y fechas.
     * Todas las reservas nuevas inician en estado PENDING y requieren confirmación manual (por pago).
     */
    public Reservation attemptReservation(Court court, User user, LocalDate date,
                                          LocalTime startTime, LocalTime endTime) {

        // Validar fecha
        if (date.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha no puede ser anterior al día de hoy.");
        }

        // Validar horas
        if (!startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("La hora de inicio debe ser menor que la hora de fin.");
        }

        // Validar anticipación mínima de 10 minutos
        LocalDateTime reservationStart = LocalDateTime.of(date, startTime);
        LocalDateTime now = LocalDateTime.now();
        if (reservationStart.isBefore(now.plusMinutes(10))) {
            throw new IllegalArgumentException("Debes reservar con al menos 10 minutos de anticipación.");
        }

        // Validar conflictos con otras reservas
        boolean overlapExists = reservationRepository.existsOverlappingReservation(
                court.getId(), date, startTime, endTime
        );

        if (overlapExists) {
            throw new IllegalStateException("Ya existe una reserva en ese horario.");
        }

        // Validar duración mínima de 1 hora
        LocalDateTime reservationEnd = LocalDateTime.of(date, endTime);
        long durationMinutes = java.time.Duration.between(reservationStart, reservationEnd).toMinutes();
        if (durationMinutes < 60) {
            throw new IllegalArgumentException("La duración mínima de la reserva es de 1 hora.");
        }

        // Crear nueva reserva
        Reservation newReservation = new Reservation(date, startTime, endTime, user, court);
        newReservation.setStatus("PENDING");

        return reservationRepository.save(newReservation);
    }

    /**
     * Guarda o actualiza una reserva existente validando conflictos (excluyendo a sí misma).
     */
    public Reservation saveReservation(Reservation reservation) {
        boolean overlapExists;

        if (reservation.getId() != null) {
            // 🔹 Editar: excluir la misma reserva del chequeo
            overlapExists = reservationRepository.existsOverlappingReservationExcludingId(
                    reservation.getCourt().getId(),
                    reservation.getDate(),
                    reservation.getStartTime(),
                    reservation.getEndTime(),
                    reservation.getId()
            );
        } else {
            // 🔹 Crear nueva: validación normal
            overlapExists = reservationRepository.existsOverlappingReservation(
                    reservation.getCourt().getId(),
                    reservation.getDate(),
                    reservation.getStartTime(),
                    reservation.getEndTime()
            );
        }

        if (overlapExists) {
            throw new IllegalStateException("El horario seleccionado entra en conflicto con otra reserva.");
        }

        return reservationRepository.save(reservation);
    }

    /** Cancela una reserva (cambia el estado a CANCELLED) */
    public void cancelReservation(UUID reservationId) {
        Optional<Reservation> reservation = reservationRepository.findById(reservationId);
        reservation.ifPresent(res -> {
            res.setStatus("CANCELLED");
            reservationRepository.save(res);
        });
    }

    /** Obtiene todas las reservas asociadas a un usuario */
    public List<Reservation> findReservationsByUser(User user) {
        return reservationRepository.findByUser(user);
    }

    @Transactional
    public void deleteReservationSafe(UUID id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada"));

        paymentRepository.deleteByReservation(reservation);

        reservationRepository.delete(reservation);
    }



}
