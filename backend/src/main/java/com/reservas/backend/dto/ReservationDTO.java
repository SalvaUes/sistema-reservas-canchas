package com.reservas.backend.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.reservas.backend.model.Reservation;

public class ReservationDTO {
    private Long id;
    private LocalDate date;
    private LocalTime startTime;
    private LocalTime endTime;
    private String status;

    private UUID courtId;
    private String courtCode;
    private String courtName;

    private Long userId;
    private String userFullName;

    public ReservationDTO(Reservation reservation) {
        this.id = reservation.getId();
        this.date = reservation.getDate();
        this.startTime = reservation.getStartTime();
        this.endTime = reservation.getEndTime();
        this.status = reservation.getStatus();

        if (reservation.getCourt() != null) {
            this.courtId = reservation.getCourt().getId();
            this.courtCode = reservation.getCourt().getCode();
            this.courtName = reservation.getCourt().getName();
        }

        if (reservation.getUser() != null) {
            this.userId = reservation.getUser().getId();
            this.userFullName =
                (reservation.getUser().getFirstName() != null ? reservation.getUser().getFirstName() : "")
                + " "
                + (reservation.getUser().getLastName() != null ? reservation.getUser().getLastName() : "");
        }
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getCourtId() { return courtId; }
    public void setCourtId(UUID courtId) { this.courtId = courtId; }

    public String getCourtCode() { return courtCode; }
    public void setCourtCode(String courtCode) { this.courtCode = courtCode; }

    public String getCourtName() { return courtName; }
    public void setCourtName(String courtName) { this.courtName = courtName; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserFullName() { return userFullName; }
    public void setUserFullName(String userFullName) { this.userFullName = userFullName; }
}
