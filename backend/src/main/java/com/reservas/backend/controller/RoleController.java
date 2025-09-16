package com.reservas.backend.controller;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.reservas.backend.dto.RoleDTO;
import com.reservas.backend.model.Role;
import com.reservas.backend.repository.RoleRepository;

@RestController
@RequestMapping("/api/roles")
@CrossOrigin(origins = "http://localhost:4200") // Permitir peticiones desde Angular
public class RoleController {

    @Autowired
    private RoleRepository roleRepository;

    @GetMapping
    public List<RoleDTO> getAllRoles() {
        return roleRepository.findAll()
                .stream()
                .map(RoleDTO::new)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public RoleDTO getRoleById(@PathVariable Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rol no encontrado con id: " + id));
        return new RoleDTO(role);
    }

    @PostMapping
    public RoleDTO createRole(@RequestBody Role role) {
        Role savedRole = roleRepository.save(role);
        return new RoleDTO(savedRole);
    }

    @PutMapping("/{id}")
    public RoleDTO updateRole(@PathVariable Long id, @RequestBody Role updatedRole) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rol no encontrado con id: " + id));

        role.setName(updatedRole.getName());
        Role savedRole = roleRepository.save(role);

        return new RoleDTO(savedRole);
    }

    @DeleteMapping("/{id}")
    public void deleteRole(@PathVariable Long id) {
        roleRepository.deleteById(id);
    }
}
