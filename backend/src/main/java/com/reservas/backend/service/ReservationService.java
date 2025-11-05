package com.reservas.backend.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final PaymentRepository paymentRepository;
    private final notificationService notificationService;

    public ReservationService(
            ReservationRepository reservationRepository,
            PaymentRepository paymentRepository,
            notificationService notificationService) {

        this.reservationRepository = reservationRepository;
        this.paymentRepository = paymentRepository;
        this.notificationService = notificationService;
    }

    // ---------------------------------------------------
    // MÉTODOS PRINCIPALES
    // ---------------------------------------------------

    /** Obtiene todas las reservas y actualiza automáticamente las vencidas */
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

    public List<Reservation> findReservationsByUser(User user) {
        return reservationRepository.findByUser(user);
    }

    // ---------------------------------------------------
    // CREACIÓN Y VALIDACIÓN DE RESERVAS
    // ---------------------------------------------------

    /**
     * Crea una nueva reserva validando anticipación, duración mínima y conflictos.
     * Garantiza que no haya más de una reserva al mismo tiempo en la misma cancha.
     */
    @Transactional
    public Reservation attemptReservation(Court court, User user, LocalDate date, LocalTime startTime, LocalTime endTime) {

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = LocalDateTime.of(date, startTime);
        LocalDateTime end = LocalDateTime.of(date, endTime);

        // Validaciones básicas
        if (date.isBefore(LocalDate.now()))
            throw new IllegalArgumentException("La fecha seleccionada ya pasó.");

        if (date.isEqual(LocalDate.now()) && startTime.isBefore(LocalTime.now()))
            throw new IllegalArgumentException("La hora de inicio debe ser posterior a la actual.");

        if (!startTime.isBefore(endTime))
            throw new IllegalArgumentException("La hora de inicio debe ser menor que la hora de fin.");

        if (start.isBefore(now.plusMinutes(10)))
            throw new IllegalArgumentException("Reserva con al menos 10 minutos de anticipación.");

        long duration = Duration.between(start, end).toMinutes();
        if (duration < 60)
            throw new IllegalArgumentException("La duración mínima de una reserva es 1 hora.");

        // Bloqueo pesimista para evitar doble reserva simultánea
        boolean overlapExists = !reservationRepository.findOverlappingReservationsWithLock(
                court.getId(), date, startTime, endTime
        ).isEmpty();

        if (overlapExists) {
            throw new IllegalStateException("La cancha ya tiene una reserva en este horario. Intenta otro horario.");
        }

        // Crear la reserva
        Reservation newReservation = new Reservation(date, startTime, endTime, user, court);
        newReservation.setStatus("PENDING");

        return reservationRepository.save(newReservation);
    }

    /**
     * Guarda o actualiza una reserva validando solapamientos.
     * Garantiza exclusividad de horario en la misma cancha.
     */
    @Transactional
    public Reservation saveReservation(Reservation reservation) {
        boolean overlapExists;

        if (reservation.getId() != null) {
            // Validación de actualización
            overlapExists = !reservationRepository.findOverlappingReservationsWithLock(
                    reservation.getCourt().getId(),
                    reservation.getDate(),
                    reservation.getStartTime(),
                    reservation.getEndTime()
            ).stream()
            .filter(r -> !r.getId().equals(reservation.getId()))
            .toList()
            .isEmpty();
        } else {
            // Validación de nueva reserva
            overlapExists = !reservationRepository.findOverlappingReservationsWithLock(
                    reservation.getCourt().getId(),
                    reservation.getDate(),
                    reservation.getStartTime(),
                    reservation.getEndTime()
            ).isEmpty();
        }

        if (overlapExists) {
            throw new IllegalStateException("La cancha ya tiene una reserva en este horario. Intenta otro horario.");
        }

        return reservationRepository.save(reservation);
    }

    @Transactional
    public Reservation updateReservationUser(UUID reservationId, User newUser) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva no encontrada."));

        if (newUser == null) {
            throw new IllegalArgumentException("Usuario no válido.");
        }

        reservation.setUser(newUser);
        Reservation updated = reservationRepository.save(reservation);

        // Notificar al usuario asignado
        notificationService.notifyUser(
                newUser.getId().toString(),
                new notificationService.NotificationPayload(
                        String.format("Tu reserva %s fue asignada a tu cuenta.", reservation.getCode()),
                        "info",
                        reservation.getId().toString(),
                        4000
                )
        );

        return updated;
    }

    @Transactional
    public Reservation updateReservation(Reservation reservation) {
        // Validar conflictos de horario
        boolean overlapExists = reservationRepository.existsOverlappingReservationExcludingId(
                reservation.getCourt().getId(),
                reservation.getDate(),
                reservation.getStartTime(),
                reservation.getEndTime(),
                reservation.getId()
        );

        if (overlapExists) {
            throw new IllegalStateException("La cancha ya tiene una reserva en este horario. Intenta otro horario.");
        }

        // Guardar cambios
        Reservation updated = reservationRepository.save(reservation);

        // Notificar cambios al usuario
        notifyReservationEdited(updated);

        return updated;
    }

    /** Método centralizado para notificar edición de reserva */
    @Transactional
    public void notifyReservationEdited(Reservation reservation) {
        if (reservation == null || reservation.getUser() == null) return;

        notificationService.notifyUser(
                reservation.getUser().getId().toString(),
                new notificationService.NotificationPayload(
                        String.format("Tu reserva %s fue modificada.", reservation.getCode()),
                        "info",
                        reservation.getId().toString(),
                        4000
                )
        );
    }

    // ---------------------------------------------------
    // CANCELACIÓN AUTOMÁTICA (POR TIEMPO O BACKEND)
    // ---------------------------------------------------

    @Transactional
    public void cancelReservation(UUID reservationId) {
        reservationRepository.findById(reservationId).ifPresent(res -> {
            if (!"CANCELLED".equalsIgnoreCase(res.getStatus())) {
                res.setStatus("CANCELLED");
                reservationRepository.save(res);

                notificationService.notifyUser(
                        res.getUser().getId().toString(),
                        new notificationService.NotificationPayload(
                                String.format("Tu reserva %s ha sido cancelada.", res.getCode()),
                                "error",
                                res.getId().toString(),
                                4000
                        )
                );
            }
        });
    }

    // ---------------------------------------------------
    // CIERRE AUTOMÁTICO DE RESERVAS PENDIENTES FINALIZADAS
    // ---------------------------------------------------

    @Transactional
    public void closePendingReservations() {
        LocalDateTime now = LocalDateTime.now();

        reservationRepository.findAll().stream()
                .filter(r -> "PENDING".equalsIgnoreCase(r.getStatus()) || "REACTIVATED".equalsIgnoreCase(r.getStatus()))
                .filter(r -> LocalDateTime.of(r.getDate(), r.getEndTime()).isBefore(now))
                .forEach(r -> {
                    r.setStatus("FINISHED");
                    reservationRepository.save(r);

                    notificationService.notifyUser(
                            r.getUser().getId().toString(),
                            new notificationService.NotificationPayload(
                                    String.format("Tu reserva %s ha expirado automáticamente.", r.getCode()),
                                    "error",
                                    r.getId().toString(),
                                    4000
                            )
                    );
                });
    }

    // ---------------------------------------------------
    // ELIMINACIÓN Y CIERRE
    // ---------------------------------------------------

    /** Elimina una reserva y sus pagos asociados */
    @Transactional
    public void deleteReservationSafe(UUID id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada"));

        paymentRepository.deleteByReservation(reservation);
        reservationRepository.delete(reservation);
    }

    /** Cierra automáticamente las reservas del día que ya terminaron */
    @Transactional
    public void closeLocalReservations() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        List<Reservation> toClose = reservationRepository.findAll().stream()
                .filter(r -> r.getDate().isEqual(today))
                .filter(r -> r.getEndTime().isBefore(now))
                .filter(r -> !"CANCELLED".equalsIgnoreCase(r.getStatus()))
                .filter(r -> !"COMPLETED".equalsIgnoreCase(r.getStatus()))
                .toList();

        toClose.forEach(r -> r.setStatus("COMPLETED"));
        reservationRepository.saveAll(toClose);
    }

    // ---------------------------------------------------
    // REACTIVACIÓN
    // ---------------------------------------------------

    @Transactional
    public Reservation reactivateReservation(UUID reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva no encontrada."));

        if (!"CANCELLED".equalsIgnoreCase(reservation.getStatus()) &&
            !"FINISHED".equalsIgnoreCase(reservation.getStatus())) {
            throw new IllegalStateException("Solo se pueden reactivar reservas canceladas o finalizadas.");
        }

        // Verificar que el usuario no tenga otra reserva activa
        boolean userHasActive = reservationRepository.findByUser(reservation.getUser()).stream()
                .anyMatch(r -> !r.getId().equals(reservation.getId()) &&
                        ("PENDING".equalsIgnoreCase(r.getStatus()) ||
                        "REACTIVATED".equalsIgnoreCase(r.getStatus())));
        if (userHasActive) {
            throw new IllegalStateException("El usuario ya tiene una reserva activa.");
        }

        // Verificar conflictos de horario
        boolean overlapExists = reservationRepository.existsOverlappingReservationExcludingId(
                reservation.getCourt().getId(),
                reservation.getDate(),
                reservation.getStartTime(),
                reservation.getEndTime(),
                reservation.getId()
        );
        if (overlapExists) {
            throw new IllegalStateException("Existe un conflicto de horario con otra reserva en esta cancha.");
        }

        // Cambiar estado y guardar
        reservation.setStatus("REACTIVATED");
        Reservation updated = reservationRepository.save(reservation);
        reservationRepository.flush(); // Asegura que los cambios se persistan antes de notificar

        // Cargar explícitamente el usuario
        User user = updated.getUser();
        user.getId(); // fuerza carga si es lazy

        // Enviar notificación
        notificationService.notifyUser(
                user.getId().toString(),
                new notificationService.NotificationPayload(
                        String.format("Tu reserva %s ha sido reactivada.", updated.getCode()),
                        "warning",
                        updated.getId().toString(),
                        5000
                )
        );

        return updated;
    }


    // ---------------------------------------------------
    // REACTIVACIÓN MASIVA DE RESERVAS
    // ---------------------------------------------------

    /**
     * Reactiva varias reservas a la vez.
     * Devuelve un resultado por cada reserva con status y mensaje.
     */
    @Transactional
    public List<Map<String, Object>> reactivateReservationsBulk(List<UUID> reservationIds) {
        List<Map<String, Object>> results = new ArrayList<>();

        for (UUID id : reservationIds) {
            try {
                Reservation updated = reactivateReservation(id);
                results.add(Map.of(
                        "id", updated.getId(),
                        "code", updated.getCode(),
                        "status", "success",
                        "message", "Reactivada correctamente"
                ));
            } catch (IllegalArgumentException | IllegalStateException e) {
                results.add(Map.of(
                        "id", id,
                        "status", "error",
                        "message", e.getMessage()
                ));
            } catch (Exception e) {
                results.add(Map.of(
                        "id", id,
                        "status", "error",
                        "message", "Error inesperado al reactivar la reserva."
                ));
            }
        }

        return results;
    }


}
