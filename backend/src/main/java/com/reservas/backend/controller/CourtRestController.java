package com.reservas.backend.controller;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
import com.reservas.backend.service.CourtService;

@RestController
@RequestMapping("/api/courts")
public class CourtRestController {

    private final CourtService courtService;

    public CourtRestController(CourtService courtService) {
        this.courtService = courtService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SCOPE_read:courts')")
    public List<CourtDTO> getAllCourts() {
        return courtService.findAllCourts()
                .stream()
                .map(CourtDTO::new)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_read:courts')")
    public ResponseEntity<CourtDTO> getCourtById(@PathVariable UUID id) {
        return courtService.findCourtById(id)
                .map(c -> ResponseEntity.ok(new CourtDTO(c)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_create:courts')")
    public ResponseEntity<CourtDTO> createCourt(@RequestBody Court newCourt) {
        Court savedCourt = courtService.saveCourt(newCourt);
        return ResponseEntity.ok(new CourtDTO(savedCourt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_update:courts')")
    public ResponseEntity<CourtDTO> updateCourt(@PathVariable UUID id, @RequestBody Court updatedCourt) {
        return courtService.findCourtById(id)
                .map(existingCourt -> {
                    existingCourt.setName(updatedCourt.getName());
                    existingCourt.setDescription(updatedCourt.getDescription());
                    existingCourt.setSportType(updatedCourt.getSportType());
                    existingCourt.setPricePerHour(updatedCourt.getPricePerHour());
                    
                    Court saved = courtService.saveCourt(existingCourt);
                    return ResponseEntity.ok(new CourtDTO(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_delete:courts')")
    public ResponseEntity<Void> deleteCourt(@PathVariable UUID id) {
        if (courtService.findCourtById(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        courtService.deleteCourt(id);
        return ResponseEntity.noContent().build();
    }
}