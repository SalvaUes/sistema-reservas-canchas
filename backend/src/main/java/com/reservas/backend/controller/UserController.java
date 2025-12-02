package com.reservas.backend.controller;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.reservas.backend.dto.UserDTO;
import com.reservas.backend.dto.UserRequestDTO;
import com.reservas.backend.model.Reservation;
import com.reservas.backend.model.User;
import com.reservas.backend.repository.ReservationRepository;
import com.reservas.backend.repository.UserRepository;
import com.reservas.backend.service.Auth0ManagementService;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final Auth0ManagementService auth0ManagementService;
    private final ReservationRepository reservationRepository;

    @Value("${spring.security.oauth2.resourceserver.jwt.audience}")
    private String claimsNamespace;

    public UserController(UserRepository userRepository,
                          Auth0ManagementService auth0ManagementService,
                          ReservationRepository reservationRepository) {
        this.userRepository = userRepository;
        this.auth0ManagementService = auth0ManagementService;
        this.reservationRepository = reservationRepository;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SCOPE_read:users') or hasRole('ADMIN')")
    public List<UserDTO> getAllUsers() {
        return userRepository.findAll().stream().map(UserDTO::new).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_read:users') or hasRole('ADMIN')")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(user -> ResponseEntity.ok(new UserDTO(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_update:users') or hasAuthority('SCOPE_read:users') or hasRole('ADMIN')")
    public ResponseEntity<?> updateUser(
            @PathVariable Long id,
            @RequestBody UserRequestDTO request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        String currentUserEmail = extractEmailFromJwt(jwt);
        
        List<String> permissions = jwt.getClaimAsStringList("permissions");
        boolean isAdmin = permissions != null && permissions.contains("update:users");
        boolean isOwner = currentUserEmail != null && user.getEmail().equalsIgnoreCase(currentUserEmail);

        if (!isAdmin && !isOwner) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("No tienes permiso para editar este perfil.");
        }

        // Validaciones de seguridad para desactivación
        if ("INACTIVE".equalsIgnoreCase(request.getStatus())) {
            if (isOwner) {
                return ResponseEntity.badRequest().body("No puedes desactivar tu propia cuenta.");
            }
            if ("ADMIN".equalsIgnoreCase(user.getRole())) {
                 return ResponseEntity.badRequest().body("No se puede desactivar a un usuario ADMIN. Primero cambie su rol a CLIENTE.");
            }
        }

        // Updates básicos (permitidos para Owner y Admin)
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getPhoneNumber() != null) user.setPhoneNumber(request.getPhoneNumber());

        // Updates administrativos (Solo Admin)
        if (isAdmin) {
            // 1. ROL
            if (request.getRoleName() != null && !request.getRoleName().isEmpty()) {
                String role = request.getRoleName().toUpperCase();
                if ((role.equals("ADMIN") || role.equals("CLIENTE")) && !role.equals(user.getRole())) {
                    user.setRole(role);
                    if (user.getAuth0Id() != null) {
                        new Thread(() -> {
                            try {
                                auth0ManagementService.updateUserRole(user.getAuth0Id(), role);
                            } catch (Exception e) {}
                        }).start();
                    }
                }
            }

            // 2. ESTADO
            if (request.getStatus() != null && !request.getStatus().isEmpty()) {
                String status = request.getStatus().toUpperCase();
                
                // Si pasa a INACTIVE, cancelar reservas pendientes
                if ("INACTIVE".equals(status) && "ACTIVE".equals(user.getStatus())) {
                    List<Reservation> pendingReservations = reservationRepository.findByUserId(user.getId())
                        .stream()
                        .filter(r -> "PENDING".equals(r.getStatus()))
                        .collect(Collectors.toList());
                    
                    for (Reservation res : pendingReservations) {
                        res.setStatus("CANCELLED");
                    }
                    reservationRepository.saveAll(pendingReservations);
                }

                if (status.equals("ACTIVE") || status.equals("INACTIVE")) {
                    user.setStatus(status);
                    if (user.getAuth0Id() != null) {
                        new Thread(() -> auth0ManagementService.updateUserStatus(user.getAuth0Id(), status)).start();
                    }
                }
            }
        } 

        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(new UserDTO(savedUser));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_delete:users') or hasRole('ADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String extractEmailFromJwt(Jwt jwt) {
        if (jwt == null) return null;
        String email = jwt.getClaimAsString(claimsNamespace + "email");
        if (email == null) email = jwt.getClaimAsString("email");
        return email;
    }
}