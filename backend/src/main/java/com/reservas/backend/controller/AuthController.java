package com.reservas.backend.controller;

import java.time.LocalDate;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.reservas.backend.dto.AuthRequest;
import com.reservas.backend.dto.JwtResponse;
import com.reservas.backend.model.Role;
import com.reservas.backend.model.User;
import com.reservas.backend.repository.RoleRepository;
import com.reservas.backend.repository.UserRepository;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;


@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final long jwtExpirationMs = 3600000; // 1 hora
    private final SecretKey jwtKey = Keys.secretKeyFor(SignatureAlgorithm.HS256);

    // ------------------ LOGIN ------------------
    @PostMapping("/login")
    public JwtResponse login(@RequestBody AuthRequest request) {
        Optional<User> optionalUser = userRepository.findByEmail(request.getEmail());

        if (optionalUser.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado");
        }

        User user = optionalUser.get(); 

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Contraseña incorrecta");
        }

        String token = Jwts.builder()
                .setSubject(user.getEmail())
                .claim("id", user.getId())
                .claim("role", user.getRoles().stream().findFirst().get().getName())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(jwtKey)
                .compact();

        return new JwtResponse(token);
    }

    // ------------------ REGISTER -----------------

    @PostMapping("/register")
    public JwtResponse register(@RequestBody AuthRequest request) {

        if (request.getFirstName() == null || request.getFirstName().isEmpty() ||
            request.getLastName() == null || request.getLastName().isEmpty() ||
            request.getEmail() == null || request.getEmail().isEmpty() ||
            request.getPassword() == null || request.getPassword().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Todos los campos obligatorios deben completarse");
        }

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El correo ya está registrado");
        }

        Role clienteRole = roleRepository.findByName("CLIENTE")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Rol CLIENTE no encontrado"));

        User newUser = new User();
        newUser.setFirstName(request.getFirstName());
        newUser.setLastName(request.getLastName());
        newUser.setEmail(request.getEmail());
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));
        newUser.setPhoneNumber(request.getPhoneNumber());

        if (request.getDateOfBirth() != null && !request.getDateOfBirth().isEmpty()) {
            newUser.setDateOfBirth(LocalDate.parse(request.getDateOfBirth()));
        }

        newUser.addRole(clienteRole);
        userRepository.save(newUser);
        
        String token = Jwts.builder()
                .setSubject(newUser.getEmail())
                .claim("id", newUser.getId())
                .claim("role", newUser.getRoles().stream().findFirst().get().getName())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(jwtKey)
                .compact();


        return new JwtResponse(token);
    }    
}
