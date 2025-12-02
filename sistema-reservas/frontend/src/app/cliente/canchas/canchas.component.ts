import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { ReservationPendingService } from '../../services/reservation/reservation-pending.service';
import { ReservationService } from '../../services/reservation/reservation.service';
import { environment } from '../../../environments/environment';

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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanchasClienteComponent implements OnInit, OnDestroy {
  courts: CourtDTO[] = [];
  filteredCourts: CourtDTO[] = [];
  searchTerm = '';

  showModal = false;
  selectedCourt: CourtDTO | null = null;
  reservationDate!: string;
  startTime!: string;
  endTime!: string;
  isSubmitting = false;

  sortDirection: 'asc' | 'desc' = 'asc';
  paginatedCourts: CourtDTO[] = [];
  selectedCourts: CourtDTO[] = [];
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  private subs = new Subscription();
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private reservationService: ReservationService, 
    public auth: AuthService,
    private notify: NotificationService,
    private reservationPendingService: ReservationPendingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadCourts();
    
    this.subs.add(this.reservationPendingService.reservationCancelled.subscribe(() => {
        this.loadCourts();
    }));
    
    this.subs.add(this.reservationPendingService.reservationStarted.subscribe(() => {
        this.checkLocalUpdates();
    }));
  }

  private checkLocalUpdates() {
      const active = this.reservationPendingService.getActiveReservation();
      if(active) {
         const localSaved = localStorage.getItem('activeReservation');
         if(localSaved) {
            try {
               const parsed = JSON.parse(localSaved);
               const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
               if(norm(parsed.courtName) !== norm(active.courtName)) {
                   this.reservationPendingService.updateActiveReservation({ courtName: active.courtName });
               }
            } catch {}
         }
      }
      this.cdr.markForCheck();
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  logout() { 
    this.auth.logout(); 
  }

  loadCourts() {
    this.http.get<CourtDTO[]>(`${this.apiUrl}/courts`).subscribe({
      next: res => {
        this.courts = res;
        this.filteredCourts = [...res];
        this.totalPages = Math.ceil(this.filteredCourts.length / this.pageSize);
        this.currentPage = 1;
        this.setPaginatedCourts();
        this.cdr.markForCheck();
      },
      error: () => {
        this.notify.show('No se pudieron cargar las canchas.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  private normalizeString(str: string): string { 
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); 
  }
  
  filterCourts() {
    const term = this.normalizeString(this.searchTerm);
    let results = this.courts.filter(c =>
      this.normalizeString(c.name).includes(term) ||
      this.normalizeString(c.code).includes(term) ||
      this.normalizeString(c.sportType).includes(term) ||
      c.pricePerHour.toString().includes(term)
    );
    results.sort((a,b) => this.sortDirection === 'asc' ? a.pricePerHour - b.pricePerHour : b.pricePerHour - a.pricePerHour);
    this.filteredCourts = results;
    this.totalPages = Math.ceil(results.length / this.pageSize);
    this.currentPage = 1; 
    this.setPaginatedCourts();
    this.cdr.markForCheck();
  }

  toggleSortByPrice() { 
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'; 
    this.filterCourts(); 
  }
  
  setPaginatedCourts() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedCourts = this.filteredCourts.slice(start, start + this.pageSize);
    this.cdr.markForCheck();
  }

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

  openReservationModal(court: CourtDTO) {
    if (this.reservationPendingService.hasActiveReservation()) {
      this.notify.show('Ya tienes una reserva pendiente. Confírma o espera que caduque.', 'warning');
      return;
    }
    this.selectedCourt = court;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal() { 
    this.showModal = false; 
    this.cdr.markForCheck();
  }

  confirmReservation() {
    if (this.isSubmitting) return;
    if (!this.selectedCourt || !this.reservationDate || !this.startTime || !this.endTime) {
      this.notify.show('Completa todos los campos.', 'warning');
      return;
    }

    const now = new Date();
    const toLocalDate = (dateStr: string, timeStr: string): Date => {
      let year, month, day;
      if (dateStr.includes('/')) [day, month, year] = dateStr.split('/').map(Number);
      else [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute);
    };

    const startLocal = toLocalDate(this.reservationDate, this.startTime);
    const endLocal = toLocalDate(this.reservationDate, this.endTime);

    if (endLocal <= startLocal) { this.notify.show('La hora de fin debe ser mayor que la de inicio.', 'warning'); return; }
    if (startLocal < now) { this.notify.show('No puedes reservar una fecha u hora pasada.', 'warning'); return; }
    if ((startLocal.getTime() - now.getTime()) / 60000 < 10) { this.notify.show('Debes reservar con al menos 10 minutos de anticipación.', 'warning'); return; }
    if ((endLocal.getTime() - startLocal.getTime()) / 60000 < 60) { this.notify.show('La duración mínima es de 1 hora.', 'warning'); return; }

    const userEmail = this.auth.getUserEmail();
    if (!userEmail) { 
        this.notify.show('Sesión no válida o usuario no identificado.', 'error'); 
        return; 
    }

    this.isSubmitting = true;
    this.cdr.markForCheck(); // Actualizar estado botón

    const formattedDate = this.reservationDate.includes('/') ? this.reservationDate.split('/').reverse().join('-') : this.reservationDate;

    this.reservationService.getReservationsByCourtAndDate(this.selectedCourt.id, formattedDate).subscribe({
      next: (reservations) => {
        const relevant = reservations.filter(r => ['PENDING', 'CONFIRMED', 'REACTIVATED', 'FINISHED'].includes(r.status));
        
        const toMinutes = (time: string) => { 
            const [h, m] = time.split(':').map(Number); 
            return h * 60 + m; 
        };
        const newStart = toMinutes(this.startTime);
        const newEnd = toMinutes(this.endTime);

        const overlapping = relevant.filter(r => {
          const rStart = toMinutes(r.startTime);
          const rEnd = toMinutes(r.endTime);
          return newStart < rEnd && newEnd > rStart;
        });

        if (overlapping.length > 0) {
          overlapping.sort((a, b) => a.startTime.localeCompare(b.startTime));
          const conflict = overlapping[0];
          const startStr = this.formatTime12(conflict.startTime);
          const endStr = this.formatTime12(conflict.endTime);

          this.notify.show(`Ya existe una reserva de ${startStr} a ${endStr}. Elige otro horario.`, 'warning', 6000);
          this.isSubmitting = false;
          this.cdr.markForCheck();
          return;
        }
        
        this.createReservation(formattedDate);
      },
      error: () => {
        this.notify.show('Error al verificar disponibilidad.', 'error');
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  private createReservation(formattedDate: string) {
    const payload = { 
        courtId: this.selectedCourt!.id, 
        date: formattedDate, 
        startTime: this.startTime, 
        endTime: this.endTime 
    };

    this.reservationService.createReservation(payload).subscribe({
      next: (reservation) => {
          this.reservationPendingService.startPendingReservation(
            reservation.id, 
            reservation.code, 
            reservation.date,  
            this.selectedCourt!.name, 
            reservation.startTime, 
            reservation.endTime, 
            (reservation as any).createdAt 
          );

          this.closeModal();
          this.isSubmitting = false;
          this.notify.show('Reserva creada correctamente.', 'success');
          this.cdr.markForCheck();
      },
      error: (err) => {
        this.notify.show(err.error?.message || 'Error al crear reserva', 'error');
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  private formatTime12(timeStr: string): string {
    if(!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
}