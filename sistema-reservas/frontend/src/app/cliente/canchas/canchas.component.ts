import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/notificaciones/notification.service';
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

  isSubmitting = false; // evita doble envío

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private notify: NotificationService,
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
      // actualizar lista si es necesario
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
    if (this.reservationPendingService.hasActiveReservation()) {
      this.showError('Ya tienes una reserva pendiente. Confírma o espera que caduque antes de crear otra.', 'warning');
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

    // Evitar múltiples reservas pendientes
    if (this.reservationPendingService.hasActiveReservation()) {
      this.showError(
        'Ya tienes una reserva pendiente activa. Confirma o espera que caduque antes de crear otra.',
        'warning'
      );
      return;
    }

    // Validar campos
    if (!this.reservationDate || !this.startTime || !this.endTime) {
      this.showError('Completa fecha, hora de inicio y hora de fin.', 'warning');
      return;
    }

    const nowUTC = new Date();

    // Función para convertir "YYYY-MM-DD" + "HH:mm" a UTC Date
    const parseTimeUTC = (dateStr: string, timeStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      return new Date(Date.UTC(year, month - 1, day, hour, minute));
    };

    // Función para formatear hora local para mostrar en snackbar o ReservationPendingService
    const formatTimeLocal = (dateStr: string, timeStr: string): string => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const startUTC = parseTimeUTC(this.reservationDate, this.startTime);
    const endUTC = parseTimeUTC(this.reservationDate, this.endTime);

    // Validación: mínimo 10 minutos de anticipación
    if ((startUTC.getTime() - nowUTC.getTime()) / (1000 * 60) < 10) {
      this.showError('Debes reservar con al menos 10 minutos de anticipación.', 'warning');
      return;
    }

    // Validación: duración mínima 1 hora
    if ((endUTC.getTime() - startUTC.getTime()) / (1000 * 60 * 60) < 1) {
      this.showError('La duración mínima de la reserva es de 1 hora.', 'warning');
      return;
    }

    const userId = this.auth.getUserId();
    if (!userId) {
      this.showError('Usuario no detectado.', 'error');
      return;
    }

    const payload = {
      userId,
      courtId: this.selectedCourt.id,
      date: this.reservationDate,
      startTime: this.startTime.length === 5 ? `${this.startTime}:00` : this.startTime,
      endTime: this.endTime.length === 5 ? `${this.endTime}:00` : this.endTime,
    };

    this.isSubmitting = true;

    this.http.post<any>('http://localhost:8080/api/reservations', payload).subscribe({
      next: reservation => {
        // Convertir a hora local para mostrar en snackbar / ReservationPendingService
        const startLocal = formatTimeLocal(reservation.date, reservation.startTime);
        const endLocal = formatTimeLocal(reservation.date, reservation.endTime);

        this.reservationPendingService.startPendingReservation(
          reservation.id,
          reservation.code,
          3 * 60 * 1000, // duración del pending
          this.selectedCourt!.name,
          startLocal,
          endLocal
        );

        this.closeModal();
        this.isSubmitting = false;
        this.showError(`Reserva creada correctamente: ${startLocal} - ${endLocal}`, 'success');
      },
      error: err => {
        const message = err.error?.message || 'No se pudo crear la reserva.';
        this.showError(message, 'error');
        this.isSubmitting = false;
      }
    });
  }


  showError(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }
}
