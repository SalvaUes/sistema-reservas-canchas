package com.reservas.backend.controller;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.format.annotation.DateTimeFormat;
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

@RestController
@RequestMapping("/api/reservations")
@CrossOrigin(origins = "http://localhost:4200")
public class ReservationRestController {

    private final ReservationController reservationService;
    private final CourtController courtService;
    private final UserRepository userRepository;

    public ReservationRestController(ReservationController reservationService,
                                     CourtController courtService,
                                     UserRepository userRepository) {
        this.reservationService = reservationService;
        this.courtService = courtService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<ReservationDTO> getAllReservations() {
        return reservationService.findAllReservations()
                                 .stream()
                                 .map(ReservationDTO::new)
                                 .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReservationDTO> getReservationById(@PathVariable UUID id) {
        return reservationService.findReservationById(id)
                                 .map(res -> ResponseEntity.ok(new ReservationDTO(res)))
                                 .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/court/{courtId}")
    public List<ReservationDTO> getReservationsByCourtAndDate(
            @PathVariable UUID courtId,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return reservationService.findReservationsByCourtAndDate(courtId, date)
                                 .stream()
                                 .map(ReservationDTO::new)
                                 .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<Object> createReservation(@RequestBody ReservationRequest request) {
        Optional<Court> court = courtService.findCourtById(request.getCourtId());
        Optional<User> user = userRepository.findById(request.getUserId());
        if (court.isEmpty() || user.isEmpty())
            return ResponseEntity.badRequest().body("Usuario o cancha no existe.");

        try {
            Reservation newReservation = reservationService.attemptReservation(
                    court.get(),
                    user.get(),
                    request.getDate(),
                    request.getStartTime(),
                    request.getEndTime()
            );

            URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                                                     .path("/{id}")
                                                     .buildAndExpand(newReservation.getId())
                                                     .toUri();

            return ResponseEntity.created(location)
                                 .body(new ReservationDTO(newReservation));

        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReservationDTO> updateReservation(@PathVariable UUID id,
                                                            @RequestBody ReservationRequest request) {
        Optional<Reservation> existingOpt = reservationService.findReservationById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();

        Reservation reservation = existingOpt.get();

        if (request.getCourtId() != null) {
            Optional<Court> court = courtService.findCourtById(request.getCourtId());
            if (court.isEmpty()) return ResponseEntity.badRequest().body(null);
            reservation.setCourt(court.get());
        }

        if (request.getUserId() != null) {
            Optional<User> user = userRepository.findById(request.getUserId());
            if (user.isEmpty()) return ResponseEntity.badRequest().body(null);
            reservation.setUser(user.get());
        }

        if (request.getDate() != null) reservation.setDate(request.getDate());
        if (request.getStartTime() != null) reservation.setStartTime(request.getStartTime());
        if (request.getEndTime() != null) reservation.setEndTime(request.getEndTime());
        if (request.getStatus() != null) reservation.setStatus(request.getStatus());

        try {
            Reservation updated = reservationService.saveReservation(reservation);
            return ResponseEntity.ok(new ReservationDTO(updated));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        }
    }
    

    @PatchMapping("/{id}/user")
    public ResponseEntity<ReservationDTO> updateReservationUser(@PathVariable UUID id,
                                                                @RequestBody ReservationUserUpdateDTO request) {
        Optional<Reservation> existingOpt = reservationService.findReservationById(id);
        if (existingOpt.isEmpty()) return ResponseEntity.notFound().build();

        Reservation reservation = existingOpt.get();

        Optional<User> user = userRepository.findById(request.getUserId());
        if (user.isEmpty()) return ResponseEntity.badRequest().build();

        reservation.setUser(user.get());
        Reservation updated = reservationService.saveReservation(reservation);
        return ResponseEntity.ok(new ReservationDTO(updated));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ReservationDTO>> getReservationsByUser(@PathVariable Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();

        List<ReservationDTO> reservations = reservationService.findReservationsByUser(userOpt.get())
                                                              .stream()
                                                              .map(ReservationDTO::new)
                                                              .collect(Collectors.toList());

        return ResponseEntity.ok(reservations);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelReservation(@PathVariable UUID id) {
        Optional<Reservation> existing = reservationService.findReservationById(id);
        if (existing.isEmpty()) return ResponseEntity.notFound().build();

        reservationService.cancelReservation(id);
        return ResponseEntity.noContent().build();
    }
}
