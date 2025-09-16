package com.reservas.backend.segurity;

import java.util.Date;

import org.springframework.stereotype.Component;

import com.reservas.backend.model.User;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

@Component
public class JwtUtil {

    private final String SECRET = "mi_secreto_superseguro"; // cambiar en producción
    private final long EXPIRATION = 1000 * 60 * 60 * 10; // 10 horas

    public String generateToken(User user) {
        return Jwts.builder()
                .setSubject(user.getEmail())
                .claim("role", user.getRoles().stream().findFirst().map(r -> r.getName()).orElse("USER"))
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION))
                .signWith(SignatureAlgorithm.HS256, SECRET)
                .compact();
    }
}
