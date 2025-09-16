package com.reservas.backend.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.reservas.backend.dto.InvoiceDTO;
import com.reservas.backend.dto.PaymentRequest;
import com.reservas.backend.model.Payment;
import com.reservas.backend.model.Reservation;
import com.reservas.backend.repository.PaymentRepository;
import com.reservas.backend.repository.ReservationRepository;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepo;
    private final ReservationRepository reservationRepo;

    public PaymentService(PaymentRepository paymentRepo, ReservationRepository reservationRepo) {
        this.paymentRepo = paymentRepo;
        this.reservationRepo = reservationRepo;
    }

    private String generateReadableCode(UUID reservationId) {
        // Toma los primeros 8 caracteres del UUID y agrega prefijo R-
        return "R-" + reservationId.toString().substring(0, 8).toUpperCase();
    }

    /**
     * Procesa un pago real de la reserva
     */
    public InvoiceDTO processPayment(UUID reservationId, PaymentRequest request) {
        Reservation reservation = reservationRepo.findById(reservationId)
                .orElseThrow(() -> new RuntimeException("Reserva no encontrada"));

        Payment payment = new Payment(
                request.getAmount(),
                request.getMethod(),
                reservation,
                request.getCustomerName(),
                request.getCustomerEmail(),
                request.getCustomerPhone()
        );

        payment.setStatus("CONFIRMED");
        payment.setPaymentDate(LocalDateTime.now());

        reservation.setStatus("CONFIRMED");

        reservationRepo.save(reservation);
        paymentRepo.save(payment);

        String invoiceNumber = "INV-" + payment.getId();
        String reservationCode = generateReadableCode(reservation.getId());

        return new InvoiceDTO(
                invoiceNumber,
                payment.getCustomerName(),
                payment.getCustomerEmail(),
                payment.getCustomerPhone(),
                payment.getAmount(),
                payment.getMethod().name(),
                payment.getStatus(),
                payment.getPaymentDate(),
                reservationCode
        );
    }

    /**
     * Obtiene la factura de la reserva
     * Lanza excepción si no existe pago
     */
    public InvoiceDTO getInvoiceByReservation(UUID reservationId) {
        Payment payment = paymentRepo.findByReservationId(reservationId)
                .orElseThrow(() -> new RuntimeException("Factura no encontrada para la reserva " + reservationId));

        Reservation reservation = payment.getReservation();
        String invoiceNumber = "INV-" + payment.getId();
        String reservationCode = generateReadableCode(reservation.getId());

        return new InvoiceDTO(
                invoiceNumber,
                payment.getCustomerName(),
                payment.getCustomerEmail(),
                payment.getCustomerPhone(),
                payment.getAmount(),
                payment.getMethod().name(),
                payment.getStatus(),
                payment.getPaymentDate(),
                reservationCode
        );
    }
}
