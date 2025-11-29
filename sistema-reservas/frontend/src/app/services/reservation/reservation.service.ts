import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReservationDTO {
  id: string;
  userFullName?: string;
  code: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string; 
  
  startTimeRaw?: string;
  endTimeRaw?: string;
}

export interface CreateReservationRequest {
  userId?: number; 
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string; 
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  // 💡 2. Usar la variable de entorno para la URL base
  private readonly apiUrl = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient) {}

  // Crear reserva
  createReservation(request: CreateReservationRequest): Observable<ReservationDTO> {
    return this.http.post<ReservationDTO>(this.apiUrl, request);
  }

  getMyReservations(): Observable<ReservationDTO[]> {
    return this.http.get<ReservationDTO[]>(`${this.apiUrl}/my`);
  }

  // Obtener reservas por usuario (Para ADMIN o uso legacy)
  getReservationsByUser(userId: number): Observable<ReservationDTO[]> {
    return this.http.get<ReservationDTO[]>(`${this.apiUrl}/user/${userId}`);
  }

  // Obtener reservas por cancha y fecha (para verificar disponibilidad)
  getReservationsByCourtAndDate(courtId: string, date: string): Observable<ReservationDTO[]> {
    return this.http.get<ReservationDTO[]>(`${this.apiUrl}/court/${courtId}?date=${date}`);
  }

  // Obtener estado de una reserva específica (Polling)
  getReservationStatus(id: string): Observable<{ status: string; courtName?: string; startTime?: string; endTime?: string }> {
    return this.http.get<any>(`${this.apiUrl}/${id}/status`);
  }

  // Cancelar reserva
  cancelReservation(id: string): Observable<any> {
    return this.http.delete<{ status?: string }>(`${this.apiUrl}/${id}/cancel`);
  }
}