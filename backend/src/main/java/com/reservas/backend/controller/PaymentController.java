package com.reservas.backend.controller;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
@CrossOrigin(origins = "http://localhost:4200")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    /**
     * Obtiene la factura de una reserva específica
     */
    @GetMapping("/invoice/{reservationId}")
    public ResponseEntity<InvoiceDTO> getInvoiceByReservation(@PathVariable UUID reservationId) {
        try {
            InvoiceDTO invoice = paymentService.getInvoiceByReservation(reservationId);
            return ResponseEntity.ok(invoice);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }
    }

    /**
     * Procesa el pago de una reserva y genera la factura
     */
    @PostMapping("/{reservationId}")
    public ResponseEntity<InvoiceDTO> payReservation(@PathVariable UUID reservationId,
                                                     @RequestBody PaymentRequest request) {
        try {
            InvoiceDTO invoice = paymentService.processPayment(reservationId, request);
            return ResponseEntity.ok(invoice);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }

    /**
     * Nuevo endpoint: verifica si existe factura para la reserva
     * Retorna:
     *  - hasInvoice: true/false
     *  - invoice: si existe
     *  - message: si no existe
     */
    @GetMapping("/reservation/{reservationId}")
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
