import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  protected readonly apiUrl = 'http://localhost:8080/api/reservations';
  private lastCriticalMessage: string | null = null;

  constructor(
    protected http: HttpClient,
    protected notificationService: NotificationService
  ) {}

  /** 🌐 Consultar estado de reserva */
  checkStatus(reservationId: string) {
    return this.http.get<{ status: string; courtName?: string; startTime?: string; endTime?: string }>(
      `${this.apiUrl}/${reservationId}/status`
    );
  }

  /** 🌐 Cancelar una reserva */
  cancelReservationApi(reservationId: string) {
    return this.http.delete<{ status?: string }>(`${this.apiUrl}/${reservationId}/cancel`);
  }

  /** 🔔 Notificación crítica (evita duplicados) */
  showCriticalNotification(msg: string, type: 'success' | 'warning' | 'error' | 'info', duration = 4000) {
    if (this.lastCriticalMessage === msg) return;
    this.lastCriticalMessage = msg;
    this.notificationService.show(msg, type, duration);
    setTimeout(() => { this.lastCriticalMessage = null; }, duration);
  }

  /** 🔔 Notificación normal */
  showNotification(msg: string, type: 'success' | 'warning' | 'error' | 'info', duration = 4000) {
    this.notificationService.show(msg, type, duration);
  }

  /** 🔄 Manejar actualización de reserva (reactivada, cancelada, editada) */
  handleReservationUpdate(event: { reservationId: string, status: string, reason?: string }) {
    let message = '';
    switch (event.status) {
      case 'REACTIVATED':
        message = `Tu reserva ${event.reservationId} ha sido reactivada.`;
        this.showCriticalNotification(message, 'success');
        break;
      case 'CANCELLED':
        message = event.reason === 'admin'
          ? `La reserva ${event.reservationId} fue cancelada por el administrador.`
          : `Tu reserva ${event.reservationId} ha sido cancelada.`;
        this.showCriticalNotification(message, 'error');
        break;
      case 'EDITED':
        message = `La reserva ${event.reservationId} fue modificada.`;
        this.showNotification(message, 'info');
        break;
    }
  }
}
