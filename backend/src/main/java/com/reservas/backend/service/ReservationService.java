package com.reservas.backend.service;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.reservas.backend.model.Reservation;
import com.reservas.backend.repository.ReservationRepository;

@Service
public class ReservationService {

    private final ReservationRepository reservationRepository;

    public ReservationService(ReservationRepository reservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    /** Guarda la reserva asegurando un código único */
    public Reservation saveReservation(Reservation reservation) {
        // Generar UUID si es nulo
        if (reservation.getId() == null) {
            reservation.setId(UUID.randomUUID());
        }

        // Generar código único si es null o vacío
        if (reservation.getCode() == null || reservation.getCode().isBlank()) {
            String code;
            do {
                code = "R-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            } while (reservationRepository.existsByCode(code));
            reservation.setCode(code);
        }

        return reservationRepository.save(reservation);
    }

    public Optional<Reservation> findById(UUID id) {
        return reservationRepository.findById(id);
    }

    public void deleteById(UUID id) {
        reservationRepository.deleteById(id);
    }
}
