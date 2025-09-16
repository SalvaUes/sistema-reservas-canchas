package com.reservas.backend.dto;

import com.reservas.backend.model.Role;

public class RoleDTO {
    private Long id;
    private String name;

    // Constructor desde la entidad Role
    public RoleDTO(Role role) {
        this.id = role.getId();
        this.name = role.getName();
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
