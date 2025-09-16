package com.reservas.backend.security;

import java.util.Date;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.reservas.backend.model.Role;
import com.reservas.backend.model.User;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

@Component
public class JwtProvider {

    private final String jwtSecret = "miSecretoSuperSeguro123"; // Cambia por algo más seguro
    private final long jwtExpirationMs = 86400000; // 1 día

    public String generateToken(User user) {
        return Jwts.builder()
                .setSubject(user.getEmail())
                .claim("roles", user.getRoles().stream().map(Role::getName).collect(Collectors.toList()))
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(SignatureAlgorithm.HS512, jwtSecret)
                .compact();
    }
}
