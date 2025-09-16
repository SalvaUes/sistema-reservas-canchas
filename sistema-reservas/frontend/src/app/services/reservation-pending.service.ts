import { Injectable, NgZone, EventEmitter } from '@angular/core';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ReservationPendingSnackbarComponent, PendingSnackbarData } from '../shared/notificaciones/reservation-pending-snackbar/reservation-pending-snackbar.component';

interface PendingData {
  reservationId: string;      // UUID
  reservationCode: string;
  courtName: string;
  startTime: string;
  endTime: string;
  expireAt: number;           // timestamp de expiración
  originalExpireAt: number;   // antes de la extensión
  extended: boolean;
  timer?: any;
}

@Injectable({ providedIn: 'root' })
export class ReservationPendingService {
  private snackRef: MatSnackBarRef<ReservationPendingSnackbarComponent> | null = null;
  private activeReservation: PendingData | null = null;
  private stepInterval = 1000;

  public reservationCancelled = new EventEmitter<void>();

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private ngZone: NgZone,
    private router: Router
  ) {
    this.loadState();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      const active = this.getActiveReservation();
      if (active && !this.snackRef) {
        const remaining = active.expireAt - Date.now();
        this.showNotification(active.courtName, active.startTime, active.endTime, remaining);
      }
    });
  }

  startPendingReservation(
    reservationId: string,
    reservationCode: string,
    durationMs: number,
    courtName: string,
    startTime: string,
    endTime: string
  ) {
    const expireAt = Date.now() + durationMs;

    this.activeReservation = {
      reservationId,
      reservationCode,
      courtName,
      startTime,
      endTime,
      expireAt,
      originalExpireAt: expireAt,
      extended: false
    };

    this.saveState();
    this.showNotification(courtName, startTime, endTime, durationMs);
  }

  closeLocalReservation() {
    if (this.snackRef) {
      this.snackRef.dismiss();
      this.snackRef = null;
    }
    this.clearTimer();
    this.activeReservation = null;
    this.saveState();
  }

  cancelReservation(auto = false) {
    if (this.activeReservation) {
      this.http.delete(`http://localhost:8080/api/reservations/${this.activeReservation.reservationId}`, { observe: 'response' })
        .subscribe({
          next: (res) => {
            if (res.status === 204) {
              this.ngZone.run(() => this.reservationCancelled.emit());
            }
          },
          error: () => console.warn('❌ Error al cancelar la reserva')
        });
    }
    this.closeLocalReservation();
  }

  extendTimeOnce() {
  if (!this.activeReservation || this.activeReservation.extended) return;

    const remaining = this.activeReservation.expireAt - Date.now();
    const extra = 5 * 60 * 1000; // 5 minutos
    this.activeReservation.expireAt = Date.now() + remaining + extra;
    this.activeReservation.extended = true;
    this.saveState();
    this.updateSnackbar();
  }

  /** Revertir extensión si el usuario no completa el pago */
  revertExtension() {
    if (!this.activeReservation || !this.activeReservation.extended) return;

    const remainingOriginal = this.activeReservation.originalExpireAt - Date.now();
    this.activeReservation.expireAt = Date.now() + Math.max(0, remainingOriginal);
    this.activeReservation.extended = false;
    this.saveState();
    this.updateSnackbar();
  }


  hasActiveReservation(): boolean {
    return !!this.activeReservation;
  }

  getActiveReservation(): PendingData | null {
    return this.activeReservation;
  }

  getRemainingTime(reservationId: string): number | null {
    return this.activeReservation?.reservationId === reservationId
      ? this.activeReservation.expireAt - Date.now()
      : null;
  }

  private clearTimer() {
    if (this.activeReservation?.timer) {
      clearInterval(this.activeReservation.timer);
      this.activeReservation.timer = undefined;
    }
  }

  private updateSnackbar() {
    if (!this.activeReservation) return;

    const remaining = this.activeReservation.expireAt - Date.now();
    if (this.snackRef) {
      this.snackRef.instance.updateRemaining(remaining);
    } else {
      this.showNotification(this.activeReservation.courtName, this.activeReservation.startTime, this.activeReservation.endTime, remaining);
    }
  }

  private showNotification(court: string, start: string, end: string, durationMs: number) {
    if (!this.activeReservation) return;

    if (!this.snackRef) {
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
    }

    this.clearTimer();
    this.activeReservation.timer = setInterval(() => {
      if (!this.activeReservation) return;

      const remainingTime = this.activeReservation.expireAt - Date.now();
      if (remainingTime <= 0) {
        this.cancelReservation(true);
      } else if (this.snackRef) {
        this.snackRef.instance.updateRemaining(remainingTime);
      }
    }, this.stepInterval);
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
      this.showNotification(parsed.courtName, parsed.startTime, parsed.endTime, remaining);
    } else {
      this.cancelReservation(true);
    }
  }
}
