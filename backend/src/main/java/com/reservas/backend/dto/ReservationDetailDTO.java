package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.time.LocalTime;

public class ReservationDetailDTO {

    private final String courtName;
    private final LocalTime startTime;
    private final LocalTime endTime;
    private final BigDecimal pricePerHour;
    private final BigDecimal totalPrice;

    public ReservationDetailDTO(String courtName, LocalTime startTime, LocalTime endTime, BigDecimal pricePerHour) {
        this.courtName = courtName;
        this.startTime = startTime;
        this.endTime = endTime;
        this.pricePerHour = pricePerHour;
        this.totalPrice = calculateTotalPrice();
    }

    private BigDecimal calculateTotalPrice() {
        long minutes = java.time.Duration.between(startTime, endTime).toMinutes();
        BigDecimal hours = BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, BigDecimal.ROUND_HALF_UP);
        return pricePerHour.multiply(hours);
    }

    // Getters y setters
    public String getCourtName() { return courtName; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public BigDecimal getPricePerHour() { return pricePerHour; }
    public BigDecimal getTotalPrice() { return totalPrice; }
}
