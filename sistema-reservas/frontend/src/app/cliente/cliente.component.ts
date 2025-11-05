import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ReservationPendingService } from '../services/reservation/reservation-pending.service';
import { ReservationReactivatedService } from '../services/reservation/reservation-reactivated.service';
import { NotificationService } from './../shared/notificaciones/notification.service';

interface UserInfo {
  email: string | null;
  role: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './cliente.html',
  styleUrls: ['./cliente.scss']
})
export class ClienteComponent implements OnInit, OnDestroy {
  isSidePanelClosed = true;
  manualClose = false;
  user$!: Observable<UserInfo>;
  private subs = new Subscription();

  constructor(
    private auth: AuthService,
    private router: Router,
    private pendingService: ReservationPendingService,
    private reactivatedService: ReservationReactivatedService,
    private notificationService: NotificationService
  ) {}

   ngOnInit() {
    // Observables de usuario
    this.user$ = combineLatest([this.auth.userEmail$, this.auth.userRole$])
      .pipe(map(([email, role]): UserInfo => ({ email, role })));

    // -------------------- Escuchar eventos de reservas --------------------

    // Cancelación (automática, manual o por admin)
    const cancelSub = this.pendingService.reservationCancelled.subscribe(({ reservationId, reason }) => {
      let msg = '';
      switch (reason) {
        case 'auto':
          msg = `Tu reserva pendiente ha expirado automáticamente.`;
          break;
        case 'admin':
          msg = `Tu reserva fue cancelada por el administrador.`;
          break;
        case 'manual':
        default:
          msg = `La reserva pendiente fue cancelada.`;
          break;
      }
      this.notificationService.show(msg, 'error', 5000);
    });

    // Reactivación emitida por pendingService
    const reactivatedSub = this.pendingService.reservationStarted.subscribe(() => {
      const active = this.pendingService.getActiveReservation();
      if (!active) return;

      if (active.reactivated) {
        this.notificationService.show(
          `Tu reserva ha sido reactivada. Tienes 3 minutos para confirmarla.`,
          'success',
          5000
        );
      }

      // Detectar cambios menores desde localStorage
      const saved = localStorage.getItem('activeReservation');
      if (!saved) return;

      try {
        const parsed = JSON.parse(saved);

        const normalize = (s: string) => (s || '').trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
        const hasChanged =
          normalize(parsed.courtName) !== normalize(active.courtName) ||
          normalize(parsed.startTime) !== normalize(active.startTime) ||
          normalize(parsed.endTime) !== normalize(active.endTime);

        if (hasChanged) {
          this.notificationService.show(
            `Tu reserva ha sido modificada por el administrador.`,
            'info',
            4000
          );

          // Actualizar reserva activa y forzar refresco visual si es necesario
          this.pendingService.updateActiveReservation({
            courtName: active.courtName,
            startTime: active.startTime,
            endTime: active.endTime,
          });
        }
      } catch (err) {
        console.warn('Error comparando reservas locales:', err);
      }
    });

    // Reactivación detectada por reactivatedService (opcional, eventos externos)
    const externalReactivatedSub = this.reactivatedService.reservationReactivated.subscribe(event => {
      if (event.reactived) {
        this.notificationService.show(
          `Tu reserva fue reactivada correctamente. Tienes 3 minutos para confirmarla.`,
          'success',
          5000
        );
      } else if (event.cancelled) {
        this.notificationService.show(
          `La reserva fue cancelada por el administrador.`,
          'error',
          5000
        );
      }
    });

    // -------------------- Guardar subscripciones --------------------
    this.subs.add(cancelSub);
    this.subs.add(reactivatedSub);
    this.subs.add(externalReactivatedSub);
  }

  ngOnDestroy() {
    this.subs.unsubscribe(); // cancela todas las suscripciones
  }


  toggleSidePanel() {
    this.manualClose = !this.manualClose;
    this.isSidePanelClosed = this.manualClose;
  }

  hoverPanel(state: boolean) {
    if (!this.manualClose) {
      this.isSidePanelClosed = !state;
    }
  }

  logout() {
    this.pendingService.logoutAndClearReservation();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
