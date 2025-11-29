package com.reservas.backend.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.reservas.backend.model.Reservation;
import com.reservas.backend.model.User;

import jakarta.persistence.LockModeType;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, UUID> {

    // -------------------------
    // Búsquedas básicas
    // -------------------------
    List<Reservation> findByUser(User user);
    
    List<Reservation> findByCourtIdAndDate(UUID courtId, LocalDate date);
    List<Reservation> findByUserId(Long userId);
    boolean existsByUserAndStatus(User user, String status);
    boolean existsByCode(String code);

    // -------------------------
    // Solapamiento de reservas
    // -------------------------

    // Lista de reservas que se solapan (para validación)
    @Query("""
        SELECT r FROM Reservation r
        WHERE r.court.id = :courtId
          AND r.date = :date
          AND r.status != 'CANCELLED'
          AND r.startTime < :endTime
          AND r.endTime > :startTime
    """)
    List<Reservation> findOverlappingReservations(
        @Param("courtId") UUID courtId,
        @Param("date") LocalDate date,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime
    );

    // -------------------------
    // Devuelve las reservas activas que se solapan, ordenadas por hora de inicio
    // -------------------------
    @Query("""
        SELECT r FROM Reservation r
        WHERE r.court.id = :courtId
        AND r.date = :date
        AND r.status IN ('PENDING', 'CONFIRMED', 'REACTIVATED')
        AND r.startTime < :endTime
        AND r.endTime > :startTime
        ORDER BY r.startTime ASC
    """)
    List<Reservation> findActiveOverlappingReservationsOrdered(
        @Param("courtId") UUID courtId,
        @Param("date") LocalDate date,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime
    );


    // Verifica si existe solapamiento (booleano)
    @Query("""
        SELECT CASE WHEN COUNT(r) > 0 THEN TRUE ELSE FALSE END
        FROM Reservation r
        WHERE r.court.id = :courtId
          AND r.date = :date
          AND r.status != 'CANCELLED'
          AND r.startTime < :endTime
          AND r.endTime > :startTime
    """)
    boolean existsOverlappingReservation(
        @Param("courtId") UUID courtId,
        @Param("date") LocalDate date,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime
    );

    // Verifica solapamiento excluyendo la reserva actual
    @Query("""
        SELECT CASE WHEN COUNT(r) > 0 THEN TRUE ELSE FALSE END
        FROM Reservation r
        WHERE r.court.id = :courtId
          AND r.date = :date
          AND r.id <> :excludedId
          AND r.status != 'CANCELLED'
          AND r.startTime < :endTime
          AND r.endTime > :startTime
    """)
    boolean existsOverlappingReservationExcludingId(
        @Param("courtId") UUID courtId,
        @Param("date") LocalDate date,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime,
        @Param("excludedId") UUID excludedId
    );

    // -------------------------
    // Bloqueo pesimista para evitar que dos usuarios reserven al mismo tiempo
    // -------------------------
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT r FROM Reservation r
        WHERE r.court.id = :courtId
          AND r.date = :date
          AND r.status != 'CANCELLED'
          AND r.startTime < :endTime
          AND r.endTime > :startTime
    """)
    List<Reservation> findOverlappingReservationsWithLock(
        @Param("courtId") UUID courtId,
        @Param("date") LocalDate date,
        @Param("startTime") LocalTime startTime,
        @Param("endTime") LocalTime endTime
    );

}
