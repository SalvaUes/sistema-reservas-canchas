package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.reservas.backend.model.Reservation;

public class ReservationDTO {

    private UUID id;           // UUID interno
    private String code;       // Código legible R-XXXXXXX
    private LocalDate date;
    private LocalTime startTime;
    private LocalTime endTime;
    private String status;

    private UUID courtId;
    private String courtCode;
    private String courtName;
    private BigDecimal pricePerHour;
    private BigDecimal totalPrice;

    private Long userId;
    private String userFullName;

    public ReservationDTO() {
        // Constructor vacío necesario para Jackson u otros frameworks
    }

    public ReservationDTO(Reservation reservation) {
        this.id = reservation.getId();
        this.code = reservation.getCode();
        this.date = reservation.getDate();
        this.startTime = reservation.getStartTime();
        this.endTime = reservation.getEndTime();
        this.status = reservation.getStatus();

        if (reservation.getCourt() != null) {
            this.courtId = reservation.getCourt().getId();
            this.courtCode = reservation.getCourt().getCode();
            this.courtName = reservation.getCourt().getName();
            this.pricePerHour = reservation.getCourt().getPricePerHour();
        }

        if (reservation.getUser() != null) {
            this.userId = reservation.getUser().getId();
            this.userFullName = 
                (reservation.getUser().getFirstName() != null ? reservation.getUser().getFirstName() : "")
                + " "
                + (reservation.getUser().getLastName() != null ? reservation.getUser().getLastName() : "");
        }

        this.totalPrice = calculateTotalPrice();
    }

    private BigDecimal calculateTotalPrice() {
        if (startTime == null || endTime == null || pricePerHour == null) return BigDecimal.ZERO;
        long minutes = Duration.between(startTime, endTime).toMinutes();
        BigDecimal hours = BigDecimal.valueOf(minutes)
                                     .divide(BigDecimal.valueOf(60), 2, BigDecimal.ROUND_HALF_UP);
        return pricePerHour.multiply(hours);
    }

    // Getters y Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { 
        this.startTime = startTime; 
        this.totalPrice = calculateTotalPrice(); 
    }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { 
        this.endTime = endTime; 
        this.totalPrice = calculateTotalPrice(); 
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
        this.totalPrice = calculateTotalPrice(); 
    }

    public BigDecimal getTotalPrice() { return totalPrice; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserFullName() { return userFullName; }
    public void setUserFullName(String userFullName) { this.userFullName = userFullName; }
}
