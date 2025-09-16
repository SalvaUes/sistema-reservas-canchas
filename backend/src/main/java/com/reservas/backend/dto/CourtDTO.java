package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.util.UUID;

import com.reservas.backend.model.Court;

public class CourtDTO {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private String sportType;
    private BigDecimal pricePerHour;

    public CourtDTO(Court court) {
        this.id = court.getId();
        this.code = court.getCode();
        this.name = court.getName();
        this.description = court.getDescription();
        this.sportType = court.getSportType();
        this.pricePerHour = court.getPricePerHour();
    }

    // Getters y Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSportType() { return sportType; }
    public void setSportType(String sportType) { this.sportType = sportType; }

    public BigDecimal getPricePerHour() { return pricePerHour; }
    public void setPricePerHour(BigDecimal pricePerHour) { this.pricePerHour = pricePerHour; }
}
