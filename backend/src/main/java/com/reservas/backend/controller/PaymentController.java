package com.reservas.backend.controller;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/invoice/{reservationId}")
    @PreAuthorize("hasAuthority('SCOPE_read:payments')")
    public ResponseEntity<InvoiceDTO> getInvoiceByReservation(@PathVariable UUID reservationId) {
        try {
            InvoiceDTO invoice = paymentService.getInvoiceByReservation(reservationId);
            return ResponseEntity.ok(invoice);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PostMapping("/{reservationId}")
    @PreAuthorize("hasAuthority('SCOPE_create:payments')")
    public ResponseEntity<InvoiceDTO> payReservation(@PathVariable UUID reservationId,
                                                     @RequestBody PaymentRequest request) {
        try {
            InvoiceDTO invoice = paymentService.processPayment(reservationId, request);
            return ResponseEntity.ok(invoice);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @GetMapping("/reservation/{reservationId}")
    @PreAuthorize("hasAuthority('SCOPE_read:payments')")
    public ResponseEntity<Map<String, Object>> getReservationInvoiceStatus(@PathVariable UUID reservationId) {
        try {
            InvoiceDTO invoice = paymentService.getInvoiceByReservation(reservationId);
            return ResponseEntity.ok(Map.of(
                    "hasInvoice", true,
                    "invoice", invoice
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.ok(Map.of(
                    "hasInvoice", false,
                    "message", "No existe factura para esta reserva"
            ));
        }
    }
}