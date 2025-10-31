import { Injectable, NgZone } from '@angular/core';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ReservationPendingSnackbarComponent, PendingSnackbarData } from '../shared/notificaciones/reservation-pending-snackbar/reservation-pending-snackbar.component';

interface PendingData {
  reservationId: string;
  reservationCode: string;
  courtName: string;
  startTime: string;
  endTime: string;
  expireAt: number;
  originalExpireAt: number;
  extended: boolean;
  timer?: any;
}

@Injectable({ providedIn: 'root' })
export class ReservationPendingService {
  private snackRef: MatSnackBarRef<ReservationPendingSnackbarComponent> | null = null; // Referencia al snackbar activo
  private activeReservation: PendingData | null = null; // Reserva pendiente activa
  private stepInterval = 1000; // Intervalo para actualizar el temporizador
  private isCancelling = false; // Para evitar múltiples cancelaciones simultáneas

  reservationCancelled = new Subject<'auto' | 'manual'>(); 

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private ngZone: NgZone,
    private router: Router
  ) {
    // 🔹 Al iniciar el servicio, restaurar el estado si existe
    this.loadState();

    // 🔹 Volver a mostrar la notificación si el usuario navega a otra ruta (por ejemplo recarga /cliente)
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      if (this.activeReservation && !this.snackRef) {
        const remaining = this.activeReservation.expireAt - Date.now();
        if (remaining > 0) {
          this.showNotification(
            this.activeReservation.courtName,
            this.activeReservation.startTime,
            this.activeReservation.endTime,
            remaining
          );
        }
      }
    });
  }

  /** Inicia una reserva pendiente */
  startPendingReservation(
    id: string, code: string, remainingMs: number,
    courtName: string, startTime: string, endTime: string
  ) {
    const expireAt = Date.now() + remainingMs;
    this.activeReservation = {
      reservationId: id,
      reservationCode: code,
      courtName,
      startTime,
      endTime,
      expireAt,
      originalExpireAt: expireAt,
      extended: false
    };

    this.saveState();
    this.showNotification(courtName, startTime, endTime, remainingMs);

    // Cancelación automática
    setTimeout(() => {
      if (this.activeReservation && Date.now() >= this.activeReservation.expireAt) {
        console.log('⏱️ Reserva expirada automáticamente');
        this.cancelReservation(true);
      }
    }, remainingMs);
  }

  /** Cancela la reserva (auto o manual) */
  cancelReservation(auto = false) {
    if (!this.activeReservation) return;

    this.isCancelling = true;
    const id = this.activeReservation.reservationId;

    console.log(`Cancelando reserva ${id} (auto=${auto})`);

    this.http.get<{ status: string }>(`http://localhost:8080/api/reservations/${id}/cancel`)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          if (res.status === 'CONFIRMED') {
            this.closeLocalReservation();
            this.isCancelling = false;
            return;
          }

          this.http.delete(`http://localhost:8080/api/reservations/${id}/cancel`, { observe: 'response' })
            .pipe(take(1))
            .subscribe({
              next: () => {
                this.ngZone.run(() => this.reservationCancelled.next(auto ? 'auto' : 'manual'));
                this.closeLocalReservation();
                this.isCancelling = false;
              },
              error: () => {
                this.ngZone.run(() => this.reservationCancelled.next(auto ? 'auto' : 'manual'));
                this.closeLocalReservation();
                this.isCancelling = false;
              }
            });
        },
        error: () => {
          this.http.delete(`http://localhost:8080/api/reservations/${id}/cancel`, { observe: 'response' })
            .pipe(take(1))
            .subscribe(() => {
              this.ngZone.run(() => this.reservationCancelled.next(auto ? 'auto' : 'manual'));
              this.closeLocalReservation();
              this.isCancelling = false;
            });
        }
      });
  }

  /** Extiende el tiempo una sola vez */
  extendTimeOnce() {
    // Si no hay activa o ya fue extendida o está cancelándose → salir
    if (!this.activeReservation || this.activeReservation.extended || this.isCancelling) return;

    const remaining = this.activeReservation.expireAt - Date.now();
    const extra = 5 * 60 * 1000; // +5 minutos
    this.activeReservation.expireAt = Date.now() + remaining + extra;
    this.activeReservation.extended = true;

    this.saveState();
    this.updateSnackbar();
  }


  revertExtension() {
    if (!this.activeReservation || !this.activeReservation.extended) return;

    this.activeReservation.expireAt = this.activeReservation.originalExpireAt;
    this.activeReservation.extended = false;

    this.saveState();
    this.updateSnackbar();
  }

  closeLocalReservation() {
    this.activeReservation = null;
    this.snackRef?.dismiss();
    this.snackRef = null;
    localStorage.removeItem('activeReservation');
  }

  hasActiveReservation() {
    return !!this.activeReservation;
  }

  getActiveReservation() {
    return this.activeReservation;
  }

  getRemainingTime(id: string): number | null {
    const saved = localStorage.getItem('activeReservation');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed.reservationId !== id) return null;
    return parsed.expireAt - Date.now();
  }

  private showNotification(court: string, start: string, end: string, durationMs: number) {
    if (!this.activeReservation) return;

    const data: PendingSnackbarData = {
      reservationId: this.activeReservation.reservationId,
      reservationCode: this.activeReservation.reservationCode,
      courtName: court,
      startTime: start,
      endTime: end,
      expireAt: Date.now() + durationMs
    };

    this.snackRef = this.snackBar.openFromComponent(ReservationPendingSnackbarComponent, {
      data,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['reservation-card-snackbar'],
      duration: undefined
    });

    this.snackRef.instance.cancelClicked.subscribe(() => {
      this.ngZone.run(() => this.router.navigate(['/cliente/mis-reservas']));
    });

    // Actualizar tiempo restante en pantalla
    this.clearTimer();
    this.activeReservation!.timer = setInterval(() => {
      if (!this.activeReservation) return;
      const remaining = this.activeReservation.expireAt - Date.now();
      if (remaining <= 0) {
        this.cancelReservation(true);
      } else if (this.snackRef) {
        this.snackRef.instance.updateRemaining(remaining);
      }
    }, this.stepInterval);
  }

  private updateSnackbar() {
    if (!this.activeReservation || !this.snackRef) return;
    const remaining = this.activeReservation.expireAt - Date.now();
    this.snackRef.instance.updateRemaining(remaining);
  }

  private saveState() {
    if (this.activeReservation) {
      localStorage.setItem('activeReservation', JSON.stringify(this.activeReservation));
    } else {
      localStorage.removeItem('activeReservation');
    }
  }

  private loadState() {
    const saved = localStorage.getItem('activeReservation');
    if (!saved) return;

    const parsed: PendingData = JSON.parse(saved);
    const remaining = parsed.expireAt - Date.now();

    if (remaining > 0) {
      this.activeReservation = parsed;
      console.log('🔄 Restaurando reserva pendiente tras reload');
      this.showNotification(parsed.courtName, parsed.startTime, parsed.endTime, remaining);
    } else {
      this.cancelReservation(true);
    }
  }

  private clearTimer() {
    if (this.activeReservation?.timer) {
      clearInterval(this.activeReservation.timer);
      this.activeReservation.timer = undefined;
    }
  }
}
