package com.reservas.backend.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.reservas.backend.model.Reservation;
import com.reservas.backend.model.User;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByCourtIdAndDate(UUID courtId, LocalDate date);

    List<Reservation> findByUserId(Long userId);

    List<Reservation> findByUser(User user);

    @Query("SELECT COUNT(r) > 0 FROM Reservation r " +
           "WHERE r.court.id = :courtId " +
           "AND r.date = :date " +
           "AND r.status != 'CANCELLED' " +
           "AND (:startTime < r.endTime AND :endTime > r.startTime)")
    boolean existsOverlappingReservation(@Param("courtId") UUID courtId,
                                        @Param("date") LocalDate date,
                                        @Param("startTime") LocalTime startTime,
                                        @Param("endTime") LocalTime endTime);

    // <-- Este es el método que te faltaba
    boolean existsByUserAndStatus(User user, String status);
}
