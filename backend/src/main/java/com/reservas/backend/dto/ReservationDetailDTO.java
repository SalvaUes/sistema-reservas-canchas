package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

public class ReservationDetailDTO {

    private final String courtName;
    private final LocalTime startTime;
    private final LocalTime endTime;
    private final BigDecimal pricePerHour;
    private final BigDecimal totalPrice;
    private final LocalDate date; // opcional si quieres combinar con UTC

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

    /** Retorna inicio de reserva como ZonedDateTime UTC */
    public ZonedDateTime getStartDateTimeUTC() {
        if (date == null || startTime == null) return null;
        return ZonedDateTime.of(date, startTime, ZoneOffset.UTC);
    }

    /** Retorna fin de reserva como ZonedDateTime UTC */
    public ZonedDateTime getEndDateTimeUTC() {
        if (date == null || endTime == null) return null;
        return ZonedDateTime.of(date, endTime, ZoneOffset.UTC);
    }
}
