import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NotificationComponent } from "./shared/notificaciones/notificaciones.component";
import { ReservationPendingService } from './services/reservation/reservation-pending.service';
import { ReservationReactivatedService } from './services/reservation/reservation-reactivated.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HttpClientModule, RouterModule, NotificationComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  protected readonly title = signal('frontend');

  // Al inyectarse, ya se ejecuta restorePreviousState() en el constructor del servicio
  private readonly reservationPendingService = inject(ReservationPendingService);
  private readonly reservationReactivatedService = inject(ReservationReactivatedService);

  ngOnInit() {
    // No hace falta llamar a nada, los servicios ya se inicializan por sí solos
  }
}
