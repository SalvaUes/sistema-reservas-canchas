package com.reservas.backend;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling; // 💡 Importar esto

@SpringBootApplication
@EnableScheduling 
public class BackendApplication {

    public static void main(String[] args) {
        // Forzar zona horaria global de la JVM a El Salvador
        TimeZone.setDefault(TimeZone.getTimeZone("America/El_Salvador"));

        SpringApplication.run(BackendApplication.class, args);
    }

}