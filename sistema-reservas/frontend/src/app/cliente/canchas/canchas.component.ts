import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReservationPendingService } from '../../services/reservation-pending.service';

const API_URL = 'http://localhost:8080/api';

interface CourtDTO {
  id: string;
  code: string;
  name: string;
  description?: string;
  sportType: string;
  pricePerHour: number;
}

@Component({
  selector: 'app-canchas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './canchas.html',
  styleUrls: ['./canchas.scss'],
})
export class CanchasClienteComponent implements OnInit {
  courts: CourtDTO[] = [];
  filteredCourts: CourtDTO[] = [];
  searchTerm = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  isSidePanelClosed = true;
  manualClose = false;
  userEmail = '';
  userRole = '';

  showModal = false;
  selectedCourt: CourtDTO | null = null;
  reservationDate!: string;
  startTime!: string;
  endTime!: string;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private reservationPendingService: ReservationPendingService
  ) {
    this.userEmail = this.auth.getUserEmail() || 'cliente@correo.com';
    this.userRole = this.auth.getUserRole() || 'CLIENTE';
  }

  ngOnInit() {
    this.loadCourts();

    // Restaurar reserva pendiente si existe
    const active = this.reservationPendingService.getActiveReservation();
    if (active) {
      const remaining = active.expireAt - Date.now();
      this.reservationPendingService.startPendingReservation(
        active.reservationId,
        active.reservationCode,
        remaining,
        active.courtName,
        active.startTime,
        active.endTime
      );
    }

    this.reservationPendingService.reservationCancelled.subscribe(() => {
      //Si se cancela la reserva, puedes actualizar lista de canchas si es necesario
    });
  }

  toggleSidePanel() {
    this.manualClose = !this.manualClose;
    this.isSidePanelClosed = this.manualClose;
  }

  hoverPanel(state: boolean) {
    if (!this.manualClose) this.isSidePanelClosed = !state;
  }

  logout() {
    this.auth.logout();
    location.href = '/login';
  }

  loadCourts() {
    this.http.get<CourtDTO[]>(`${API_URL}/courts`).subscribe((res: CourtDTO[]) => {
      this.courts = res;
      this.filteredCourts = [...this.courts];
    });
  }

  filterCourts() {
    const term = this.searchTerm.toLowerCase();
  
    let results = this.courts.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      c.sportType.toLowerCase().includes(term) ||
      c.pricePerHour.toString().includes(term) // permite buscar por precio
    );
  
    // Aplica ordenamiento si corresponde
    results.sort((a, b) =>
      this.sortDirection === 'asc'
        ? a.pricePerHour - b.pricePerHour
        : b.pricePerHour - a.pricePerHour
    );
  
    this.filteredCourts = results;
  }

  toggleSort() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.filterCourts();
  }
  
  search() {
    this.filterCourts();
  }

  openReservationModal(court: CourtDTO) {
    if (this.reservationPendingService.hasActiveReservation()) {
      this.showError('Ya tienes una reserva pendiente. Confírma o espera que caduque antes de crear otra.');
      return;
    }
    this.selectedCourt = court;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  confirmReservation() {
    if (!this.selectedCourt) return;

    if (this.reservationPendingService.hasActiveReservation()) {
      this.showError('Ya tienes una reserva pendiente. Confírma o espera que caduque antes de crear otra.');
      return;
    }

    if (!this.reservationDate || !this.startTime || !this.endTime) {
      this.showError('Debes completar fecha, hora de inicio y hora de fin.');
      return;
    }

    const start = new Date(`${this.reservationDate}T${this.startTime}`);
    const end = new Date(`${this.reservationDate}T${this.endTime}`);
    if (start >= end) {
      this.showError('La hora de inicio debe ser menor que la hora de fin.');
      return;
    }
    if (start < new Date()) {
      this.showError('La fecha y hora de inicio no pueden ser anteriores al momento actual.');
      return;
    }

    const userId = this.auth.getUserId();
    if (!userId) {
      this.showError('No hay usuario logueado. Por favor, inicia sesión.');
      return;
    }

    const payload = {
      userId,
      courtId: this.selectedCourt.id,
      date: this.reservationDate,
      startTime: this.startTime,
      endTime: this.endTime,
      status: 'PENDING'
    };

    this.http.post<any>(`${API_URL}/reservations`, payload).subscribe({
      next: (reservation: any) => {
        // Solo 3 minutos para confirmar
        this.reservationPendingService.startPendingReservation(
          reservation.id,
          reservation.code,
          3 * 60 * 1000,
          this.selectedCourt!.name,
          this.startTime,
          this.endTime
        );
        this.closeModal();
      },
      error: (err: any) => {
        const message = err.error || 'No se pudo crear la reserva';
        this.showError(message);
      }
    });
  }

  showError(msg: string) {
    this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
  }
}
