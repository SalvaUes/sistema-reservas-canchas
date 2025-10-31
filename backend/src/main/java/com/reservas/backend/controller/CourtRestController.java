package com.reservas.backend.controller;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.reservas.backend.dto.CourtDTO;
import com.reservas.backend.model.Court;

@RestController
@RequestMapping("/api/courts")
@CrossOrigin(origins = "http://localhost:4200")
public class CourtRestController {

    private final CourtController courtService;

    public CourtRestController(CourtController courtService) {
        this.courtService = courtService;
    }

    @GetMapping
    public List<CourtDTO> getAllCourts() {
        return courtService.findAllCourts()
                        .stream()
                        .map(CourtDTO::new) 
                        .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CourtDTO> getCourtById(@PathVariable UUID id) {
        Optional<Court> court = courtService.findCourtById(id);
        return court.map(c -> ResponseEntity.ok(new CourtDTO(c)))
                   .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<CourtDTO> createCourt(@RequestBody Court newCourt) {
        Court savedCourt = courtService.saveCourt(newCourt);
        return ResponseEntity.ok(new CourtDTO(savedCourt));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CourtDTO> updateCourt(@PathVariable UUID id, @RequestBody Court updatedCourt) {
        Optional<Court> existingCourt = courtService.findCourtById(id);
        if (existingCourt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Court court = existingCourt.get();
        court.setName(updatedCourt.getName());
        court.setDescription(updatedCourt.getDescription());
        court.setSportType(updatedCourt.getSportType());
        court.setPricePerHour(updatedCourt.getPricePerHour());

        Court savedCourt = courtService.saveCourt(court);
        return ResponseEntity.ok(new CourtDTO(savedCourt));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCourt(@PathVariable UUID id) {
        Optional<Court> court = courtService.findCourtById(id);
        if (court.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        courtService.deleteCourt(id);
        return ResponseEntity.noContent().build();
    }
}
