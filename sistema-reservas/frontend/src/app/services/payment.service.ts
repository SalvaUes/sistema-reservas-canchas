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

  payReservation(reservationId: number, request: PaymentRequest): Observable<InvoiceDTO> {
    return this.http.post<InvoiceDTO>(`${this.apiUrl}/${reservationId}`, request);
  }

  getInvoiceByReservation(reservationId: number): Observable<InvoiceDTO> {
    return this.http.get<InvoiceDTO>(`http://localhost:8080/api/payments/invoice/${reservationId}`);
  }

}
