import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
// 💡 1. Importar environment
import { environment } from '../../environments/environment';

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
  private readonly apiUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) {}

  payReservation(reservationId: string, request: PaymentRequest): Observable<InvoiceDTO> {
    return this.http.post<InvoiceDTO>(`${this.apiUrl}/${reservationId}`, request);
  }

  getInvoiceByReservation(reservationId: string): Observable<InvoiceDTO> {
    return this.http.get<InvoiceDTO>(`${this.apiUrl}/invoice/${reservationId}`);
  }

  getReservationInvoiceStatus(reservationId: string) {
    return this.http.get<any>(`${this.apiUrl}/reservation/${reservationId}`);
  }
}