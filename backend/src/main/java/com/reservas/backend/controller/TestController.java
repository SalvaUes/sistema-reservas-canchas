package com.reservas.backend.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @GetMapping("/api/test")
    @CrossOrigin(origins = "http://localhost:4200") // Permitir peticiones desde Angular

    public String test() {
        return "¡El backend está funcionando! " + new java.util.Date();
    }
}