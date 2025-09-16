package com.reservas.backend.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public class ReservationRequest {

    private Long userId;       
    private UUID courtId;
    private LocalDate date;
    private LocalTime startTime;
    private LocalTime endTime;
    private String status;     // Opcional si quieres permitir editar el estado

    // 🔹 Getters y setters
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public UUID getCourtId() { return courtId; }
    public void setCourtId(UUID courtId) { this.courtId = courtId; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
