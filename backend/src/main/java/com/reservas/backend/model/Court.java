package com.reservas.backend.model;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;

@Entity
public class Court {

    @Id
    @GeneratedValue
    private UUID id; // ID único alfanumérico

    @Column(nullable = false, unique = true, length = 10)
    private String code; // Código legible (ej: C-AB12CD34)

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private String sportType; // Fútbol, Tenis, Básquetbol

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal pricePerHour;

    @OneToMany(mappedBy = "court", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Reservation> reservations = new HashSet<>();

    public Court() {}

    public Court(String name, String description, String sportType, BigDecimal pricePerHour) {
        this.name = name;
        this.description = description;
        this.sportType = sportType;
        this.pricePerHour = pricePerHour;
    }

    @PrePersist
    public void generateCode() {
        if (this.code == null) {
            this.code = "C-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
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

    public Set<Reservation> getReservations() { return reservations; }
    public void setReservations(Set<Reservation> reservations) { this.reservations = reservations; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Court)) return false;
        Court court = (Court) o;
        return Objects.equals(code, court.code);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code);
    }

    @Override
    public String toString() {
        return "Court{" +
                "id=" + id +
                ", code='" + code + '\'' +
                ", name='" + name + '\'' +
                ", sportType='" + sportType + '\'' +
                '}';
    }
}
