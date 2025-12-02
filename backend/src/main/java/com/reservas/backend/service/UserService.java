package com.reservas.backend.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.reservas.backend.model.User;
import com.reservas.backend.repository.UserRepository;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private Auth0ManagementService auth0ManagementService;

    public Optional<User> findByEmail(String email) { return userRepository.findByEmail(email); }
    public Optional<User> findByAuth0Id(String auth0Id) { return userRepository.findByAuth0Id(auth0Id); }

    @Transactional
    public User syncUserFromAuth0(String auth0Id, String email, String fullName, String usernameFromToken, List<String> auth0Roles) {
        
        // 1. Determinar el ROL según lo que dice Auth0
        String roleFromAuth0 = "CLIENTE";
        if (auth0Roles != null && auth0Roles.contains("ADMIN")) {
            roleFromAuth0 = "ADMIN";
        }

        // 2. Determinar el USERNAME por defecto (Fallback)
        String calculatedUsername = usernameFromToken;
        if (calculatedUsername == null || calculatedUsername.isEmpty()) {
            if (email != null && email.contains("@")) {
                calculatedUsername = email.split("@")[0];
            } else {
                calculatedUsername = "user" + auth0Id.substring(0, Math.min(auth0Id.length(), 5));
            }
        }

        // 3. Buscar usuario existente
        Optional<User> existingUserOpt = userRepository.findByAuth0Id(auth0Id)
                                                    .or(() -> userRepository.findByEmail(email));

        User user;

        if (existingUserOpt.isPresent()) {
            // === USUARIO EXISTENTE ===
            user = existingUserOpt.get();

            // Seguridad: Si está inactivo, bloquear acceso inmediatamente
            if ("INACTIVE".equalsIgnoreCase(user.getStatus())) {
                throw new RuntimeException("Su cuenta está inactiva. Contacte al administrador.");
            }

            // Actualizar referencias ID Auth0
            if (user.getAuth0Id() == null) user.setAuth0Id(auth0Id);

            // Actualizar Email si cambió
            if (email != null && !email.contains("no-email")) {
                if (!email.equals(user.getEmail()) || user.getEmail().contains("no-email")) {
                    user.setEmail(email);
                }
            }
            
            // --- CORRECCIÓN DE NOMBRES ---
            if (fullName != null && !fullName.isEmpty()) {
                boolean dbNameIsGeneric = user.getFirstName() != null && user.getFirstName().startsWith("Usuario-");
                boolean dbNameIsEmpty = user.getFirstName() == null || user.getFirstName().isEmpty();
                
                if (dbNameIsGeneric || dbNameIsEmpty) {
                    updateNames(user, fullName);
                }
            }

            // --- ACTUALIZAR USERNAME SI HACE FALTA ---
            if (user.getUsername() == null || user.getUsername().isEmpty()) {
                user.setUsername(calculatedUsername);
            }

            // --- SINCRONIZACIÓN DE ROLES ---
            String localRole = user.getRole();

            if (localRole == null || localRole.isEmpty()) {
                user.setRole(roleFromAuth0);
            } else {
                if (!localRole.equals(roleFromAuth0)) {
                    System.out.println("⚠️ Sincronizando Roles: Local=" + localRole + " vs Auth0=" + roleFromAuth0);
                    
                    // Variable final efectiva para el hilo
                    String finalRoleToSync = localRole; 
                    
                    // Lanzamos hilo para no bloquear el login
                    new Thread(() -> {
                        try {
                            auth0ManagementService.updateUserRole(auth0Id, finalRoleToSync);
                        } catch (Exception e) {
                            System.err.println("Error sincronizando rol en login: " + e.getMessage());
                        }
                    }).start();
                }
            }

        } else {
            user = new User();
            user.setAuth0Id(auth0Id);
            user.setEmail(email);
            user.setUsername(calculatedUsername);
            user.setStatus("ACTIVE");
            
            user.setRole(roleFromAuth0);
            user.setPassword("{noop}auth0-managed");
            
            updateNames(user, fullName);
        }

        return userRepository.save(user);
    }

    private void updateNames(User user, String fullName) {
        if (fullName == null || fullName.isEmpty()) return;
        
        if (fullName.contains("@")) {
            String[] emailParts = fullName.split("@");
            user.setFirstName(emailParts[0]); 
            user.setLastName(""); 
            return;
        }
        
        String[] parts = fullName.split(" ");
        user.setFirstName(parts[0]);
        
        if (parts.length > 1) {
            StringBuilder lastName = new StringBuilder();
            for (int i = 1; i < parts.length; i++) {
                lastName.append(parts[i]).append(" ");
            }
            user.setLastName(lastName.toString().trim());
        } else {
            user.setLastName(""); 
        }
    }
}