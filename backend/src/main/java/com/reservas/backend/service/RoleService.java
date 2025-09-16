package com.reservas.backend.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.reservas.backend.model.Role;
import com.reservas.backend.repository.RoleRepository;

@Service
public class RoleService {

    private final RoleRepository roleRepository;

    public RoleService(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    public Optional<Role> findByName(String name) {
        return roleRepository.findByName(name);
    }

    public Role saveRole(Role role) {
        return roleRepository.save(role);
    }
}
