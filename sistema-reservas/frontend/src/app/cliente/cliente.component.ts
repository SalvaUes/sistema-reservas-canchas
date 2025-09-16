// cliente.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { ReservationPendingService } from '../services/reservation-pending.service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ReservationDTO {
  id: string;
  code: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './cliente.html',
  styleUrls: ['./cliente.scss']
})
export class ClienteComponent implements OnInit {
  isSidePanelClosed = true;
  manualClose = false;

  user$!: Observable<{ email: string | null; role: string | null }>;

  constructor(
    private auth: AuthService,
    private router: Router,
    private http: HttpClient,
    private pendingService: ReservationPendingService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Inicializamos los observables de usuario
    this.user$ = combineLatest([this.auth.userEmail$, this.auth.userRole$]).pipe(
      map(([email, role]) => ({ email, role }))
    );

    // Mostrar reserva pendiente si existe
    this.loadPendingReservation();

    // Recarga solo una vez al entrar a /cliente
    if (!sessionStorage.getItem('clienteReloaded')) {
      sessionStorage.setItem('clienteReloaded', 'true');
      location.reload();
    }

    // Escuchar cancelación automática de reserva
    this.pendingService.reservationCancelled.subscribe(() => {
      this.snackBar.open('⏱️ Tu reserva pendiente ha expirado', 'Cerrar', { duration: 5000 });
    });
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
    this.auth.logout();
    location.href = '/login';
  }

  /** Carga reservas pendientes y muestra snackbar */
  private loadPendingReservation() {
    const userId = this.auth.getUserId();
    if (!userId) return;

    this.http.get<ReservationDTO[]>(`http://localhost:8080/api/reservations/user/${userId}`)
      .subscribe(res => {
        const pending = res.find(r => r.status === 'PENDING');

        // Solo mostrar si no hay reserva activa
        if (pending && !this.pendingService.hasActiveReservation()) {
          const remaining = this.pendingService.getRemainingTime(pending.id) ?? 60000;

          this.pendingService.startPendingReservation(
            pending.id,
            pending.code,
            remaining,
            pending.courtName,
            pending.startTime,
            pending.endTime
          );
        }
      });
  }
}
