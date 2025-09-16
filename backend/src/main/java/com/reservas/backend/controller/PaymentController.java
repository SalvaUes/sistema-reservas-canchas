package com.reservas.backend.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.reservas.backend.dto.InvoiceDTO;
import com.reservas.backend.dto.PaymentRequest;
import com.reservas.backend.service.PaymentService;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "http://localhost:4200") // permite Angular
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/invoice/{reservationId}")
    public InvoiceDTO getInvoiceByReservation(@PathVariable Long reservationId) {
        return paymentService.getInvoiceByReservation(reservationId);
    }

    @PostMapping("/{reservationId}")
    public InvoiceDTO payReservation(@PathVariable Long reservationId,
                                     @RequestBody PaymentRequest request) {
        return paymentService.processPayment(reservationId, request);
    }
}

