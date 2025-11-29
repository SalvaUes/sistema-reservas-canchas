package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.reservas.backend.model.Reservation;

public class ReservationDTO {

    private UUID id;
    private String code;
    private LocalDate date;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime endTime;
    private String status;

    private UUID courtId;
    private String courtCode;
    private String courtName;
    private BigDecimal pricePerHour;
    private BigDecimal totalPrice;

    private Long userId;
    private String userFullName;
    private String email;
    
    private LocalDateTime createdAt;

    public ReservationDTO() {}

    // 🔹 Constructor desde entidad
    public ReservationDTO(Reservation reservation) {
        this.id = reservation.getId();
        this.code = reservation.getCode();
        this.date = reservation.getDate();
        this.startTime = reservation.getStartTime();
        this.endTime = reservation.getEndTime();
        this.status = reservation.getStatus();
        this.createdAt = reservation.getCreatedAt(); // 💡 Mapear

        // Datos de la cancha
        if (reservation.getCourt() != null) {
            this.courtId = reservation.getCourt().getId();
            this.courtCode = reservation.getCourt().getCode();
            this.courtName = reservation.getCourt().getName();
            this.pricePerHour = reservation.getCourt().getPricePerHour();
        }

        // Datos del usuario
        if (reservation.getUser() != null) {
            this.userId = reservation.getUser().getId();
            this.userFullName = String.join(" ",
                    reservation.getUser().getFirstName() != null ? reservation.getUser().getFirstName() : "",
                    reservation.getUser().getLastName() != null ? reservation.getUser().getLastName() : ""
            ).trim();
            this.email = reservation.getUser().getEmail();
        }

        updateTotalPrice();
    }

    // Calcula total
    private void updateTotalPrice() {
        if (startTime == null || endTime == null || pricePerHour == null) {
            this.totalPrice = BigDecimal.ZERO;
            return;
        }
        long minutes = Duration.between(startTime, endTime).toMinutes();
        BigDecimal hours = BigDecimal.valueOf(minutes)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        this.totalPrice = pricePerHour.multiply(hours);
    }

    // --- Getters y Setters ---
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { 
        this.startTime = startTime; 
        updateTotalPrice();
    }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { 
        this.endTime = endTime; 
        updateTotalPrice();
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getCourtId() { return courtId; }
    public void setCourtId(UUID courtId) { this.courtId = courtId; }

    public String getCourtCode() { return courtCode; }
    public void setCourtCode(String courtCode) { this.courtCode = courtCode; }

    public String getCourtName() { return courtName; }
    public void setCourtName(String courtName) { this.courtName = courtName; }

    public BigDecimal getPricePerHour() { return pricePerHour; }
    public void setPricePerHour(BigDecimal pricePerHour) { 
        this.pricePerHour = pricePerHour; 
        updateTotalPrice();
    }

    public BigDecimal getTotalPrice() { return totalPrice; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserFullName() { return userFullName; }
    public void setUserFullName(String userFullName) { this.userFullName = userFullName; }

    public String getEmail() { return email; } 
    public void setEmail(String email) { this.email = email; } 
    
    // 💡 Getter/Setter createdAt
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getStartDateTime() {
        if (date == null || startTime == null) return null;
        return LocalDateTime.of(date, startTime); 
    }

    public LocalDateTime getEndDateTime() {
        if (date == null || endTime == null) return null;
        return LocalDateTime.of(date, endTime);
    }
}