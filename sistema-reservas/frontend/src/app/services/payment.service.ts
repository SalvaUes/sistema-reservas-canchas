// frontend/src/app/services/payment.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PaymentRequest {
  method: 'CARD' | 'CASH';
  amount?: number;
  cardNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  cardExpiry?: string;
}

export interface InvoiceDTO {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  method: string;
  status: string;
  paymentDate: string;
  reservationCode: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = 'http://localhost:8080/api/payments';

  constructor(private http: HttpClient) {}

  // Cambiar 'number' a 'string'
  payReservation(reservationId: string, request: PaymentRequest): Observable<InvoiceDTO> {
    return this.http.post<InvoiceDTO>(`${this.apiUrl}/${reservationId}`, request);
  }

  // Cambiar 'number' a 'string'
  getInvoiceByReservation(reservationId: string): Observable<InvoiceDTO> {
    return this.http.get<InvoiceDTO>(`${this.apiUrl}/invoice/${reservationId}`);
  }

  getReservationInvoiceStatus(reservationId: string) {
    return this.http.get<any>(`http://localhost:8080/api/payments/reservation/${reservationId}`);
  }


}

