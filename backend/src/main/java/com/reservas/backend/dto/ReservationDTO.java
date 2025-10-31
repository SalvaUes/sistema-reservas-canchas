package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
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

    // Constructor vacío para Jackson
    public ReservationDTO() {}

    // Constructor desde entidad
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
            this.userFullName = String.join(" ",
                    reservation.getUser().getFirstName() != null ? reservation.getUser().getFirstName() : "",
                    reservation.getUser().getLastName() != null ? reservation.getUser().getLastName() : ""
            ).trim();
        }

        updateTotalPrice();
    }

    // Recalcula totalPrice
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

    // Getters y setters con actualización automática de totalPrice
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

    public BigDecimal getPricePerHour() { return pricePerHour; }
    public void setPricePerHour(BigDecimal pricePerHour) { 
        this.pricePerHour = pricePerHour; 
        updateTotalPrice();
    }

    // Resto de getters/setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getCourtId() { return courtId; }
    public void setCourtId(UUID courtId) { this.courtId = courtId; }

    public String getCourtCode() { return courtCode; }
    public void setCourtCode(String courtCode) { this.courtCode = courtCode; }

    public String getCourtName() { return courtName; }
    public void setCourtName(String courtName) { this.courtName = courtName; }

    public BigDecimal getTotalPrice() { return totalPrice; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserFullName() { return userFullName; }
    public void setUserFullName(String userFullName) { this.userFullName = userFullName; }

    // Fechas UTC para frontend
    public ZonedDateTime getStartDateTimeUTC() {
        if (date == null || startTime == null) return null;
        return ZonedDateTime.of(date, startTime, ZoneOffset.UTC);
    }

    public ZonedDateTime getEndDateTimeUTC() {
        if (date == null || endTime == null) return null;
        return ZonedDateTime.of(date, endTime, ZoneOffset.UTC);
    }
}
