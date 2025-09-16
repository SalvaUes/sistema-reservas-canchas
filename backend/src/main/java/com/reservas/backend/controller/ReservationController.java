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

    public List<Reservation> findAllReservations() {
        // Actualiza estados automáticamente
        List<Reservation> reservations = reservationRepository.findAll();
        LocalDateTime now = LocalDateTime.now();
        for (Reservation r : reservations) {
            if (r.getStatus().equals("PENDING") &&
                LocalDateTime.of(r.getDate(), r.getEndTime()).isBefore(now)) {
                r.setStatus("FINISHED");
                reservationRepository.save(r);
            }
        }
        return reservations;
    }

    public Optional<Reservation> findReservationById(Long id) {
        return reservationRepository.findById(id);
    }

    public List<Reservation> findReservationsByCourtAndDate(UUID courtId, LocalDate date) {
        return reservationRepository.findByCourtIdAndDate(courtId, date);
    }

    public Reservation attemptReservation(Court court, User user, LocalDate date, LocalTime startTime, LocalTime endTime) {

        // Validación: fecha no puede ser anterior al día de hoy
        if (date.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha no puede ser anterior al día de hoy.");
        }

        // Validación: hora de inicio menor que hora de fin
        if (!startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("La hora de inicio debe ser menor que la hora de fin.");
        }

        // Validación: solapamiento de reservas
        boolean overlapExists = reservationRepository.existsOverlappingReservation(
                court.getId(), date, startTime, endTime
        );

        if (overlapExists) {
            throw new IllegalStateException("Ya existe una reserva en ese horario.");
        }

        // Crear reserva
        Reservation newReservation = new Reservation(date, startTime, endTime, user, court);

        // Estado inicial según fecha/hora
        if (LocalDateTime.of(date, startTime).isAfter(LocalDateTime.now())) {
            newReservation.setStatus("PENDING");
        } else {
            newReservation.setStatus("CONFIRMED");
        }

        return reservationRepository.save(newReservation);
    }


    public Reservation saveReservation(Reservation reservation) {
        // Validación de solapamiento al editar
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

    // Agrega este método para cancelar reservas
    public void cancelReservation(Long reservationId) {
        Optional<Reservation> reservation = reservationRepository.findById(reservationId);
        reservation.ifPresent(res -> {
            res.setStatus("CANCELLED");
            reservationRepository.save(res);
        });
    }

    // eliminar físicamente la reserva
    public void deleteReservation(Long reservationId) {
        reservationRepository.deleteById(reservationId);
    }

    public List<Reservation> findReservationsByUser(User user) {
        return reservationRepository.findByUser(user);
    }


}
