package com.reservas.backend.controller;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.reservas.backend.dto.UserDTO;
import com.reservas.backend.dto.UserRequestDTO;
import com.reservas.backend.model.Role;
import com.reservas.backend.model.User;
import com.reservas.backend.repository.RoleRepository;
import com.reservas.backend.repository.UserRepository;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @GetMapping
    public List<UserDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(UserDTO::new)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public UserDTO getUserById(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con id: " + id));
        return new UserDTO(user);
    }

    @PostMapping
    public UserDTO createUser(@RequestBody UserRequestDTO request) {
        // Validar email único
        if(userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("El email ya está registrado: " + request.getEmail());
        }

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPhoneNumber(request.getPhoneNumber());

        // Hash de contraseña
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        // Asignar rol
        Role role = roleRepository.findByName(request.getRoleName())
                .orElseThrow(() -> new RuntimeException("Rol no encontrado: " + request.getRoleName()));
        user.getRoles().clear();
        user.getRoles().add(role);

        User savedUser = userRepository.save(user);
        return new UserDTO(savedUser);
    }

    @PutMapping("/{id}")
    public UserDTO updateUser(@PathVariable Long id, @RequestBody UserRequestDTO request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado con id: " + id));

        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPhoneNumber(request.getPhoneNumber());

        // Actualizar contraseña solo si se envía
        if(request.getPassword() != null && !request.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        // Actualizar rol
        if(request.getRoleName() != null && !request.getRoleName().isEmpty()) {
            Role role = roleRepository.findByName(request.getRoleName())
                    .orElseThrow(() -> new RuntimeException("Rol no encontrado: " + request.getRoleName()));
            user.getRoles().clear();
            user.getRoles().add(role);
        }

        User savedUser = userRepository.save(user);
        return new UserDTO(savedUser);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id, @RequestHeader("userRole") String userRole) {
        if (!"ADMIN".equals(userRole)) {
            throw new RuntimeException("No tienes permisos para eliminar usuarios.");
        }
        userRepository.deleteById(id);
    }
}
