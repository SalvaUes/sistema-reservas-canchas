package com.reservas.backend.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.reservas.backend.model.Payment;
import com.reservas.backend.model.Reservation;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByReservationId(UUID reservationId);
    
    @Modifying
    @Query("DELETE FROM Payment p WHERE p.reservation = :reservation")
    void deleteByReservation(@Param("reservation") Reservation reservation);

}



