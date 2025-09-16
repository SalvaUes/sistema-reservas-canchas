package com.reservas.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class InvoiceDTO {
    private String invoiceNumber;      // Código de factura: INV-xxxx
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private BigDecimal amount;
    private String method;             // Método de pago: CARD / CASH
    private String status;             // Estado del pago: CONFIRMED
    private LocalDateTime paymentDate;
    private String reservationCode;    // Código legible de reserva: R-xxxxxxx

    public InvoiceDTO(String invoiceNumber, String customerName, String customerEmail,
                      String customerPhone, BigDecimal amount, String method,
                      String status, LocalDateTime paymentDate, String reservationCode) {
        this.invoiceNumber = invoiceNumber;
        this.customerName = customerName;
        this.customerEmail = customerEmail;
        this.customerPhone = customerPhone;
        this.amount = amount;
        this.method = method;
        this.status = status;
        this.paymentDate = paymentDate;
        this.reservationCode = reservationCode; // ya debe venir como R-XXXXXXX
    }

    // Getters y setters
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }

    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getPaymentDate() { return paymentDate; }
    public void setPaymentDate(LocalDateTime paymentDate) { this.paymentDate = paymentDate; }

    public String getReservationCode() { return reservationCode; }
    public void setReservationCode(String reservationCode) { this.reservationCode = reservationCode; }
}
