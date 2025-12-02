package com.reservas.backend.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.reservas.backend.model.Court;
import com.reservas.backend.repository.CourtRepository;

@Service
public class CourtService {

    private final CourtRepository courtRepository;

    public CourtService(CourtRepository courtRepository) {
        this.courtRepository = courtRepository;
    }

    public List<Court> findAllCourts() {
        return courtRepository.findAll();
    }

    public Court saveCourt(Court court) {
        return courtRepository.save(court);
    }

    public Optional<Court> findCourtById(UUID id) {
        return courtRepository.findById(id);
    }

    public void deleteCourt(UUID id) {
        courtRepository.deleteById(id);
    }

    public List<Court> findCourtsBySport(String sportType) {
        return courtRepository.findBySportType(sportType);
    }
}