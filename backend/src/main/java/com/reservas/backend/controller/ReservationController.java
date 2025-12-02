package com.reservas.backend.controller;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
import com.reservas.backend.model.Court;
import com.reservas.backend.model.Reservation;
import com.reservas.backend.model.User;
import com.reservas.backend.repository.UserRepository;
import com.reservas.backend.service.CourtService;
import com.reservas.backend.service.ReservationService;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final ReservationService reservationService;
    private final CourtService courtService;
    private final UserRepository userRepository;

    public ReservationController(ReservationService reservationService,
                                 CourtService courtService,
                                 UserRepository userRepository) {
        this.reservationService = reservationService;
        this.courtService = courtService;
        this.userRepository = userRepository;
    }

    @GetMapping("/my")
    @PreAuthorize("hasAuthority('SCOPE_read:reservations')")
    public ResponseEntity<List<ReservationDTO>> getMyReservations(@AuthenticationPrincipal Jwt jwt) {
        String auth0Id = jwt.getSubject();
        Optional<User> userOpt = userRepository.findByAuth0Id(auth0Id);

        if (userOpt.isEmpty()) {
            String email = jwt.getClaimAsString("email");
            if (email != null) {
                userOpt = userRepository.findByEmail(email);
            }
        }
        
        if (userOpt.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<ReservationDTO> myReservations = reservationService.findReservationsByUser(userOpt.get())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(myReservations);
    }

    @GetMapping("/{id}/status")
    @PreAuthorize("hasAuthority('SCOPE_read:reservations')")
    public ResponseEntity<Map<String, String>> getReservationStatus(@PathVariable UUID id) {
        return reservationService.findReservationById(id)
                .map(res -> Map.of(
                        "status", res.getStatus(),
                        "courtName", res.getCourt().getName(),
                        "startTime", res.getStartTime().toString(),
                        "endTime", res.getEndTime().toString(),
                        "date", res.getDate().toString(),
                        "userEmail", res.getUser().getEmail()
                ))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SCOPE_read:reservations')")
    public ResponseEntity<List<ReservationDTO>> getAllReservations() {
        return ResponseEntity.ok(
                reservationService.findAllReservations()
                        .stream().map(this::toDTO).collect(Collectors.toList())
        );
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_read:reservations')")
    public ResponseEntity<ReservationDTO> getReservationById(@PathVariable UUID id) {
        return reservationService.findReservationById(id)
                .map(res -> ResponseEntity.ok(toDTO(res)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/court/{courtId}")
    @PreAuthorize("hasAuthority('SCOPE_read:reservations')")
    public ResponseEntity<List<ReservationDTO>> getReservationsByCourtAndDate(
            @PathVariable UUID courtId,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        
        return ResponseEntity.ok(
                reservationService.findReservationsByCourtAndDate(courtId, date)
                        .stream().map(this::toDTO).collect(Collectors.toList())
        );
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_create:reservations')")
    public ResponseEntity<?> createReservation(@RequestBody ReservationRequest request,
                                               @AuthenticationPrincipal Jwt jwt) {
        
        Optional<Court> courtOpt = courtService.findCourtById(request.getCourtId());
        User user = null;

        if (request.getUserId() != null) {
            user = userRepository.findById(request.getUserId()).orElse(null);
        } else if (jwt != null) {
            String auth0Id = jwt.getSubject();
            user = userRepository.findByAuth0Id(auth0Id)
                    .or(() -> userRepository.findByEmail(jwt.getClaimAsString("email")))
                    .orElse(null);
        }

        if (courtOpt.isEmpty() || user == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Usuario o cancha no encontrados."));
        }

        try {
            Reservation newReservation = reservationService.attemptReservation(
                    courtOpt.get(), user,
                    request.getDate(), request.getStartTime(), request.getEndTime()
            );

            URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                    .path("/{id}")
                    .buildAndExpand(newReservation.getId())
                    .toUri();

            return ResponseEntity.created(location).body(toDTO(newReservation));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_update:reservations')")
    public ResponseEntity<?> updateReservation(@PathVariable UUID id, @RequestBody ReservationRequest request) {
        Optional<Reservation> existingOpt = reservationService.findReservationById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();

        Reservation reservation = existingOpt.get();

        if (request.getCourtId() != null) courtService.findCourtById(request.getCourtId()).ifPresent(reservation::setCourt);
        if (request.getUserId() != null) userRepository.findById(request.getUserId()).ifPresent(reservation::setUser);
        if (request.getDate() != null) reservation.setDate(request.getDate());
        if (request.getStartTime() != null) reservation.setStartTime(request.getStartTime());
        if (request.getEndTime() != null) reservation.setEndTime(request.getEndTime());
        if (request.getStatus() != null) reservation.setStatus(request.getStatus());

        try {
            Reservation updated = reservationService.updateReservation(reservation);
            return ResponseEntity.ok(toDTO(updated));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/reactivate")
    @PreAuthorize("hasAuthority('SCOPE_update:reservations')")
    public ResponseEntity<?> reactivateReservation(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(toDTO(reservationService.reactivateReservation(id)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PatchMapping("/reactivate-bulk")
    @PreAuthorize("hasAuthority('SCOPE_update:reservations')")
    public ResponseEntity<?> reactivateReservationsBulk(@RequestBody List<UUID> reservationIds) {
        return ResponseEntity.ok(reservationService.reactivateReservationsBulk(reservationIds));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('SCOPE_update:reservations')")
    public ResponseEntity<?> updateReservationStatus(@PathVariable UUID id, @RequestBody String newStatus) {
        Optional<Reservation> existingOpt = reservationService.findReservationById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();

        Reservation reservation = existingOpt.get();
        reservation.setStatus(newStatus.trim().toUpperCase());
        reservationService.saveReservation(reservation);

        return ResponseEntity.ok(toDTO(reservation));
    }

    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAuthority('SCOPE_read:reservations')")
    public ResponseEntity<List<ReservationDTO>> getReservationsByUser(@PathVariable Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();

        return ResponseEntity.ok(
                reservationService.findReservationsByUser(userOpt.get())
                        .stream().map(this::toDTO).collect(Collectors.toList())
        );
    }

    @DeleteMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('SCOPE_delete:reservations')")
    public ResponseEntity<Void> cancelReservation(@PathVariable UUID id) {
        reservationService.cancelReservation(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_delete:reservations')")
    public ResponseEntity<Void> deleteReservation(@PathVariable UUID id) {
        try {
            reservationService.deleteReservationSafe(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    private ReservationDTO toDTO(Reservation res) {
        ReservationDTO dto = new ReservationDTO(res);
        if (dto.getStartDateTime() != null) dto.setStartTime(dto.getStartDateTime().toLocalTime());
        if (dto.getEndDateTime() != null) dto.setEndTime(dto.getEndDateTime().toLocalTime());
        return dto;
    }
}