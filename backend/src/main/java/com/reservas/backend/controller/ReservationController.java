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
import com.reservas.backend.repository.ReservationRepository;

@Service
public class ReservationController {

    private final ReservationRepository reservationRepository;

    public ReservationController(ReservationRepository reservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    /** Obtiene todas las reservas y actualiza estados automáticamente */
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

    /** Intenta crear una nueva reserva validando conflictos y fechas */
    public Reservation attemptReservation(Court court, User user, LocalDate date,
                                          LocalTime startTime, LocalTime endTime) {
        if (date.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha no puede ser anterior al día de hoy.");
        }
        if (!startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("La hora de inicio debe ser menor que la hora de fin.");
        }

        boolean overlapExists = reservationRepository.existsOverlappingReservation(
                court.getId(), date, startTime, endTime
        );

        if (overlapExists) {
            throw new IllegalStateException("Ya existe una reserva en ese horario.");
        }

        Reservation newReservation = new Reservation(date, startTime, endTime, user, court);

        // Estado inicial según fecha/hora
        if (LocalDateTime.of(date, startTime).isAfter(LocalDateTime.now())) {
            newReservation.setStatus("PENDING");
        } else {
            newReservation.setStatus("CONFIRMED");
        }

        return reservationRepository.save(newReservation);
    }

    /** Guarda reserva existente validando conflictos */
    public Reservation saveReservation(Reservation reservation) {
        boolean overlapExists = reservationRepository.existsOverlappingReservation(
                reservation.getCourt().getId(),
                reservation.getDate(),
                reservation.getStartTime(),
                reservation.getEndTime()
        );

        if (overlapExists) {
            throw new IllegalStateException("El horario seleccionado entra en conflicto con otra reserva.");
        }

        return reservationRepository.save(reservation);
    }

    /** Cancela reserva (cambiar estado a CANCELLED) */
    public void cancelReservation(UUID reservationId) {
        Optional<Reservation> reservation = reservationRepository.findById(reservationId);
        reservation.ifPresent(res -> {
            res.setStatus("CANCELLED");
            reservationRepository.save(res);
        });
    }

    /** Elimina físicamente la reserva */
    public void deleteReservation(UUID reservationId) {
        reservationRepository.deleteById(reservationId);
    }

    public List<Reservation> findReservationsByUser(User user) {
        return reservationRepository.findByUser(user);
    }
}
