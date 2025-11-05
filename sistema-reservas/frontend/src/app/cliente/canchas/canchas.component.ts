import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { ReservationPendingService } from '../../services/reservation/reservation-pending.service';

interface CourtDTO {
  id: string;
  code: string;
  name: string;
  description?: string;
  sportType: string;
  pricePerHour: number;
}

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
  selector: 'app-canchas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './canchas.html',
  styleUrls: ['./canchas.scss'],
})
export class CanchasClienteComponent implements OnInit, OnDestroy {
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
  isSubmitting = false;

  sortDirection: 'asc' | 'desc' = 'asc';
  paginatedCourts: CourtDTO[] = [];
  selectedCourts: CourtDTO[] = [];
  selectAllPage = false;
  selectAllGlobal = false;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  private subs = new Subscription();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private notify: NotificationService,
    private reservationPendingService: ReservationPendingService,
    private ngZone: NgZone
  ) {
    this.userEmail = this.auth.getUserEmail() || 'cliente@correo.com';
    this.userRole = this.auth.getUserRole() || 'CLIENTE';
  }

  ngOnInit() {
    this.loadCourts();

    // -------------------- Escuchar eventos de reservas pendientes --------------------

    const reservationSub = this.reservationPendingService.reservationCancelled
      .subscribe(({ reservationId, reason }) => {
        const msg = reason === 'auto'
          ? `Tu reserva pendiente ha expirado automáticamente.`
          : `La reserva fue cancelada correctamente.`;
        this.showError(msg, 'error');
      });

    const reactivatedSub = this.reservationPendingService.reservationStarted
    .subscribe(() => {
      const active = this.reservationPendingService.getActiveReservation();
      if (!active) return;

      this.ngZone.run(() => {
        // Mostrar notificación de reactivación
        if (active.reactivated) {
          this.showError(
            `Tu reserva ha sido reactivada. Tienes 3 minutos para confirmar.`,
            'warning'
          );
        }

        // Comparación segura con localStorage para cambios de reserva
        const localSaved = localStorage.getItem('activeReservation');
        if (!localSaved) return;

        try {
          const parsed = JSON.parse(localSaved);

          const normalize = (s: string) =>
            (s || '')
              .trim()
              .toLowerCase()
              .replace(/\./g, '')
              .replace(/\s+/g, '');

          const hasChanged =
            normalize(parsed.courtName) !== normalize(active.courtName) ||
            normalize(parsed.startTime) !== normalize(active.startTime) ||
            normalize(parsed.endTime) !== normalize(active.endTime);

          if (hasChanged) {
            this.showError(
              `La reserva ha sido modificada por el administrador.`,
              'info'
            );

            //Actualizar reserva activa y forzar refresco del snackbar
            this.reservationPendingService.updateActiveReservation({
              courtName: active.courtName,
              startTime: active.startTime,
              endTime: active.endTime,
            });

            // Forzar actualización visual inmediata
            const snackRef = (this.reservationPendingService as any).snackRef;
            if (snackRef?.instance?.updateData) {
              snackRef.instance.updateData(
                active.courtName,
                active.startTime,
                active.endTime
              );
            }
          }
        } catch (err) {
          console.warn('Error comparando reservas locales:', err);
        }
      });
    });

    this.subs.add(reservationSub);
    this.subs.add(reactivatedSub);
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  // Panel lateral
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

  // Cargar y filtrar canchas
  loadCourts() {
    this.http.get<CourtDTO[]>('http://localhost:8080/api/courts').subscribe({
      next: res => {
        this.ngZone.run(() => {
          this.courts = res;
          this.filteredCourts = [...res];
          this.totalPages = Math.ceil(this.filteredCourts.length / this.pageSize);
          this.currentPage = 1;
          this.setPaginatedCourts();
        });
      },
      error: err => {
        console.error('Error al cargar canchas:', err);
        this.notify.show('No se pudieron cargar las canchas.', 'error');
      }
    });
  }

  private normalizeString(str: string): string {
    return str
      .normalize('NFD')              // descompone caracteres con acentos
      .replace(/[\u0300-\u036f]/g, '') // elimina los diacríticos
      .toLowerCase();
  }

  filterCourts() {
    const term = this.normalizeString(this.searchTerm);

    let results = this.courts.filter(c =>
      this.normalizeString(c.name).includes(term) ||
      this.normalizeString(c.code).includes(term) ||
      this.normalizeString(c.sportType).includes(term) ||
      c.pricePerHour.toString().includes(term)
    );

    results.sort((a,b) =>
      this.sortDirection === 'asc'
        ? a.pricePerHour - b.pricePerHour
        : b.pricePerHour - a.pricePerHour
    );

    this.filteredCourts = results;
    this.totalPages = Math.ceil(results.length / this.pageSize);
    this.currentPage = 1; 
    this.setPaginatedCourts();
  }

  toggleSortByPrice() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.filterCourts();
  }

  setPaginatedCourts() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedCourts = this.filteredCourts.slice(start, start + this.pageSize);
  }

  get selectedCount(): number {
    return this.selectedCourts.length;
  }

  // Paginación
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.setPaginatedCourts();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.setPaginatedCourts();
    }
  }

  // Modal de reserva
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
    if (this.isSubmitting) return;
    if (!this.selectedCourt) return;

    if (!this.reservationDate || !this.startTime || !this.endTime) {
      this.showError('Completa la fecha, hora de inicio y hora de fin.', 'warning');
      return;
    }

    const now = new Date();

    // 🗓 Convierte fecha (string) y hora (HH:mm) a Date local real (sin UTC)
    const toLocalDate = (dateStr: string, timeStr: string): Date => {
      let year: number, month: number, day: number;
      if (dateStr.includes('/')) [day, month, year] = dateStr.split('/').map(Number);
      else [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute);
    };

    const startLocal = toLocalDate(this.reservationDate, this.startTime);
    const endLocal = toLocalDate(this.reservationDate, this.endTime);

    // --------------------------------------
    // 🕓 Validaciones de tiempo
    // --------------------------------------
    if (endLocal <= startLocal) {
      this.showError('La hora de fin debe ser mayor que la de inicio.', 'warning');
      return;
    }

    if (startLocal < now) {
      this.showError('No puedes reservar una fecha u hora pasada.', 'warning');
      return;
    }

    const diffMinutes = (startLocal.getTime() - now.getTime()) / (1000 * 60);
    if (diffMinutes < 10) {
      this.showError('Debes reservar con al menos 10 minutos de anticipación.', 'warning');
      return;
    }

    const duration = (endLocal.getTime() - startLocal.getTime()) / (1000 * 60);
    if (duration < 60) {
      this.showError('La duración mínima es de 1 hora.', 'warning');
      return;
    }

    const userId = this.auth.getUserId();
    if (!userId) {
      this.showError('Usuario no detectado.', 'error');
      return;
    }

    this.isSubmitting = true;

    // --------------------------------------
    // 🔍 Verificar choques con otras reservas
    // --------------------------------------
    const formattedDate = this.reservationDate.includes('/')
      ? this.reservationDate.split('/').reverse().join('-')
      : this.reservationDate;

    this.http.get<ReservationDTO[]>(
      `http://localhost:8080/api/reservations/court/${this.selectedCourt.id}?date=${formattedDate}`
    ).subscribe({
      next: (reservations) => {
        const relevant = reservations.filter(r =>
          ['PENDING', 'CONFIRMED', 'REACTIVATED', 'FINISHED'].includes(r.status)
        );

        const toMinutes = (time: string) => {
          const [h, m] = time.split(':').map(Number);
          return h * 60 + m;
        };

        const newStart = toMinutes(this.startTime);
        const newEnd = toMinutes(this.endTime);

        const overlapping = relevant.filter(r => {
          const rStart = toMinutes(r.startTime);
          const rEnd = toMinutes(r.endTime);
          return newStart < rEnd && rStart < newEnd;
        });

        if (overlapping.length > 0) {
          const closest = overlapping[0];
          this.showError(
            `No puedes reservar esta cancha. Ya existe una reserva ${closest.status.toLowerCase()} de ${this.formatTime12(closest.startTime)} a ${this.formatTime12(closest.endTime)}.`,
            'warning'
          );
          this.isSubmitting = false;
          return;
        }

        this.createReservation(userId.toString(), formattedDate);
      },
      error: (err) => {
        console.error(err);
        this.showError('No se pudo verificar la disponibilidad de la cancha.', 'error');
        this.isSubmitting = false;
      }
    });
  }


  private createReservation(userId: string, formattedDate: string) {
    const pad = (n: number) => n.toString().padStart(2, '0');

    const normalizeDate = (dateStr: string): string => {
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/').map(Number);
        return `${y}-${pad(m)}-${pad(d)}`;
      }
      return dateStr;
    };

    const payload = {
      userId: Number(userId),
      courtId: this.selectedCourt!.id,
      date: normalizeDate(formattedDate),
      startTime: this.startTime, // ya en HH:mm
      endTime: this.endTime,     // ya en HH:mm
    };

    console.log('📦 Enviando payload local (HH:mm):', payload);

    this.http.post<any>('http://localhost:8080/api/reservations', payload).subscribe({
      next: (reservation) => {
        this.ngZone.run(() => {
          this.reservationPendingService.startPendingReservation(
            reservation.id,
            reservation.code,
            3 * 60 * 1000,
            this.selectedCourt!.name,
            reservation.startTime,
            reservation.endTime
          );

          this.closeModal();
          this.isSubmitting = false;
          this.showError(
            `Reserva creada correctamente: ${this.formatTime12(reservation.startTime)} - ${this.formatTime12(reservation.endTime)}.`,
            'success'
          );
        });
      },
      error: (err) => {
        console.error('❌ Error al crear reserva:', err);
        let message = 'No se pudo crear la reserva. Verifica los datos.';
        if (err.error?.message) message = err.error.message;
        this.showError(message, 'error');
        this.isSubmitting = false;
      }
    });
  }


  // 🕑 Formato de hora amigable
  private formatTime12(timeStr: string): string {
    const [hourStr, minuteStr] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }

  //Notificaciones
  private showError(msg: string, type: 'error' | 'warning' | 'success' | 'info' = 'error') {
    this.ngZone.run(() => this.notify.show(msg, type, 5000));
  }
}
