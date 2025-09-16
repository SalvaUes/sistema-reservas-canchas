import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReservationPendingService } from '../../services/reservation-pending.service';

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
    private router: Router,
    private snackBar: MatSnackBar,
    private reservationPendingService: ReservationPendingService
  ) {
    this.userEmail = this.auth.getUserEmail() || 'cliente@correo.com';
    this.userRole = this.auth.getUserRole() || 'CLIENTE';
  }

  ngOnInit() {
    this.loadCourts();
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
    this.http.get<CourtDTO[]>('http://localhost:8080/api/courts').subscribe(res => {
      this.courts = res;
      this.filteredCourts = [...this.courts];
    });
  }

  filterCourts() {
    const term = this.searchTerm.toLowerCase();
    this.filteredCourts = this.courts.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      c.sportType.toLowerCase().includes(term)
    );
  }

  search() {
    this.filterCourts();
  }

  openReservationModal(court: CourtDTO) {
    this.selectedCourt = court;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  confirmReservation() {
    if (!this.selectedCourt) return;
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

    this.http.post<any>('http://localhost:8080/api/reservations', payload).subscribe({
      next: reservation => {
        // Inicia temporizador con ReservationPendingService
        this.reservationPendingService.startPendingReservation(
          reservation.id,
          15 * 60 * 1000,
          this.selectedCourt!.name,
          this.startTime,
          this.endTime
        );
        this.closeModal();
      },
      error: err => {
        const message = err.error || 'No se pudo crear la reserva';
        this.showError(message);
      }
    });
  }

  showError(msg: string) {
    this.snackBar.open(msg, 'Cerrar', { duration: 5000 });
  }
}
