import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { Router, NavigationEnd } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { timer, Subscription, Subject } from 'rxjs';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { ReservationPendingSnackbarComponent, PendingSnackbarData } from '../../shared/notificaciones/reservation-pending-snackbar/reservation-pending-snackbar.component';
import { AuthService } from '../../services/auth.service'; 

interface PendingData {
  reservationId: string;
  reservationCode: string;
  courtName: string;
  startTime: string;
  endTime: string;
  expireAt: number;
  originalExpireAt: number;
  extended: boolean;
  reactivated?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReservationPendingService implements OnDestroy {
  private snackRef: MatSnackBarRef<ReservationPendingSnackbarComponent> | null = null;
  private activeReservation: PendingData | null = null;
  private isCancelling = false;

  private uiIntervalId: any = null;
  private backendCheckSub?: Subscription;
  private autoCancelSub?: Subscription;
  private lastCriticalMessage: string | null = null;

  private readonly uiIntervalMs = 1000;
  private readonly backendCheckIntervalMs = 5000;
  

  reservationCancelled = new Subject<{ reservationId: string; reason: 'auto' | 'manual' | 'admin' | 'server' }>();
  reservationStarted = new Subject<void>();

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private ngZone: NgZone,
    private notificationService: NotificationService,
    private router: Router, 
    private auth: AuthService
  ) {
    // Restaurar reserva si ya hay token activo
    if (this.auth.isLogged()) {
      this.restorePreviousState();
    }

    // Restaurar snackbar si el usuario inicia sesión después
    this.auth.userEmail$.subscribe(email => {
      if (email) {
        this.restorePreviousState();
      }
    });

    // Restaurar snackbar si el usuario navega
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

  // -------------------- PUBLIC API --------------------

  startPendingReservation(
    id: string, code: string, remainingMs: number,
    courtName: string, startTime: string, endTime: string
  ) {
    if (this.activeReservation && this.activeReservation.reservationId === id) {
      const remainingInMem = Math.max(0, this.activeReservation.expireAt - Date.now());
      this.showNotification(courtName, startTime, endTime, remainingInMem);
      this.setAutoCancelTimer(remainingInMem);
      this.startBackendPolling();
      this.ngZone.run(() => this.reservationStarted.next());
      return;
    }

    let expireAt = Date.now() + remainingMs;
    const saved = this.safeGetItem('activeReservation');
    if (saved) {
      try {
        const parsed: PendingData = JSON.parse(saved);
        if (parsed.reservationId === id && parsed.expireAt > Date.now()) {
          expireAt = parsed.expireAt;
        }
      } catch { }
    }

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

    const remaining = Math.max(0, expireAt - Date.now());
    this.showNotification(courtName, startTime, endTime, remaining);
    this.setAutoCancelTimer(remaining);
    this.startBackendPolling();
  }

  reactivateReservation() {
    if (!this.activeReservation) return;

    const duration = 3 * 60 * 1000; // 3 minutos
    this.activeReservation.expireAt = Date.now() + duration;
    this.activeReservation.originalExpireAt = this.activeReservation.expireAt;
    this.activeReservation.reactivated = true;
    this.activeReservation.extended = false;

    this.saveState();

    if (this.snackRef?.instance) {
      this.snackRef.instance.updateData(
        this.activeReservation.courtName,
        this.activeReservation.startTime,
        this.activeReservation.endTime,
        this.activeReservation.expireAt
      );
    }

    this.setAutoCancelTimer(duration);
    this.startBackendPolling();

    // Notificar a otros componentes
    this.ngZone.run(() => this.reservationStarted.next());

    this.showCriticalNotification(
      'Reserva reactivada por el administrador. Tienes 3 minutos para confirmar.',
      'warning',
      5000
    );
  }

  extendTimeOnce(extraMinutes = 5, reason: 'payment' | 'manual' = 'manual') {
    if (!this.activeReservation || this.activeReservation.extended || this.isCancelling) {
      if (this.activeReservation?.extended) {
        this.notificationService.show('Ya se extendió una vez, no se agregan más minutos.', 'warning', 4000);
      }
      return;
    }

    const extraMs = extraMinutes * 60 * 1000;
    const remaining = Math.max(0, this.activeReservation.expireAt - Date.now());

    this.activeReservation.expireAt = Date.now() + remaining + extraMs;
    this.activeReservation.extended = true;

    this.resetTimersAndSnackbar(remaining + extraMs);

    const msg = reason === 'payment'
      ? 'Extensión de tiempo por intento de pago (+5 minutos).'
      : `Tiempo extendido (+${extraMinutes} minutos).`;

    this.notificationService.show(msg, 'warning', 5000);
  }

  onPaymentAttempt() {
    this.extendTimeOnce(5, 'payment');
  }

  // Llamada desde temporizador de expiración
  private autoCancelReservation() {
    if (!this.activeReservation) return;
    this.cancelReservation(true); // auto = true
  }

  // Ajuste en cancelReservation
  cancelReservation(auto = false) {
    if (!this.activeReservation || this.isCancelling) return;

    this.isCancelling = true;
    const id = this.activeReservation.reservationId;

    this.http.delete<{ status?: string }>(`http://localhost:8080/api/reservations/${id}/cancel`)
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          if (res?.status === 'CONFIRMED') {
            this.notificationService.show('La reserva ya fue confirmada, no se cancela.', 'warning', 4000);
          }
          this.finalizeCancellation(auto, auto ? 'auto' : 'manual');
        },
        error: () => {
          this.notificationService.show('Error al cancelar la reserva.', 'error', 4000);
          this.finalizeCancellation(auto, auto ? 'auto' : 'manual');
        }
      });
  }

  forceCloseReservation() {
    this.clearAllTimers();
    this.dismissSnackbar();
    this.activeReservation = null;
    this.isCancelling = false;
    this.safeRemoveItem('activeReservation');
  }

  revertExtension() {
    if (!this.activeReservation || !this.activeReservation.extended) return;
    this.activeReservation.expireAt = this.activeReservation.originalExpireAt;
    this.activeReservation.extended = false;
    this.saveState();
    this.updateSnackbar();
    this.notificationService.show('Extensión revertida.', 'warning', 3000);
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
    const remaining = parsed.expireAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  closeLocalReservation() {
    this.clearAllTimers();
    this.dismissSnackbar();
    if (this.activeReservation) {
      this.reservationCancelled.next({
        reservationId: this.activeReservation.reservationId,
        reason: 'manual'
      });
    }
    this.activeReservation = null;
    this.isCancelling = false;
    this.safeRemoveItem('activeReservation');
  }

  // -------------------- BACKEND & TIMER CONTROL --------------------

  private startBackendPolling() {
    const active = this.activeReservation;
    if (!active) return;

    this.backendCheckSub?.unsubscribe();
    this.backendCheckSub = timer(0, this.backendCheckIntervalMs).subscribe(() => {
      if (!this.activeReservation) return;

      const id = this.activeReservation.reservationId;
      this.http.get<{ status: string; courtName?: string; startTime?: string; endTime?: string }>(
        `http://localhost:8080/api/reservations/${id}/status`
      ).pipe(take(1)).subscribe({
        next: res => this.ngZone.run(() => this.handleBackendStatus(res)),
        error: () => {}
      });
    });
  }

  private handleBackendStatus(res: { status: string; courtName?: string; startTime?: string; endTime?: string }) {
    const active = this.activeReservation;
    if (!active) return;

    switch(res.status) {
      case 'REACTIVATED':
        if (!active.reactivated) this.reactivateReservation();
        break;
      case 'CANCELLED':
        // Cancelación por admin
        this.showCriticalNotification(
          'La reserva fue cancelada por el administrador.',
          'error',
          4000
        );
        this.finalizeCancellation(true, 'admin'); // <-- ahora indica admin
        break;
      case 'CONFIRMED':
        this.showCriticalNotification(
          'La reserva fue confirmada en el servidor.',
          'success',
          4000
        );
        this.finalizeCancellation(true, 'server');
        break;
      default:
        this.handleMinorEdits(res);
    }
  }

  private handleMinorEdits(res: { courtName?: string; startTime?: string; endTime?: string }) {
    const active = this.activeReservation;
    if (!active) return;

    const normalize = (s: string | undefined) =>
      s?.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '') ?? '';

    const changed =
      normalize(res.courtName) !== normalize(active.courtName) ||
      normalize(res.startTime) !== normalize(active.startTime) ||
      normalize(res.endTime) !== normalize(active.endTime);

    if (changed) {
      this.updateActiveReservation({
        courtName: res.courtName ?? active.courtName,
        startTime: res.startTime ?? active.startTime,
        endTime: res.endTime ?? active.endTime
      });

      this.showCriticalNotification(
        'La reserva fue modificada por el administrador.',
        'info',
        4000
      );
    }
  }

  /** Actualiza los datos visibles y guardados de la reserva activa */
  updateActiveReservation(updated: Partial<{
    courtName: string;
    startTime: string;
    endTime: string;
  }>) {
    if (!this.activeReservation) return;

    this.activeReservation = { ...this.activeReservation, ...updated };
    this.saveState();

    // Actualiza el snackbar dinámicamente
    if (this.snackRef?.instance) {
      this.snackRef.instance.updateData(
        this.activeReservation.courtName,
        this.activeReservation.startTime,
        this.activeReservation.endTime
      );
    }

    this.updateSnackbar(); // refresca contador y UI
  }

  private setAutoCancelTimer(durationMs: number) {
    this.autoCancelSub?.unsubscribe();
    this.autoCancelSub = timer(durationMs).subscribe(() => {
      if (this.activeReservation && !this.isCancelling && Date.now() >= this.activeReservation.expireAt) {
        this.cancelReservation(true);
      }
    });
  }

  // Ajuste en finalizeCancellation (ya tienes todo listo)
  private finalizeCancellation(auto: boolean, reason: 'auto' | 'manual' | 'admin' | 'server' = 'auto') {
    this.ngZone.run(() => {
      this.clearAllTimers();
      this.dismissSnackbar();
      if (this.activeReservation) {
        this.reservationCancelled.next({
          reservationId: this.activeReservation.reservationId,
          reason: reason
        });

        switch(reason) {
          case 'admin':
            this.notificationService.show('Tu reserva fue cancelada por el administrador.', 'error', 4000);
            break;
          case 'server':
            this.notificationService.show('Tu reserva ya fue confirmada en el servidor.', 'success', 4000);
            break;
          case 'manual':
            this.notificationService.show('Cancelaste la reserva manualmente.', 'warning', 3000);
            break;
          case 'auto':
          default:
            this.notificationService.show('Tu reserva pendiente ha expirado automáticamente.', 'error', 4000);
            break;
        }
      }
      this.safeRemoveItem('activeReservation');
      this.activeReservation = null;
      this.isCancelling = false;
    });
  }

  // -------------------- SNACKBAR CONTROL --------------------

  private showNotification(court: string, start: string, end: string, durationMs: number) {
    if (!this.activeReservation) return;

    const remaining = Math.max(0, this.activeReservation.expireAt - Date.now());

    if (this.snackRef) {
      this.snackRef.instance.updateRemaining(remaining);
      return;
    }

    const data: PendingSnackbarData = {
      reservationId: this.activeReservation.reservationId,
      reservationCode: this.activeReservation.reservationCode,
      courtName: court,
      startTime: start,
      endTime: end,
      expireAt: this.activeReservation.expireAt
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

    this.startUiInterval();
  }

  private resetTimersAndSnackbar(durationMs: number) {
    this.clearAllTimers();
    this.dismissSnackbar();
    if (!this.activeReservation) return;
    this.activeReservation.expireAt = Date.now() + durationMs;
    this.saveState();
    this.showNotification(
      this.activeReservation.courtName,
      this.activeReservation.startTime,
      this.activeReservation.endTime,
      durationMs
    );
    this.setAutoCancelTimer(durationMs);
    this.startBackendPolling();
  }

  private startUiInterval() {
    this.stopUiInterval();

    this.uiIntervalId = setInterval(() => {
      if (!this.activeReservation || !this.snackRef) {
        this.stopUiInterval();
        return;
      }

      const remaining = this.activeReservation.expireAt - Date.now();

      this.ngZone.run(() => this.updateSnackbar());

      if (remaining <= 0) {
        this.ngZone.run(() => {
          this.showCriticalNotification(
            'Tu reserva pendiente ha expirado automáticamente.',
            'error',
            4000
          );
          this.finalizeReservationAfterTimeout();
        });
      }
    }, this.uiIntervalMs);
  }

  private finalizeReservationAfterTimeout() {
    if (!this.activeReservation) return; 

    this.clearAllTimers();
    this.dismissSnackbar();

    this.reservationCancelled.next({
      reservationId: this.activeReservation.reservationId,
      reason: 'auto'
    });

    this.activeReservation = null;
    this.isCancelling = false;
    this.safeRemoveItem('activeReservation');
  }

  private updateSnackbar() {
    if (!this.activeReservation || !this.snackRef) return;
    const remaining = Math.max(0, this.activeReservation.expireAt - Date.now());
    this.snackRef.instance.updateRemaining(remaining);
  }

  private dismissSnackbar() {
    if (this.snackRef) {
      try { this.snackRef.dismiss(); } catch {}
      this.snackRef = null;
    }
    this.stopUiInterval();
  }

  private stopUiInterval() {
    if (this.uiIntervalId) {
      clearInterval(this.uiIntervalId);
      this.uiIntervalId = null;
    }
  }

  private clearAllTimers() {
    this.autoCancelSub?.unsubscribe();
    this.backendCheckSub?.unsubscribe();
    this.stopUiInterval();
  }

  // -------------------- PERSISTENCIA --------------------

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private safeGetItem(key: string): string | null {
    if (!this.isBrowser()) return null;
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private safeSetItem(key: string, value: string) {
    if (!this.isBrowser()) return;
    try { localStorage.setItem(key, value); } catch { console.warn('No se pudo guardar el estado local'); }
  }

  private safeRemoveItem(key: string) {
    if (!this.isBrowser()) return;
    try { localStorage.removeItem(key); } catch {}
  }

  private saveState() {
    if (!this.activeReservation) {
      this.safeRemoveItem('activeReservation');
      return;
    }
    try { this.safeSetItem('activeReservation', JSON.stringify(this.activeReservation)); } catch { }
  }

  private restorePreviousState() {
    if (!this.isBrowser() || this.snackRef) return;

    const saved = this.safeGetItem('activeReservation');
    if (!saved) return;

    // Aquí puedes verificar si el usuario sigue logueado
    if (!this.isUserLoggedIn()) return;

    try {
      const parsed: PendingData = JSON.parse(saved);

      this.http.get<{ status: string }>(`http://localhost:8080/api/reservations/${parsed.reservationId}/status`)
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            if (res.status === 'PENDING' || res.status === 'REACTIVATED') {
              const remaining = parsed.expireAt - Date.now();
              if (remaining > 0) {
                this.activeReservation = parsed;
                this.showNotification(parsed.courtName, parsed.startTime, parsed.endTime, remaining);
                this.setAutoCancelTimer(remaining);
                this.startBackendPolling();
              } else {
                this.activeReservation = parsed;
                this.cancelReservation(true);
              }
            } else {
              this.notificationService.show('Reserva ya confirmada o cancelada. Limpiando estado local.', 'error', 4000);
              this.closeLocalReservation();
            }
          },
          error: () => this.closeLocalReservation()
        });
    } catch { this.safeRemoveItem('activeReservation'); }
  }

  // -------------------- NOTIFICACIONES CRÍTICAS --------------------

  private showCriticalNotification(msg: string, type: 'success'|'warning'|'error'|'info', duration = 4000) {
    if (this.lastCriticalMessage === msg) return;
    this.lastCriticalMessage = msg;
    this.notificationService.show(msg, type, duration);
    setTimeout(() => { this.lastCriticalMessage = null; }, duration);
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  private isUserLoggedIn(): boolean {
    return !!this.auth.isLogged(); // o tu método para verificar sesión
  }

  /** Limpia todo estado de reservas pendiente al cerrar sesión */
  logoutAndClearReservation() {
    // Cancela temporizadores, polling y UI
    this.clearAllTimers();
    this.dismissSnackbar();

    // Limpia estado activo y localStorage
    this.activeReservation = null;
    this.isCancelling = false;
    this.safeRemoveItem('activeReservation');
  }
}
