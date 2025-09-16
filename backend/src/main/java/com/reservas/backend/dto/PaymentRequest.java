package com.reservas.backend.dto;

import java.math.BigDecimal;

import com.reservas.backend.model.PaymentMethod;

public class PaymentRequest {
    private BigDecimal amount;
    private PaymentMethod method;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    // Getters y setters
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod method) { this.method = method; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
}
