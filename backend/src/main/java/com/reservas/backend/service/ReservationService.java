package com.reservas.backend.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.scheduling.annotation.Scheduled;
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

    // ... (Búsquedas) ...
    public List<Reservation> findAllReservations() { return reservationRepository.findAll(); }
    public Optional<Reservation> findReservationById(UUID id) { return reservationRepository.findById(id); }
    public List<Reservation> findReservationsByCourtAndDate(UUID courtId, LocalDate date) { return reservationRepository.findByCourtIdAndDate(courtId, date); }
    public List<Reservation> findReservationsByUser(User user) { return reservationRepository.findByUser(user); }

    @Transactional
    public Reservation attemptReservation(Court court, User user, LocalDate date, LocalTime startTime, LocalTime endTime) {
        ZoneId zoneES = ZoneId.of("America/El_Salvador");
        LocalDate today = LocalDate.now(zoneES);
        LocalTime now = LocalTime.now(zoneES);

        if (date.isBefore(today)) throw new IllegalArgumentException("La fecha seleccionada ya pasó.");
        if (date.isEqual(today) && startTime.isBefore(now)) throw new IllegalArgumentException("La hora de inicio debe ser posterior a la actual.");
        if (!startTime.isBefore(endTime)) throw new IllegalArgumentException("La hora de inicio debe ser menor que la hora de fin.");
        if (Duration.between(startTime, endTime).toMinutes() < 60) throw new IllegalArgumentException("La duración mínima de una reserva es de 1 hora.");
        
        List<Reservation> overlapping = reservationRepository.findOverlappingReservationsWithLock(court.getId(), date, startTime, endTime)
                .stream().filter(r -> List.of("PENDING", "CONFIRMED", "REACTIVATED").contains(r.getStatus())).toList();

        if (!overlapping.isEmpty()) {
            Reservation conflict = overlapping.get(0);
            throw new IllegalStateException(String.format("Ya existe una reserva activa desde %s hasta %s.", conflict.getStartTime(), conflict.getEndTime()));
        }

        Reservation newReservation = new Reservation(date, startTime, endTime, user, court);
        newReservation.setStatus("PENDING");
        newReservation.setCode(UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        
        return reservationRepository.save(newReservation);
    }

    @Transactional
    public Reservation saveReservation(Reservation reservation) {
        return reservationRepository.save(reservation);
    }

    // 💡 CAMBIO: Notificación al modificar fecha/hora
    @Transactional
    public Reservation updateReservation(Reservation reservation) {
        List<Reservation> conflicts = reservationRepository.findActiveOverlappingReservationsOrdered(
                reservation.getCourt().getId(), reservation.getDate(), reservation.getStartTime(), reservation.getEndTime()
        ).stream().filter(r -> !r.getId().equals(reservation.getId())).toList();

        if (!conflicts.isEmpty()) {
            Reservation conflict = conflicts.get(0);
            throw new IllegalStateException(String.format("Conflicto de horario: desde %s hasta %s.", conflict.getStartTime(), conflict.getEndTime()));
        }
        
        Reservation saved = reservationRepository.save(reservation);

        if (saved.getUser() != null) {
            notificationService.notifyUser(
                saved.getUser().getId().toString(),
                new notificationService.NotificationPayload(
                    "Tu reserva " + saved.getCode() + " ha sido modificada por el administrador.",
                    "info",
                    saved.getId().toString(),
                    5000
                )
            );
        }
        return saved;
    }

    @Transactional
    public Reservation reactivateReservation(UUID reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva no encontrada."));

        if (!"CANCELLED".equalsIgnoreCase(reservation.getStatus()) && !"FINISHED".equalsIgnoreCase(reservation.getStatus())) {
            throw new IllegalStateException("Solo se pueden reactivar reservas canceladas o finalizadas.");
        }

        boolean overlapExists = reservationRepository.existsOverlappingReservationExcludingId(
                reservation.getCourt().getId(), reservation.getDate(), reservation.getStartTime(), reservation.getEndTime(), reservation.getId()
        );
        if (overlapExists) throw new IllegalStateException("Existe un conflicto de horario con otra reserva en esta cancha.");

        reservation.setCreatedAt(LocalDateTime.now(ZoneId.of("America/El_Salvador")));
        reservation.setStatus("REACTIVATED");
        
        Reservation updated = reservationRepository.save(reservation);
        
        notificationService.notifyUser(
                updated.getUser().getId().toString(),
                new notificationService.NotificationPayload(
                        String.format("Tu reserva %s ha sido reactivada.", updated.getCode()),
                        "warning", updated.getId().toString(), 5000
                )
        );
        return updated;
    }

    @Transactional
    public List<Map<String, Object>> reactivateReservationsBulk(List<UUID> reservationIds) {
        List<Map<String, Object>> results = new ArrayList<>();
        for (UUID id : reservationIds) {
            try {
                reactivateReservation(id);
                results.add(Map.of("id", id, "status", "success"));
            } catch (Exception e) {
                results.add(Map.of("id", id, "status", "error", "message", e.getMessage()));
            }
        }
        return results;
    }

    @Scheduled(fixedRate = 30000) 
    @Transactional
    public void autoCancelExpiredReservations() {
        ZoneId zoneES = ZoneId.of("America/El_Salvador");
        LocalDateTime now = LocalDateTime.now(zoneES);

        reservationRepository.findAll().stream()
            .filter(r -> "PENDING".equalsIgnoreCase(r.getStatus()) || "REACTIVATED".equalsIgnoreCase(r.getStatus()))
            .filter(r -> {
                LocalDateTime created = r.getCreatedAt() != null ? r.getCreatedAt() : now;
                return Duration.between(created, now).toMinutes() >= 3;
            })
            .forEach(r -> {
                r.setStatus("CANCELLED");
                reservationRepository.save(r);
                notificationService.notifyUser(r.getUser().getId().toString(), new notificationService.NotificationPayload(
                    String.format("Tu reserva %s ha expirado.", r.getCode()), "error", r.getId().toString(), 5000
                ));
            });
            
        reservationRepository.findAll().stream()
            .filter(r -> ("PENDING".equalsIgnoreCase(r.getStatus()) || "REACTIVATED".equalsIgnoreCase(r.getStatus())) && LocalDateTime.of(r.getDate(), r.getEndTime()).isBefore(now))
            .forEach(r -> {
                r.setStatus("FINISHED");
                reservationRepository.save(r);
            });
    }

    @Transactional
    public void cancelReservation(UUID reservationId) {
        reservationRepository.findById(reservationId).ifPresent(res -> {
            if (!"CANCELLED".equalsIgnoreCase(res.getStatus())) {
                res.setStatus("CANCELLED");
                reservationRepository.save(res);
                notificationService.notifyUser(res.getUser().getId().toString(), new notificationService.NotificationPayload(
                        String.format("Tu reserva %s ha sido cancelada.", res.getCode()), "error", res.getId().toString(), 4000
                ));
            }
        });
    }

    @Transactional
    public void deleteReservationSafe(UUID id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada"));

        // CASO 1: Si está FINALIZADA
        if ("FINISHED".equalsIgnoreCase(reservation.getStatus())) {
            // Verificamos si tiene factura/pago asociado
            boolean hasInvoice = paymentRepository.existsByReservation(reservation);
            
            if (hasInvoice) {
                throw new IllegalStateException("No se puede eliminar una reserva finalizada que tiene factura generada.");
            }
            // Si no tiene factura (hasInvoice == false), permitimos borrar.
        } 
        // CASO 2: Si NO es finalizada, debe ser CANCELLED para poder borrarse
        else if (!"CANCELLED".equalsIgnoreCase(reservation.getStatus())) {
             throw new IllegalStateException("Solo se pueden eliminar reservas canceladas o finalizadas sin factura.");
        }

        // Procedemos a eliminar
        // (Aunque no debería tener pago si pasó la validación, esto limpia registros huérfanos si existieran)
        paymentRepository.deleteByReservation(reservation);
        reservationRepository.delete(reservation);
    }

}