import { Injectable, NgZone } from '@angular/core';
import { timer, Subscription, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { ReservationService } from './reservation.service';

export interface ReactivatedEvent {
  reservationId: string;
  reactived?: boolean;   // 🔹 Indica si fue reactivada
  cancelled?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReservationReactivatedService {
  private activeId: string | null = null;
  private backendCheckSub?: Subscription;
  private readonly backendCheckIntervalMs = 5000;

  reservationReactivated = new Subject<ReactivatedEvent>();

  constructor(private base: ReservationService, private ngZone: NgZone) {}

  startMonitoring(reservationId: string) {
    this.activeId = reservationId;
    this.startBackendPolling();

    // 🔹 Notificación inicial fuerte, como la de cancelación
    this.base.showCriticalNotification(
      'Reserva reactivada por el administrador. Esperando confirmación del usuario.',
      'warning',
      5000
    );
  }

  stopMonitoring() {
    this.backendCheckSub?.unsubscribe();
    this.activeId = null;
  }

  private startBackendPolling() {
    if (!this.activeId) return;

    this.backendCheckSub?.unsubscribe();
    this.backendCheckSub = timer(0, this.backendCheckIntervalMs).subscribe(() => {
      this.base.checkStatus(this.activeId!).pipe(take(1)).subscribe({
        next: res => this.ngZone.run(() => this.handleStatus(res.status)),
        error: () => {}
      });
    });
  }

  private handleStatus(status: string) {
    if (!this.activeId) return;

    switch (status) {
      case 'REACTIVATED':
        // 🔹 Notificación fuerte al usuario, igual que la de cancelación
        this.base.showCriticalNotification(
          '✅ Tu reserva fue reactivada correctamente. Tienes 3 minutos para confirmarla.',
          'success',
          5000
        );
        this.reservationReactivated.next({ reservationId: this.activeId, reactived: true });
        this.stopMonitoring();
        break;

      case 'CANCELLED':
        // 🔹 Igual comportamiento para cancelación
        this.base.showCriticalNotification(
          '❌ La reserva reactivada fue cancelada por el administrador.',
          'error',
          5000
        );
        this.reservationReactivated.next({ reservationId: this.activeId, cancelled: true });
        this.stopMonitoring();
        break;

      default:
        // Podrías agregar un case para CONFIRMED o ignorar
        break;
    }
  }
}
