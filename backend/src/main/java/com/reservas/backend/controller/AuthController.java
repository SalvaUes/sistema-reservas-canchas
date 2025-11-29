package com.reservas.backend.controller;

import java.util.Collections;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.reservas.backend.dto.UserDTO;
import com.reservas.backend.model.User;
import com.reservas.backend.service.UserService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @Value("${spring.security.oauth2.resourceserver.jwt.audience}")
    private String claimsNamespace;

    @PostMapping("/login")
    public ResponseEntity<?> syncUser(@AuthenticationPrincipal Jwt jwt) {
        String auth0Id = jwt.getSubject();
        
        // 1. Obtener Email
        String email = jwt.getClaimAsString("email");
        if (email == null || email.trim().isEmpty()) {
            email = jwt.getClaimAsString(claimsNamespace + "email");
        }
        if (email == null) email = auth0Id + "@no-email.com";

        // 2. Obtener Nombre
        String name = jwt.getClaimAsString("name");
        if (name == null) {
            name = jwt.getClaimAsString(claimsNamespace + "name");
        }

        String nickname = jwt.getClaimAsString("nickname");
        if (name != null && email != null && name.equalsIgnoreCase(email) && nickname != null) {
            name = nickname;
        }
        
        if (name == null) name = "Usuario-" + auth0Id.substring(0, Math.min(auth0Id.length(), 5));

        // 3. Username y Roles
        String username = jwt.getClaimAsString(claimsNamespace + "username");
        if (username == null) username = nickname;
        if (username == null) username = jwt.getClaimAsString("preferred_username");

        List<String> auth0Roles = jwt.getClaimAsStringList(claimsNamespace + "roles");
        if (auth0Roles == null) auth0Roles = Collections.emptyList();

        User user = userService.syncUserFromAuth0(auth0Id, email, name, username, auth0Roles);

        return ResponseEntity.ok(new UserDTO(user));
    }
}