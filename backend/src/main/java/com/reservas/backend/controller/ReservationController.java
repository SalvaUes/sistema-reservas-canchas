package com.reservas.backend.controller;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.reservas.backend.dto.ReservationDTO;
import com.reservas.backend.dto.ReservationRequest;
import com.reservas.backend.dto.ReservationUserUpdateDTO;
import com.reservas.backend.model.Court;
import com.reservas.backend.model.Reservation;
import com.reservas.backend.model.User;
import com.reservas.backend.repository.UserRepository;
import com.reservas.backend.service.ReservationService;

@RestController
@RequestMapping("/api/reservations")
@CrossOrigin(origins = "http://localhost:4200")
public class ReservationController {

    private final ReservationService reservationService;
    private final CourtController courtService;
    private final UserRepository userRepository;

    public ReservationController(ReservationService reservationService,
                                 CourtController courtService,
                                 UserRepository userRepository) {
        this.reservationService = reservationService;
        this.courtService = courtService;
        this.userRepository = userRepository;
    }

    // Obtener todas las reservas
    @GetMapping
    public List<ReservationDTO> getAllReservations() {
        return reservationService.findAllReservations()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // Obtener una reserva por ID
    @GetMapping("/{id}")
    public ResponseEntity<ReservationDTO> getReservationById(@PathVariable UUID id) {
        return reservationService.findReservationById(id)
                .map(res -> ResponseEntity.ok(toDTO(res)))
                .orElse(ResponseEntity.notFound().build());
    }

    // Obtener reservas por cancha y fecha
    @GetMapping("/court/{courtId}")
    public List<ReservationDTO> getReservationsByCourtAndDate(
            @PathVariable UUID courtId,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        return reservationService.findReservationsByCourtAndDate(courtId, date)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ReservationDTO> reactivateReservation(@PathVariable UUID id) {
        Optional<Reservation> existing = reservationService.findReservationById(id);
        if (existing.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }

        try {
            Reservation updated = reservationService.reactivateReservation(id);
            // Convertir a DTO plano para evitar referencias circulares
            ReservationDTO dto = toDTO(updated);
            return ResponseEntity.ok(dto);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(null);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(null);
        }
    }


    // Reactivación masiva
    @PatchMapping("/reactivate-bulk")
    public ResponseEntity<List<Map<String, Object>>> reactivateReservationsBulk(
            @RequestBody List<UUID> reservationIds) {

        if (reservationIds == null || reservationIds.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(List.of(Map.of("status", "error", "message", "No se proporcionaron IDs de reservas.")));
        }

        List<Map<String, Object>> results = reservationService.reactivateReservationsBulk(reservationIds);
        // Cada reactivación dentro del service envía notificación en tiempo real
        return ResponseEntity.ok(results);
    }

    // Obtener estado + info de la reserva para polling
    @GetMapping("/{id}/status")
    public ResponseEntity<Map<String, String>> getReservationStatus(@PathVariable UUID id) {
        Optional<Reservation> resOpt = reservationService.findReservationById(id);
        if (resOpt.isEmpty()) return ResponseEntity.notFound().build();

        Reservation res = resOpt.get();
        return ResponseEntity.ok(Map.of(
                "status", res.getStatus(),
                "courtName", res.getCourt().getName(),
                "startTime", res.getStartTime().toString(),
                "endTime", res.getEndTime().toString()
        ));
    }

    // Crear reserva
    @PostMapping
    public ResponseEntity<Object> createReservation(@RequestBody ReservationRequest request) {
        Optional<Court> courtOpt = courtService.findCourtById(request.getCourtId());
        Optional<User> userOpt = userRepository.findById(request.getUserId());

        if (courtOpt.isEmpty() || userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("Usuario o cancha no encontrados.");
        }

        try {
            Reservation newReservation = reservationService.attemptReservation(
                    courtOpt.get(), userOpt.get(),
                    request.getDate(), request.getStartTime(), request.getEndTime()
            );

            URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                    .path("/{id}")
                    .buildAndExpand(newReservation.getId())
                    .toUri();

            return ResponseEntity.created(location).body(toDTO(newReservation));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Editar reserva completa
    @PutMapping("/{id}")
    public ResponseEntity<ReservationDTO> updateReservation(@PathVariable UUID id,
                                                            @RequestBody ReservationRequest request) {
        Optional<Reservation> existingOpt = reservationService.findReservationById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();

        Reservation reservation = existingOpt.get();

        if (request.getCourtId() != null) {
            Optional<Court> court = courtService.findCourtById(request.getCourtId());
            if (court.isEmpty()) return ResponseEntity.badRequest().build();
            reservation.setCourt(court.get());
        }

        if (request.getUserId() != null) {
            Optional<User> user = userRepository.findById(request.getUserId());
            if (user.isEmpty()) return ResponseEntity.badRequest().build();
            reservation.setUser(user.get());
        }

        if (request.getDate() != null) reservation.setDate(request.getDate());
        if (request.getStartTime() != null) reservation.setStartTime(request.getStartTime());
        if (request.getEndTime() != null) reservation.setEndTime(request.getEndTime());
        if (request.getStatus() != null) reservation.setStatus(request.getStatus());

        try {
            // Usar el método del service que valida + notifica
            Reservation updated = reservationService.updateReservation(reservation);
            return ResponseEntity.ok(toDTO(updated));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    // Actualizar solo el estado
    @PatchMapping("/{id}/status")
    public ResponseEntity<ReservationDTO> updateReservationStatus(
            @PathVariable UUID id, @RequestBody String newStatus) {
        Optional<Reservation> existingOpt = reservationService.findReservationById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();

        Reservation reservation = existingOpt.get();
        String upperStatus = newStatus.trim().toUpperCase();

        List<String> allowedStatuses = List.of("PENDING", "CONFIRMED", "CANCELLED", "FINISHED", "REACTIVATED");
        if (!allowedStatuses.contains(upperStatus)) return ResponseEntity.badRequest().build();

        if ("CANCELLED".equalsIgnoreCase(upperStatus)) {
            reservationService.cancelReservation(reservation.getId());
        } else {
            reservation.setStatus(upperStatus);
            reservationService.saveReservation(reservation);
        }

        return ResponseEntity.ok(toDTO(reservation));
    }

    // Cambiar usuario asociado con notificación
    @PatchMapping("/{id}/user")
    public ResponseEntity<ReservationDTO> updateReservationUser(@PathVariable UUID id,
                                                                @RequestBody ReservationUserUpdateDTO request) {
        try {
            // Usar el método del service que actualiza + notifica
            Reservation updated = reservationService.updateReservationUser(id, 
                    userRepository.findById(request.getUserId())
                            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"))
            );

            return ResponseEntity.ok(toDTO(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // Obtener reservas por usuario
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ReservationDTO>> getReservationsByUser(@PathVariable Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();

        List<ReservationDTO> reservations = reservationService.findReservationsByUser(userOpt.get())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(reservations);
    }

    // Cancelar reserva
    @DeleteMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelReservation(@PathVariable UUID id) {
        Optional<Reservation> existing = reservationService.findReservationById(id);
        if (existing.isEmpty()) return ResponseEntity.notFound().build();

        reservationService.cancelReservation(id);
        return ResponseEntity.noContent().build();
    }

    // Eliminar reserva
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReservation(@PathVariable UUID id) {
        Optional<Reservation> existingOpt = reservationService.findReservationById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();

        try {
            reservationService.deleteReservationSafe(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    // ----------------- Helper -----------------
    private ReservationDTO toDTO(Reservation res) {
        ReservationDTO dto = new ReservationDTO(res);
        if (dto.getStartDateTime() != null) dto.setStartTime(dto.getStartDateTime().toLocalTime());
        if (dto.getEndDateTime() != null) dto.setEndTime(dto.getEndDateTime().toLocalTime());
        return dto;
    }
}
