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

    // Restaurar estado de reservas pendientes
    this.pendingService.checkServerForPendingReservations();

    // Suscripciones para mantener vivos los observadores
    this.subs.add(this.pendingService.reservationCancelled.subscribe(() => {}));
    this.subs.add(this.pendingService.reservationStarted.subscribe(() => {}));

    // Notificación de reactivación
    this.subs.add(
      this.reactivatedService.reservationReactivated.subscribe(event => {
        if (event.reactived) {
          this.notificationService.show(
            'Tu reserva ha sido reactivada por el administrador. Tienes 3 minutos para confirmar.',
            'warning',
            5000
          );
        }
      })
    );
  }

  ngOnDestroy() { this.subs.unsubscribe(); }
  
  logout() {
    this.pendingService.logoutAndClearReservation();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}