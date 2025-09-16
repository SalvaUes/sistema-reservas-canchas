package com.reservas.backend.config;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.reservas.backend.controller.CourtController;
import com.reservas.backend.model.Court;
import com.reservas.backend.model.Payment;
import com.reservas.backend.model.PaymentMethod;
import com.reservas.backend.model.Reservation;
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

            // --- Crear reserva pendiente ---
            // --- Crear reserva pendiente ---
            if (!reservationRepo.existsByUserAndStatus(usuario, "PENDING")) {
                Court cancha = courtService.findAllCourts().get(0); // primera cancha
                Reservation reserva = new Reservation();
                reserva.setUser(usuario);
                reserva.setCourt(cancha);
                reserva.setDate(LocalDate.now());
                reserva.setStartTime(LocalTime.of(15, 0));
                reserva.setEndTime(LocalTime.of(16, 0));
                reserva.setStatus("PENDING");

                // Guardamos primero para generar UUID
                reserva = reservationRepo.save(reserva);

                // Generar código legible tipo "R-XXXXXX"
                String code = "R-" + reserva.getId().toString().substring(0, 6).toUpperCase();
                reserva.setCode(code);
                reservationRepo.save(reserva); // actualizar con el código

                // --- Opcional: crear un pago simulado ---
                Payment pago = new Payment(
                        cancha.getPricePerHour(),
                        PaymentMethod.CARD,
                        reserva,
                        usuario.getFirstName() + " " + usuario.getLastName(),
                        usuario.getEmail(),
                        usuario.getPhoneNumber()
                );
                pago.setStatus("CONFIRMED");
                pago.setPaymentDate(LocalDateTime.now());
                paymentRepo.save(pago);
            }

        };
    }
}
