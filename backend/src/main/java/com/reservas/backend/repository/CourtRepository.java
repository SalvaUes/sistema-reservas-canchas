package com.reservas.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.reservas.backend.model.Court;

@Repository
public interface CourtRepository extends JpaRepository<Court, UUID> {
    List<Court> findByName(String name);
    List<Court> findBySportType(String sportType);
}
