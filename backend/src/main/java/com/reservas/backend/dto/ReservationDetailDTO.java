package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;

import com.fasterxml.jackson.annotation.JsonFormat;

public class ReservationDetailDTO {

    private final String courtName;

    @JsonFormat(pattern = "HH:mm")
    private final LocalTime startTime;

    @JsonFormat(pattern = "HH:mm")
    private final LocalTime endTime;

    private final BigDecimal pricePerHour;
    private final BigDecimal totalPrice;
    private final LocalDate date; 

    public ReservationDetailDTO(String courtName, LocalDate date, LocalTime startTime, LocalTime endTime, BigDecimal pricePerHour) {
        this.courtName = courtName;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.pricePerHour = pricePerHour;
        this.totalPrice = calculateTotalPrice();
    }

    private BigDecimal calculateTotalPrice() {
        if (startTime == null || endTime == null || pricePerHour == null) return BigDecimal.ZERO;
        long minutes = Duration.between(startTime, endTime).toMinutes();
        BigDecimal hours = BigDecimal.valueOf(minutes)
                                     .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        return pricePerHour.multiply(hours);
    }

    // Getters
    public String getCourtName() { return courtName; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public BigDecimal getPricePerHour() { return pricePerHour; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public LocalDate getDate() { return date; }

}
