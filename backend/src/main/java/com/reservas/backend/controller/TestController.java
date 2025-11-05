package com.reservas.backend.controller;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @GetMapping("/api/test")
    @CrossOrigin(origins = "http://localhost:4200") // Permitir peticiones desde Angular
    public String test() {
        // Hora local del servidor
        LocalDateTime now = LocalDateTime.now(); // por defecto usa la zona del sistema
        String formatted = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // Mensaje informativo
        return "¡El backend está funcionando! Fecha y hora local del servidor: " + formatted
                + " (zona: " + ZoneId.systemDefault() + ")";
    }
}
