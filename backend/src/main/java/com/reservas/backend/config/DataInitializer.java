package com.reservas.backend.config;

import java.math.BigDecimal;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.reservas.backend.controller.CourtController;
import com.reservas.backend.model.Court;
import com.reservas.backend.model.Role;
import com.reservas.backend.model.User;
import com.reservas.backend.repository.PaymentRepository;
import com.reservas.backend.repository.ReservationRepository;
import com.reservas.backend.service.RoleService;
import com.reservas.backend.service.UserService;

@Configuration
public class DataInitializer {

    @Bean
    @Transactional
    CommandLineRunner initDatabase(
            CourtController courtService,
            UserService userService,
            RoleService roleService,
            ReservationRepository reservationRepo,
            PaymentRepository paymentRepo
    ) {
        return args -> {
            // --- Crear roles ---
            if (roleService.findByName("ADMIN").isEmpty()) roleService.saveRole(new Role("ADMIN"));
            if (roleService.findByName("CLIENTE").isEmpty()) roleService.saveRole(new Role("CLIENTE"));
            if (roleService.findByName("USER").isEmpty()) roleService.saveRole(new Role("USER"));

            // --- Usuario de prueba ---
            User usuario = userService.findByEmail("juan@email.com").orElse(null);
            if (usuario == null) {
                usuario = new User();
                usuario.setFirstName("Juan");
                usuario.setLastName("Pérez");
                usuario.setEmail("juan@email.com");
                usuario.setPhoneNumber("12345678");
                usuario.setPassword(new BCryptPasswordEncoder().encode("password123"));
                usuario.addRole(roleService.findByName("ADMIN").get());
                userService.saveUser(usuario);
            }

            // --- Crear canchas ---
            if (courtService.findAllCourts().isEmpty()) {
                courtService.saveCourt(new Court("Cancha de Fútbol 1", "Grass sintético", "Fútbol", new BigDecimal("50.00")));
                courtService.saveCourt(new Court("Cancha de Tenis", "Arcilla", "Tenis", new BigDecimal("30.00")));
                courtService.saveCourt(new Court("Cancha de Básquetbol", "Techada", "Básquetbol", new BigDecimal("40.00")));
            }


        };
    }
}
