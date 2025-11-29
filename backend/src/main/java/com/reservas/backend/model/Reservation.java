package com.reservas.backend.model;

import java.time.LocalDate;
import java.time.LocalDateTime; // 💡 Importar
import java.time.LocalTime;
import java.time.ZoneId; // 💡 Importar
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonFormat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;

@Entity
public class Reservation {

    @Id
    private UUID id; // ID interno único

    @Column(nullable = false, unique = true, length = 10)
    private String code; // Código legible de reserva (ej: R-AB12CD34)

    @Column(nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate date;

    @Column(nullable = false)
    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;

    @Column(nullable = false)
    @JsonFormat(pattern = "HH:mm")
    private LocalTime endTime;

    private String status = "PENDING"; // "PENDING", "CONFIRMED", "CANCELLED"

    // 💡 NUEVO: Hora exacta de creación para el temporizador de 3 minutos
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "court_id", nullable = false)
    private Court court;

    public Reservation() {}

    public Reservation(LocalDate date, LocalTime startTime, LocalTime endTime, User user, Court court) {
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.user = user;
        this.court = court;
    }

    @PrePersist
    public void generateIds() {
        if (this.id == null) {
            this.id = UUID.randomUUID(); // UUID interno
        }
        if (this.code == null) {
            this.code = "R-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(); // Código legible
        }
        // 💡 Asignar hora actual al crear (Zona El Salvador)
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now(ZoneId.of("America/El_Salvador"));
        }
    }

    // Getters y Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Court getCourt() { return court; }
    public void setCourt(Court court) { this.court = court; }

    // 💡 Getter/Setter para createdAt
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Reservation)) return false;
        Reservation that = (Reservation) o;
        return Objects.equals(code, that.code);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code);
    }

    @Override
    public String toString() {
        return "Reservation{" +
                "id=" + id +
                ", code='" + code + '\'' +
                ", date=" + date +
                ", startTime=" + startTime +
                ", endTime=" + endTime +
                ", status='" + status + '\'' +
                '}';
    }
}