import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { Router, NavigationEnd } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { timer, Subscription, Subject } from 'rxjs';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { ReservationPendingSnackbarComponent, PendingSnackbarData } from '../../shared/notificaciones/reservation-pending-snackbar/reservation-pending-snackbar.component';
import { AuthService } from '../../services/auth.service';
import { ReservationService } from './reservation.service'; 
import { ReservationReactivatedService } from './reservation-reactivated.service'; 

interface PendingData {
  userEmail: string | null;
  reservationId: string;
  reservationCode: string;
  date: string;
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

  // Timers
  private uiIntervalId: any = null;
  private globalPollingSub?: Subscription; 
  private autoCancelSub?: Subscription;
  
  private lastCriticalMessage: string | null = null;
  private readonly uiIntervalMs = 1000;
  private readonly pollingIntervalMs = 5000; 

  reservationCancelled = new Subject<{ reservationId: string; reason: 'auto' | 'manual' | 'admin' | 'server' }>();
  reservationStarted = new Subject<void>();

  constructor(
    private snackBar: MatSnackBar,
    private reservationService: ReservationService,
    private reactivatedService: ReservationReactivatedService, 
    private ngZone: NgZone,
    private notificationService: NotificationService,
    private router: Router,
    private auth: AuthService
  ) {
    // Restaurar estado
    const saved = this.safeGetItem('activeReservation');
    if (saved) {
        try { 
            const parsed: PendingData = JSON.parse(saved);
            
            const isCorruptCourtName = /^\d{1,2}:\d{2}/.test(parsed.courtName);
            const isMissingDate = !parsed.date;
            const isInvalidDateString = parsed.date && !/\d/.test(parsed.date);

            if (isCorruptCourtName || isMissingDate || isInvalidDateString) {
                this.safeRemoveItem('activeReservation');
                this.activeReservation = null;
            } else {
                this.activeReservation = parsed;
            }
        } catch {
            this.safeRemoveItem('activeReservation');
        }
    }

    this.auth.authError$.subscribe(err => {
      if (err) {
        this.stopGlobalPolling();
        this.clearActiveReservationInMemory();
      }
    });

    if (this.auth.getUserEmail()) {
        this.startGlobalPolling();
    }

    this.auth.userEmail$.subscribe(email => {
      if (email) {
        this.startGlobalPolling();
      } else {
        this.stopGlobalPolling();
        this.clearActiveReservationInMemory();
      }
    });

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      if (this.activeReservation && !this.snackRef) {
        this.showNotificationFromState();
      }
    });
  }

  // -------------------- POLLING GLOBAL --------------------

  private startGlobalPolling() {
    if (this.globalPollingSub && !this.globalPollingSub.closed) return;

    this.globalPollingSub = timer(0, this.pollingIntervalMs).subscribe(() => {
      // Doble verificación: si hay error de auth, no hacemos nada
      if (this.auth['errorSubject']?.value) { // Acceso seguro opcional o confiar en la suscripción de arriba
         this.stopGlobalPolling();
         return;
      }

      const email = this.auth.getUserEmail();
      if (!email) return;

      if (this.activeReservation) {
         this.checkActiveReservationStatus();
      } else {
         this.checkForNewOrReactivatedReservations();
      }
    });
  }

  private stopGlobalPolling() {
    this.globalPollingSub?.unsubscribe();
    this.globalPollingSub = undefined;
  }

  private checkActiveReservationStatus() {
      if (!this.activeReservation) return;
      this.reservationService.getReservationStatus(this.activeReservation.reservationId)
        .pipe(take(1))
        .subscribe({
          next: (res) => this.ngZone.run(() => this.handleBackendStatus(res)),
          error: (err) => {
             if (err.status === 404) {
                 this.finalizeCancellation(true, 'admin', false);
             } else if (err.status === 403 || err.status === 401) {
                 // 🛑 Detener inmediatamente si recibimos 403
                 this.stopGlobalPolling();
             }
          }
        });
  }

  private checkForNewOrReactivatedReservations() {
      this.reservationService.getMyReservations().pipe(take(1)).subscribe({
          next: (reservations) => {
              const pending = reservations.find(r => r.status === 'PENDING' || r.status === 'REACTIVATED');
              
              if (pending) {
                  this.ngZone.run(() => {
                      this.startPendingReservation(
                          pending.id,
                          pending.code,
                          pending.date,
                          pending.courtName,    
                          this.formatTime(pending.startTime), 
                          this.formatTime(pending.endTime),
                          pending.createdAt
                      );

                      if (pending.status === 'REACTIVATED') {
                          if (this.activeReservation && !this.activeReservation.reactivated) {
                              this.activeReservation.reactivated = true;
                              this.saveState();
                              this.showCriticalNotification('Tu reserva ha sido reactivada. Tienes 3 minutos.', 'warning', 5000);
                              this.reactivatedService.emitReactivation(pending.id);
                          }
                      }
                  });
              }
          },
          error: (err) => {
              if (err.status === 404) {
                  return;
              }
              if (err.status === 403 || err.status === 401) {
                  // 🛑 Detener polling inmediatamente al detectar bloqueo
                  this.stopGlobalPolling();
                  return;
              }
              console.error('Error polling reservations:', err);
          }
      });
  }

  // -------------------- MANEJO DE ESTADOS --------------------

  private handleBackendStatus(res: { status: string; courtName?: string; startTime?: string; endTime?: string; date?: string }) {
    const active = this.activeReservation;
    if (!active) return;

    switch(res.status) {
      case 'REACTIVATED':
        if (!active.reactivated) {
            this.reactivateReservation();
        } 
        this.handleMinorEdits(res); 
        break;
      case 'CANCELLED':
        this.finalizeCancellation(true, 'admin', true);
        break;
      case 'CONFIRMED':
        this.finalizeCancellation(true, 'server', true);
        break;
      default: // PENDING
        this.handleMinorEdits(res);
    }
  }

  private handleMinorEdits(res: { courtName?: string; startTime?: string; endTime?: string; date?: string }) {
    const active = this.activeReservation;
    if (!active) return;

    const norm = (s: string) => (s || '').trim();
    
    const cleanTime = (t: any) => {
       const str = this.formatTime(t);
       return str.length === 5 ? str : str.substring(0, 5);
    };

    const srvStart = cleanTime(res.startTime);
    const srvEnd = cleanTime(res.endTime);
    const locStart = cleanTime(active.startTime);
    const locEnd = cleanTime(active.endTime);

    const srvCourt = norm(res.courtName || '');
    const locCourt = norm(active.courtName);
    const srvDate = res.date ? res.date : active.date;

    const startChanged = srvStart && srvStart !== locStart;
    const endChanged = srvEnd && srvEnd !== locEnd;
    const courtChanged = srvCourt && srvCourt !== locCourt;
    const dateChanged = srvDate && srvDate !== active.date;

    if (startChanged || endChanged || courtChanged || dateChanged) {
      this.updateActiveReservation({
        courtName: res.courtName ?? active.courtName,
        date: res.date ?? active.date,
        startTime: srvStart || active.startTime,
        endTime: srvEnd || active.endTime
      });
      this.showCriticalNotification('La reserva fue modificada por el administrador.', 'info', 5000);
    }
  }

  // -------------------- PUBLIC API --------------------

  public checkServerForPendingReservations() {
      if (!this.globalPollingSub) this.startGlobalPolling();
      const email = this.auth.getUserEmail();
      if(email) this.checkForNewOrReactivatedReservations();
  }

  startPendingReservation(
    id: string, 
    code: string, 
    date: string,
    courtName: string, 
    startTime: string, 
    endTime: string,
    serverCreatedAt?: string 
  ) {
    const currentUserEmail = this.auth.getUserEmail();
    if (!currentUserEmail) return;

    if (this.activeReservation && this.activeReservation.reservationId === id) {
       if (!this.snackRef) this.showNotificationFromState();
       return; 
    }

    let expireAt: number;
    if (serverCreatedAt) {
      const createdTime = new Date(serverCreatedAt).getTime();
      expireAt = createdTime + (3 * 60 * 1000);
    } else {
      expireAt = Date.now() + (3 * 60 * 1000);
    }

    if (expireAt <= Date.now()) return;

    const saved = this.safeGetItem('activeReservation');
    let originalExpireAt = expireAt;
    let extended = false;
    let reactivated = false;

    if (saved) {
      try {
        const parsed: PendingData = JSON.parse(saved);
        if (parsed.userEmail === currentUserEmail && parsed.reservationId === id) {
            extended = parsed.extended;
            reactivated = parsed.reactivated ?? false;
            if (parsed.expireAt > Date.now()) {
                expireAt = parsed.expireAt;
            }
        }
      } catch {}
    }

    this.activeReservation = {
      userEmail: currentUserEmail,
      reservationId: id,
      reservationCode: code,
      date,
      courtName,
      startTime,
      endTime,
      expireAt,
      originalExpireAt, 
      extended,
      reactivated
    };

    this.saveState();
    this.showNotificationFromState();
    this.setAutoCancelTimer(expireAt - Date.now());
    this.ngZone.run(() => this.reservationStarted.next());
  }

  reactivateReservation() {
    if (!this.activeReservation) return;
    if (this.activeReservation.reactivated) return;

    const duration = 3 * 60 * 1000;
    this.activeReservation.expireAt = Date.now() + duration;
    this.activeReservation.originalExpireAt = this.activeReservation.expireAt;
    this.activeReservation.reactivated = true;
    this.activeReservation.extended = false;
    this.activeReservation.userEmail = this.auth.getUserEmail();

    this.saveState();

    this.ngZone.run(() => {
        this.updateSnackbarUI();
        this.setAutoCancelTimer(duration);
        this.reactivatedService.emitReactivation(this.activeReservation!.reservationId);
        this.showCriticalNotification('Reserva reactivada. Tienes 3 minutos.', 'warning', 5000);
    });
  }

  extendTimeOnce(extraMinutes = 5) {
    if (!this.activeReservation || this.activeReservation.extended || this.isCancelling) {
      if(this.activeReservation?.extended) this.notificationService.show('Ya se extendió una vez.', 'warning', 4000);
      return;
    }
    const extraMs = extraMinutes * 60 * 1000;
    this.activeReservation.expireAt = Date.now() + Math.max(0, this.activeReservation.expireAt - Date.now()) + extraMs;
    this.activeReservation.extended = true;
    this.saveState();
    this.resetTimersAndSnackbar(this.activeReservation.expireAt - Date.now());
    this.notificationService.show('Tiempo extendido por intento de pago.', 'warning', 5000);
  }
  
  onPaymentAttempt() { this.extendTimeOnce(5); }

  cancelReservation(auto = false) {
    if (!this.activeReservation || this.isCancelling) return;
    this.isCancelling = true;
    const id = this.activeReservation.reservationId;

    this.reservationService.cancelReservation(id).pipe(take(1)).subscribe({
        next: (res) => {
          if (res?.status === 'CONFIRMED') {
             this.notificationService.show('La reserva ya fue confirmada.', 'warning', 4000);
             this.finalizeCancellation(auto, 'manual', false); 
          } else {
             this.finalizeCancellation(auto, auto ? 'auto' : 'manual');
          }
        },
        error: () => {
          this.notificationService.show('Error al cancelar la reserva.', 'error', 4000);
          this.finalizeCancellation(auto, auto ? 'auto' : 'manual', false);
        }
      });
  }

  private finalizeCancellation(auto: boolean, reason: 'auto' | 'manual' | 'admin' | 'server', showMessage = true) {
    if (!this.activeReservation) return;
    const reservationId = this.activeReservation.reservationId;

    this.ngZone.run(() => {
      this.clearAllTimers(); 
      this.dismissSnackbar();
      this.reservationCancelled.next({ reservationId, reason });
      this.safeRemoveItem('activeReservation');
      this.activeReservation = null;
      this.isCancelling = false;

      if (showMessage) {
        switch(reason) {
          case 'admin': this.showCriticalNotification('Cancelada por administrador.', 'error', 5000); break;
          case 'server': this.showCriticalNotification('Reserva confirmada.', 'success', 5000); break;
          case 'manual': this.showCriticalNotification('Reserva cancelada.', 'warning', 3000); break;
          default: this.showCriticalNotification('Tiempo expirado.', 'error', 5000); break;
        }
      }
    });
  }

  // -------------------- UTILS & SNACKBAR --------------------

  private showNotificationFromState() {
      if (!this.activeReservation) return;
      const remaining = Math.max(0, this.activeReservation.expireAt - Date.now());
      this.showNotification(
          this.activeReservation.courtName, 
          this.activeReservation.date,
          this.activeReservation.startTime, 
          this.activeReservation.endTime, 
          remaining
      );
  }

  private showNotification(court: string, date: string, start: string, end: string, durationMs: number) {
    if (!this.activeReservation) return;
    if (this.snackRef) {
      this.updateSnackbarUI();
      this.startUiInterval();
      return;
    }
    const data: PendingSnackbarData = {
      reservationId: this.activeReservation.reservationId,
      reservationCode: this.activeReservation.reservationCode,
      courtName: court,
      date: date,
      startTime: start, 
      endTime: end, 
      expireAt: this.activeReservation.expireAt
    };
    this.snackRef = this.snackBar.openFromComponent(ReservationPendingSnackbarComponent, {
      data, horizontalPosition: 'end', verticalPosition: 'bottom', panelClass: ['reservation-card-snackbar'], duration: undefined
    });
    this.snackRef.instance.cancelClicked.subscribe(() => this.ngZone.run(() => this.router.navigate(['/cliente/mis-reservas'])));
    this.snackRef.afterDismissed().pipe(take(1)).subscribe(() => { this.snackRef = null; this.stopUiInterval(); });
    this.startUiInterval();
  }

  public updateActiveReservation(updated: any) {
      if (!this.activeReservation) return;
      this.activeReservation = { ...this.activeReservation, ...updated };
      this.saveState();
      this.updateSnackbarUI();
  }

  private updateSnackbarUI() {
      if (this.snackRef?.instance && this.activeReservation) {
          this.snackRef.instance.updateData(
            this.activeReservation.courtName,
            this.activeReservation.date,
            this.activeReservation.startTime,
            this.activeReservation.endTime,
            this.activeReservation.expireAt
          );
          const remaining = Math.max(0, this.activeReservation.expireAt - Date.now());
          this.snackRef.instance.updateRemaining(remaining);
      }
      this.updateSnackbar(); 
  }

  private resetTimersAndSnackbar(durationMs: number) {
    this.clearAllTimers();
    if (!this.activeReservation) return;
    this.activeReservation.expireAt = Date.now() + durationMs;
    this.saveState();
    this.showNotificationFromState();
    this.setAutoCancelTimer(durationMs);
  }

  private setAutoCancelTimer(durationMs: number) {
    this.autoCancelSub?.unsubscribe();
    this.autoCancelSub = timer(Math.max(0, durationMs)).subscribe(() => {
      if (this.activeReservation && !this.isCancelling && Date.now() >= this.activeReservation.expireAt) {
        this.ngZone.run(() => this.cancelReservation(true));
      }
    });
  }

  private startUiInterval() {
    this.stopUiInterval();
    this.ngZone.runOutsideAngular(() => {
        this.uiIntervalId = setInterval(() => {
            const remaining = this.activeReservation ? (this.activeReservation.expireAt - Date.now()) : 0;
            
            if (this.snackRef && this.snackRef.instance) {
                this.ngZone.run(() => {
                   if (!this.activeReservation || !this.snackRef) { this.stopUiInterval(); return; }
                   this.snackRef.instance.updateRemaining(Math.max(0, remaining));
                   if (remaining <= 0) this.stopUiInterval();
                });
            } else if (remaining <= 0) {
                 this.ngZone.run(() => this.stopUiInterval());
            }
        }, this.uiIntervalMs);
    });
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

  private stopUiInterval() { if (this.uiIntervalId) { clearInterval(this.uiIntervalId); this.uiIntervalId = null; } }
  
  private clearAllTimers() { 
      this.autoCancelSub?.unsubscribe(); 
      this.stopUiInterval(); 
  }

  private isBrowser() { return typeof window !== 'undefined' && typeof localStorage !== 'undefined'; }
  private safeGetItem(key: string) { if(!this.isBrowser()) return null; try { return localStorage.getItem(key); } catch { return null; } }
  private safeSetItem(key: string, value: string) { if(!this.isBrowser()) return; try { localStorage.setItem(key, value); } catch { } }
  private safeRemoveItem(key: string) { if(!this.isBrowser()) return; try { localStorage.removeItem(key); } catch { } }
  private saveState() { if(!this.activeReservation) return; try { this.safeSetItem('activeReservation', JSON.stringify(this.activeReservation)); } catch { } }
  
  private showCriticalNotification(msg: string, type: 'success'|'warning'|'error'|'info', duration = 4000) {
    if (this.lastCriticalMessage === msg) return;
    this.lastCriticalMessage = msg;
    this.notificationService.show(msg, type, duration);
    setTimeout(() => { this.lastCriticalMessage = null; }, duration);
  }

  private formatTime(timeArr: any): string {
      if (Array.isArray(timeArr)) return `${timeArr[0]}:${timeArr[1].toString().padStart(2, '0')}`;
      return timeArr || '';
  }

  ngOnDestroy(): void { 
    this.stopGlobalPolling(); 
    this.clearAllTimers(); 
  }

  clearActiveReservationInMemory() {
    this.clearAllTimers();
    this.dismissSnackbar();
    this.activeReservation = null;
    this.isCancelling = false;
  }

  logoutAndClearReservation() { 
      this.stopGlobalPolling();
      this.clearActiveReservationInMemory(); 
  }
  
  forceCloseReservation() { this.clearActiveReservationInMemory(); this.safeRemoveItem('activeReservation'); }
  revertExtension() { if(!this.activeReservation) return; this.activeReservation.expireAt = this.activeReservation.originalExpireAt; this.activeReservation.extended = false; this.saveState(); this.updateSnackbarUI(); }
  closeLocalReservation() { this.clearActiveReservationInMemory(); this.safeRemoveItem('activeReservation'); }
  getRemainingTime(id: string): number | null { return this.activeReservation?.reservationId === id ? Math.max(0, this.activeReservation.expireAt - Date.now()) : null; }
  hasActiveReservation() { return !!this.activeReservation; }
  getActiveReservation() { return this.activeReservation; }
}