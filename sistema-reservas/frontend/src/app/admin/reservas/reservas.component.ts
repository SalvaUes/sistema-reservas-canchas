import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { ReactivateErrorDialogComponent } from '../../shared/reactivate-error-dialog/reactivate-error-dialog.component';

import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../usuarios/confirm-dialog.component';
import { InvoiceDialogComponent, InvoiceDialogData } from '../../shared/notificaciones/invoice/invoice-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { interval, Subscription, forkJoin } from 'rxjs';

  interface UserDTO { id: number; firstName: string; lastName: string; email: string; }
  interface CourtDTO { id: string; name: string; sportType: string; pricePerHour: number; }
  interface ReservationDTO {
    id: string;
    reservationId?: string;
    code?: string;
    userId: number;
    userFullName?: string;
    email: string;  
    courtId: string;
    courtName?: string;
    date: string;           // yyyy-mm-dd
    startTime: string;      // could be "HH:mm" from backend or "h:mm AM/PM" when shown
    endTime: string;
    status: string;
    previousStatus?: string;
    selected?: boolean;
  }

  interface ReactivateResult {
    code: string;
    message: string;
    status: 'success' | 'failed';
  }

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'FINISHED' | 'CANCELLED' | 'REACTIVATED' | '';

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule],
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.scss'],
})
export class ReservasComponent implements OnInit, OnDestroy {

  // Data
  reservations: ReservationDTO[] = [];
  filteredReservations: ReservationDTO[] = [];
  pagedReservations: ReservationDTO[] = [];
  users: UserDTO[] = [];
  courts: CourtDTO[] = [];

  // Filters / UI
  searchTerm = '';
  filterStatus: ReservationStatus = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  showForm = false;
  editMode = false;
  editingReservationId: string | null = null;

  // Form fields
  userId: number | null = null;
  courtId = '';
  reservationDate = '';
  status: ReservationStatus | string = 'PENDING';

  //Entradas de tiempo (mostradas en AM/PM) y valores a enviar (24 h "HH:mm")
  startTimeDisplay = ''; // e.g. "07:00 AM"
  endTimeDisplay = '';
  startTime = ''; // "HH:mm" for backend
  endTime = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Helper arrays
  hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  minutes = ['00', '10', '20', '30', '40', '50'];

  // Selección: un solo mapa para evitar matrices duplicadas para diferentes acciones
  // El valor es 'cancel' | 'reactivate'
  selectedByAction = new Map<string, 'cancel' | 'reactivate'>();
  selectAllGlobal = false;

  get hasCancelSelected(): boolean {
    // devuelve true si hay al menos un id marcado para 'cancel'
    return Array.from(this.selectedByAction.values()).includes('cancel');
  }

  get hasReactivateSelected(): boolean {
    // devuelve true si hay al menos un id marcado para 'reactivate'
    return Array.from(this.selectedByAction.values()).includes('reactivate');
  }

  get selectedCount(): number {
    return this.selectedByAction.size;
  }

  // UI state
  isSidePanelClosed = true;
  userEmail = '';
  userRole = '';

  // Internal
  private timerSub: Subscription | null = null;
  private readonly baseUrl = 'http://localhost:8080/api';
  private reactivateDialogRef: MatDialogRef<ReactivateErrorDialogComponent> | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private notify: NotificationService,
    private dialog: MatDialog
  ) {
    this.userEmail = this.auth.getUserEmail() || 'usuario@correo.com';
    this.userRole = this.auth.getUserRole() || 'ROL_NO_DEFINIDO';
  }

  ngOnInit() {
    // Primero cargamos los usuarios y las canchas para poder asignar los nombres cuando lleguen las reservas.
    forkJoin({
      users: this.http.get<UserDTO[]>(`${this.baseUrl}/users`),
      courts: this.http.get<CourtDTO[]>(`${this.baseUrl}/courts`)
    }).subscribe({
      //Utilice funciones flecha para preservar `this` y satisfacer las sobrecargas de TypeScript.
      next: ({ users, courts }) => {
        this.users = users;
        this.courts = courts;
        this.loadReservations();
      },
      error: err => {
        console.error(err);
        this.showMessage('Error al cargar usuarios o canchas.', 'error');
      }
    });

    // Mantener la interfaz de usuario actualizada (re-renderizar la tabla) cada segundo
    this.timerSub = interval(1000).subscribe(() => {
      // Pequeña actualización inmutable para provocar la detección de cambios
      this.reservations = this.reservations.slice();
    });
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
  }

  // ---------------- Servicios públicos ----------------
  private showMessage(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }

  logout() {
    this.auth.logout();
    location.href = '/login';
  }

  toggleSidePanel() { this.isSidePanelClosed = !this.isSidePanelClosed; }
  hoverPanel(isHovering: boolean) { if (this.isSidePanelClosed) this.isSidePanelClosed = !isHovering ? true : false; }

  private parse12hTo24(input: string | null | undefined): string {
    if (!input) return '';

    // Limpiar y estandarizar el texto
    const s = input.toString().trim().replace(/\./g, '').toUpperCase();

    // Si ya está en formato 24h "HH:mm", validarlo y devolverlo
    const regex24h = /^(\d{1,2}):(\d{2})$/;
    const match24 = s.match(regex24h);
    if (match24) {
      const hh = parseInt(match24[1], 10);
      const mm = parseInt(match24[2], 10);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
      }
    }

    // Formato 12h: "h:mm AM/PM" o "hAM/PM"
    const regex12h = /^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/i;
    const match12 = s.match(regex12h);
    if (!match12) return '';

    let hh = parseInt(match12[1], 10);
    const mm = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridian = match12[3].toUpperCase();

    if (meridian === 'PM' && hh < 12) hh += 12;
    if (meridian === 'AM' && hh === 12) hh = 0;

    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  }


  private format24To12(hhmm: string): string {
    if (!hhmm) return '';
    const parts = hhmm.split(':');
    if (parts.length < 2) return hhmm;
    let hh = parseInt(parts[0], 10);
    const mm = parts[1];
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${hh.toString().padStart(2, '0')}:${mm} ${ampm}`;
  }

  private to24ForComparison(displayOrBackendTime: string): string {
    // La entrada puede ser "h:mm AM/PM" o "HH:mm" (backend).
    const maybe24 = this.parse12hTo24(displayOrBackendTime);
    return maybe24 || displayOrBackendTime;
  }

  private endpoint(path: string) { return `${this.baseUrl}${path}`; }

  // ---------------- Loading ----------------
  loadReservations() {
    this.http.get<ReservationDTO[]>(this.endpoint('/reservations')).subscribe({
      next: res => {
        // Actualizar estados localmente y nombres de mapas, unificar la hora mostrada a AM/PM
        this.reservations = res.map(r => {
          const updated = this.updateReservationStatus(r);
          const user = this.users.find(u => u.id === updated.userId);
          updated.userFullName = user ? `${user.firstName} ${user.lastName}` : updated.userFullName || '';
          const court = this.courts.find(c => c.id === updated.courtId);
          updated.courtName = court ? court.name : updated.courtName || '';
          updated.selected = false;

          // Es probable que el servidor proporcione la hora en formato HH:mm; asegúrese de que se muestre en AM/PM.
          updated.startTime = this.format24To12(this.to24ForComparison(updated.startTime));
          updated.endTime = this.format24To12(this.to24ForComparison(updated.endTime));
          return updated;
        });
        this.filterReservations();
      },
      error: err => { console.error(err); this.showMessage('Error al cargar las reservaciones.'); }
    });
  }

  private updateReservationStatus(res: ReservationDTO): ReservationDTO {
    // Normalizar y, si es necesario, actualizar el estado FINALIZADO si el final es anterior al actual.
    try {
      const now = new Date();
      const endStr = this.to24ForComparison(res.endTime);
      const end = new Date(`${res.date}T${endStr}`);
      if ((res.status === 'PENDING' || res.status === 'PENDIENTE') && end < now) {
        res.status = 'FINISHED';
        // Disparar y olvidarse del backend
        this.http.put(this.endpoint(`/reservations/${res.id}`), {
          userId: res.userId,
          courtId: res.courtId,
          date: res.date,
          startTime: this.to24ForComparison(res.startTime),
          endTime: this.to24ForComparison(res.endTime),
          status: res.status
        }).subscribe({ error: e => console.error('Error al sincronizar estado finalizado', e) });
      }
    } catch (e) {
      console.warn('updateReservationStatus parsing issue', e);
    }
    return res;
  }

  // ---------------- Filtros / Ordenación / Paginación ----------------
  filterReservations() {
    let results = this.reservations.slice();
    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      results = results.filter(r =>
        (r.email || '').toLowerCase().includes(term) ||
        (r.courtName || '').toLowerCase().includes(term) ||
        (r.date || '').toLowerCase().includes(term) ||
        (r.code || '').toLowerCase().includes(term)
      );
    }
    if (this.filterStatus) {
      results = results.filter(r => r.status === this.filterStatus);
    }
    results.sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return this.sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    });
    this.filteredReservations = results;
    this.currentPage = 1;
    this.setupPagination();
  }

  toggleSortByDate() { this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'; this.filterReservations(); }

  setupPagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredReservations.length / this.itemsPerPage));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    // Copia superficial para evitar mutaciones accidentales
    this.pagedReservations = this.filteredReservations.slice(start, end).map(r => ({ ...r }));
    if (this.pagedReservations.length === 0 && this.currentPage > 1) {
      this.currentPage--;
      this.setupPagination();
    }
  }

  nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.setupPagination(); } }
  previousPage() { if (this.currentPage > 1) { this.currentPage--; this.setupPagination(); } }

  translateReservationStatus(status: string): string {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'CONFIRMED': return 'Confirmada';
      case 'FINISHED': return 'Finalizada';
      case 'CANCELLED': return 'Cancelada';
      case 'REACTIVATED': return 'Reactivada';
      default: return status;
    }
  }

  // ---------------- Funciones auxiliares de tiempo para el enlace de la interfaz de usuario ----------------
  onStartTimeChange(value: string) {
    this.startTime = value;
    if (this.endTime && this.startTime >= this.endTime) {
      this.showMessage('La hora de inicio debe ser anterior a la de fin', 'warning');
      this.startTime = '';
    }
  }

  onEndTimeChange(value: string) {
    this.endTime = value;
    if (this.startTime && this.endTime <= this.startTime) {
      this.showMessage('La hora de fin debe ser posterior a la de inicio', 'warning');
      this.endTime = '';
    }
  }

  
  // ---------------- validacion ----------------
  private validateReservation(isEditing = false): boolean {
    const start24 = this.parse12hTo24(this.startTimeDisplay);
    const end24 = this.parse12hTo24(this.endTimeDisplay);

    if (!this.userId || !this.courtId || !this.reservationDate || !start24 || !end24) {
      this.showMessage('Complete todos los campos obligatorios.', 'warning');
      return false;
    }

    this.startTime = start24;
    this.endTime = end24;

    const start = new Date(`${this.reservationDate}T${start24}`);
    const end = new Date(`${this.reservationDate}T${end24}`);
    const now = new Date();

    if (start < now) { 
      this.showMessage('No puede reservar en fecha/hora pasada.', 'warning'); 
      return false; 
    }

    const diffMinutes = (start.getTime() - now.getTime()) / 60000;
    if (diffMinutes < 10) { 
      this.showMessage('Debe crear o editar la reservación al menos 10 minutos antes del inicio.', 'warning'); 
      return false; 
    }

    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    if (durationMinutes < 60) { 
      this.showMessage('La reservación debe durar al menos 1 hora.', 'warning'); 
      return false; 
    }

    // check overlap with existing reservations (skip cancelled)
    let conflictStartStr = '';
    let conflictEndStr = '';
    let conflictCode = '';
    const overlapping = this.reservations.some(r => {
      if (r.status === 'CANCELLED') return false;
      if (isEditing && r.id === this.editingReservationId) return false;
      if (r.courtId !== this.courtId) return false;

      const rStart = new Date(`${r.date}T${this.to24ForComparison(r.startTime)}`);
      const rEnd = new Date(`${r.date}T${this.to24ForComparison(r.endTime)}`);

      const isOverlap = !(end <= rStart || start >= rEnd);
      if (isOverlap) {
        conflictStartStr = this.format24To12(this.to24ForComparison(r.startTime));
        conflictEndStr = this.format24To12(this.to24ForComparison(r.endTime));
        conflictCode = r.code || r.reservationId || 'N/A';
      }
      return isOverlap;
    });

    if (overlapping) {
      this.showMessage(
        `Ya existe la reserva [${conflictCode}] de ${conflictStartStr} a ${conflictEndStr} en esta cancha que se solapa con el horario seleccionado.`,
        'warning'
      );
      return false;
    }

    return true;
  }
  
  canReactivate(res: ReservationDTO): boolean {
    if (!res) return false;
    if (res.status !== 'CANCELLED') return false;

    // El usuario no puede tener otra reserva activa (PENDING | REACTIVATED)
    const userHasActive = this.reservations.some(r =>
      r.userId === res.userId &&
      r.id !== res.id &&
      (r.status === 'PENDING' || r.status === 'REACTIVATED')
    );
    if (userHasActive) return false;

    // Comprobar solapamiento en la misma cancha y fecha (solo contra PENDING/REACTIVATED)
    const start24 = this.to24ForComparison(res.startTime);
    const end24 = this.to24ForComparison(res.endTime);

    const overlapping = this.reservations.some(r => {
      if (r.id === res.id) return false;
      if (r.status !== 'PENDING' && r.status !== 'REACTIVATED') return false;
      if (r.courtId !== res.courtId || r.date !== res.date) return false;

      const rStart24 = this.to24ForComparison(r.startTime);
      const rEnd24 = this.to24ForComparison(r.endTime);

      return !(end24 <= rStart24 || start24 >= rEnd24);
    });

    return !overlapping;
  }

  canDeleteCancelled(reservation: ReservationDTO): boolean {
    if (!reservation) return false;
    if (reservation.status !== 'CANCELLED') return false;

    const start24 = this.to24ForComparison(reservation.startTime);
    const end24 = this.to24ForComparison(reservation.endTime);

    // Verificamos si existe alguna reserva activa (CONFIRMED o FINISHED) en el mismo horario
    const hasActiveConflict = this.reservations.some(r =>
      r.id !== reservation.id &&
      r.courtName === reservation.courtName &&
      r.date === reservation.date &&
      this.to24ForComparison(r.startTime) === start24 &&
      this.to24ForComparison(r.endTime) === end24 &&
      (r.status === 'CONFIRMED' || r.status === 'FINISHED')
    );

    // Se puede eliminar solo si NO hay conflictos
    return !hasActiveConflict;
  }

  // ---------------- Form open / submit ----------------
  openForm(editMode = false, res?: ReservationDTO) {
    this.showForm = true;
    this.editMode = editMode;
    if (editMode && res) {
      this.editingReservationId = res.id;
      this.userId = res.userId;
      this.courtId = res.courtId;
      this.reservationDate = res.date;
      this.startTimeDisplay = this.startTime;
      this.endTimeDisplay = this.endTime;
      this.status = res.status;
    } else {
      this.editingReservationId = null;
      this.userId = this.users.length > 0 ? this.users[0].id : null;
      this.courtId = this.courts.length > 0 ? this.courts[0].id : '';
      this.reservationDate = '';
      this.startTime = '';
      this.endTime = '';
      this.startTimeDisplay = '';
      this.endTimeDisplay = '';
      this.status = 'PENDING';
    }
  }

  cancelForm() { this.showForm = false; this.editMode = false; this.editingReservationId = null; }

  private buildPayload(): any {
    return {
      userId: this.userId,
      courtId: this.courtId,
      date: this.reservationDate,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status
    };
  }

  submitForm() {
    // Crear nueva reserva (ADMIN)
    if (!this.editMode) {
      if (!this.validateReservation(false)) return;

      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '350px',
        data: { title: 'Confirmar creación', message: `¿Desea crear la nueva reservación?` }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;

        const payload = this.buildPayload();

        // Validar solapamiento antes de crear
        const overlap = this.reservations.some(r =>
          r.courtId === payload.courtId &&
          r.date === payload.date &&
          ['PENDING', 'ACTIVE'].includes(r.status) &&
          this.isOverlap(payload.startTime, payload.endTime, r.startTime, r.endTime)
        );

        if (overlap) {
          this.showMessage('Ya existe una reserva pendiente o activa en este horario.', 'warning');
          return;
        }

        this.http.post<ReservationDTO>(this.endpoint('/reservations'), payload).subscribe({
          next: created => {
            const user = this.users.find(u => u.id === created.userId);
            created.userFullName = user ? `${user.firstName} ${user.lastName}` : '';
            const court = this.courts.find(c => c.id === created.courtId);
            created.courtName = court ? court.name : '';
            created.selected = false;

            // Mantener formato 24h directamente
            this.reservations.push(created);
            this.filterReservations();
            this.cancelForm();
            this.showMessage(
              `Reservación creada para "${created.userFullName}" en cancha "${created.courtName}".`,
              'success'
            );
          },
          error: err => {
            console.error(err);
            const msg = err?.error?.message || `Error al crear la reservación: ${err?.message ?? ''}`;
            this.showMessage(msg, 'error');
          }
        });
      });
      return;
    }

    // Editar reserva existente (ADMIN)
    if (!this.editingReservationId) return;

    const original = this.reservations.find(r => r.id === this.editingReservationId);
    if (!original) return;

    // No permitir editar reservas finalizadas
    if (original.status === 'FINISHED') {
      this.showMessage('No se puede editar una reserva finalizada.', 'warning');
      return;
    }

    // Ya estamos usando HH:mm → no se necesita convertir
    if (!this.validateReservation(true)) return;

    const payload: any = {};
    if (this.userId !== null && this.userId !== original.userId) payload.userId = this.userId;
    if (this.courtId && this.courtId !== original.courtId) payload.courtId = this.courtId;
    if (this.reservationDate && this.reservationDate !== original.date) payload.date = this.reservationDate;
    if (this.status && this.status !== original.status) payload.status = this.status;
    if (this.startTime && this.startTime !== original.startTime) payload.startTime = this.startTime;
    if (this.endTime && this.endTime !== original.endTime) payload.endTime = this.endTime;

    if (Object.keys(payload).length === 0) {
      this.showMessage('No se detectaron cambios en la reservación.', 'warning');
      return;
    }

    // Validar solapamiento antes de editar
    const overlap = this.reservations.some(r =>
      r.id !== this.editingReservationId &&
      r.courtId === (payload.courtId ?? original.courtId) &&
      r.date === (payload.date ?? original.date) &&
      ['PENDING', 'ACTIVE'].includes(r.status) &&
      this.isOverlap(
        payload.startTime ?? original.startTime,
        payload.endTime ?? original.endTime,
        r.startTime,
        r.endTime
      )
    );

    if (overlap) {
      this.showMessage('Ya existe una reserva pendiente o activa en este horario.', 'warning');
      return;
    }

    // Confirmar actualización
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: { title: 'Confirmar actualización', message: `¿Desea guardar los cambios de esta reservación?` }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.http.put<ReservationDTO>(this.endpoint(`/reservations/${this.editingReservationId}`), payload).subscribe({
        next: updated => {
          const index = this.reservations.findIndex(r => r.id === this.editingReservationId);
          if (index !== -1) {
            const user = this.users.find(u => u.id === updated.userId);
            updated.userFullName = user ? `${user.firstName} ${user.lastName}` : '';
            const court = this.courts.find(c => c.id === updated.courtId);
            updated.courtName = court ? court.name : '';
            updated.selected = false;
            this.reservations[index] = updated;
          }
          this.filterReservations();
          this.cancelForm();
          this.showMessage(`Reservación actualizada correctamente.`, 'success');
        },
        error: err => {
          console.error(err);
          const msg = err?.error?.message || `Error al actualizar la reservación: ${err?.message ?? ''}`;
          this.showMessage(msg, 'error');
        }
      });
    });
  }

  /** Verifica si dos intervalos de tiempo se solapan (HH:mm) */
  private isOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return startA < endB && endA > startB;
  }

  // ---------------- Operaciones individuales ----------------
  deleteReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: { title: 'Confirmar eliminación', message: `¿Eliminar permanentemente la reservación "${res.code}"?` }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      this.http.delete(this.endpoint(`/reservations/${res.id}`)).subscribe({
        next: () => {
          this.reservations = this.reservations.filter(r => r.id !== res.id);
          this.selectedByAction.delete(res.id);
          this.filterReservations();
          this.showMessage(`Reservación "${res.code}" eliminada.`, 'success');
          this.filterReservations();
        },
        error: err => { console.error('Error al eliminar:', err); this.showMessage('Error al eliminar la reservación.', 'error'); }
      });
    });
  }

  cancelReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: { title: 'Confirmar cancelación', message: `¿Cancelar reservación "${res.code}"?` }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      this.http.delete(this.endpoint(`/reservations/${res.id}/cancel`)).subscribe({
        next: () => {
          const index = this.reservations.findIndex(r => r.id === res.id);
          if (index !== -1) {
            this.reservations[index].status = 'CANCELLED';
            this.reservations[index].selected = false;
            this.selectedByAction.delete(res.id);
            this.filterReservations();
          }
          this.showMessage(`Reservación "${res.code}" cancelada.`, 'success');
        },
        error: err => { console.error('Error al cancelar:', err); this.showMessage('Error al cancelar la reservación.', 'error'); }
      });
    });
  }

  // Reactivación individual (segura)
  reactivateReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: { 
        title: 'Confirmar reactivación', 
        message: `¿Desea reactivar la reservación con código "${res.code}"?` 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.http.patch<ReservationDTO>(
        this.endpoint(`/reservations/${res.id}/reactivate`),
        {}
      ).subscribe({
        next: updated => {
          // Buscar índice en la tabla
          const index = this.reservations.findIndex(r => r.id === updated.id);
          if (index !== -1) {
            // Actualizar objeto directamente
            this.reservations[index] = {
              ...updated,
              selected: false,
              startTime: updated.startTime ? this.format24To12(this.to24ForComparison(updated.startTime)) : '',
              endTime: updated.endTime ? this.format24To12(this.to24ForComparison(updated.endTime)) : ''
            };

            // Eliminar de selección
            this.selectedByAction.delete(res.id);

            // Refrescar la tabla
            this.filterReservations();
          }

          this.showMessage(`Reservación "${res.code}" reactivada con éxito.`, 'success');
        },
        error: err => {
          console.error('Error al reactivar:', err);
          const backendMsg =
            err?.error?.message || 
            err?.error?.error || 
            err?.message || 
            `No se pudo reactivar la reserva "${res.code}".`;
          this.showMessage(backendMsg, 'error');
        }
      });
    });
  }

  // ---------------- Factura ----------------
  canShowInvoice(res: ReservationDTO): boolean {
    return (res.status === 'CONFIRMED' || res.status === 'Confirmada') && !!res.id;
  }

  openInvoice(res: ReservationDTO) {
    this.http.get<{ hasInvoice: boolean; invoice?: InvoiceDialogData['invoice'] }>(this.endpoint(`/payments/reservation/${res.id}`)).subscribe({
      next: data => {
        if (data.hasInvoice && data.invoice) {
          this.dialog.open(InvoiceDialogComponent, { width: '600px', data: { invoice: data.invoice } });
        } else {
          this.showMessage('No existe factura para esta reserva.', 'warning');
        }
      },
      error: err => { console.error('Error al cargar factura:', err); this.showMessage('Error al consultar la factura.', 'error'); }
    });
  }

  // ---------------- Selección (mapa único) ----------------
  onReservationSelect(res: ReservationDTO, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    res.selected = checked;
    if (checked) {
      const action = res.status === 'CANCELLED' ? 'reactivate' : 'cancel';
      this.selectedByAction.set(res.id, action);
    } else {
      this.selectedByAction.delete(res.id);
    }
  }

  toggleSelectAllPage(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.pagedReservations.forEach(res => {
      if (res.status === 'CONFIRMED' || res.status === 'FINISHED') return; // not selectable
      // For CANCELLED we must ensure it is eligible for reactivation
      if (res.status === 'CANCELLED' && !this.canSelectForReactivation(res)) return;
      res.selected = checked;
      if (checked) {
        const action = res.status === 'CANCELLED' ? 'reactivate' : 'cancel';
        this.selectedByAction.set(res.id, action);
      } else {
        this.selectedByAction.delete(res.id);
      }
    });
  }

  toggleSelectAllGlobal(event: any) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllGlobal = checked;
    this.filteredReservations.forEach(res => {
      if (res.status === 'CONFIRMED' || res.status === 'FINISHED') return;
      if (res.status === 'CANCELLED' && !this.canSelectForReactivation(res)) return;
      res.selected = checked;
      if (checked) {
        const action = res.status === 'CANCELLED' ? 'reactivate' : 'cancel';
        this.selectedByAction.set(res.id, action);
      } else {
        this.selectedByAction.delete(res.id);
      }
    });
    if (!checked) this.selectedByAction.clear();
    this.setupPagination();
  }

  areAllSelectedOnPage(): boolean {
    return this.pagedReservations.length > 0 && this.pagedReservations.every(r => r.selected || r.status === 'CONFIRMED' || r.status === 'FINISHED');
  }

  areAllSelected(): boolean {
    const selectable = this.pagedReservations.filter(r => r.status !== 'CONFIRMED' && r.status !== 'FINISHED');
    return selectable.length > 0 && selectable.every(r => !!r.selected);
  }

  private removeFromSelectionById(id: string) {
    this.selectedByAction.delete(id);
  }

  // ---------------- Operaciones masivas mediante un único mapa de selección ----------------
  cancelSelected() {
    // all ids labeled 'cancel'
    const idsToCancel = Array.from(this.selectedByAction.entries()).filter(([, v]) => v === 'cancel').map(([k]) => k);
    if (idsToCancel.length === 0) return;
    idsToCancel.forEach(id => {
      this.http.delete(this.endpoint(`/reservations/${id}/cancel`)).subscribe({
        next: () => {
          const index = this.reservations.findIndex(r => r.id === id);
          if (index !== -1) this.reservations[index].status = 'CANCELLED';
          this.removeFromSelectionById(id);
          this.filterReservations();
        },
        error: err => console.error('Error al cancelar:', err)
      });
    });
    this.showMessage('Reservaciones seleccionadas canceladas.', 'success');
  }



  // Reactivación masiva
  reactivateSelected() {
    const idsToReactivate = Array.from(this.selectedByAction.entries())
      .filter(([, v]) => v === 'reactivate')
      .map(([k]) => k);

    if (idsToReactivate.length === 0) return;

    this.http.patch<any[]>(this.endpoint('/reservations/reactivate-bulk'), idsToReactivate)
      .subscribe({
        next: results => {
          const dialogData: ReactivateResult[] = [];

          results.forEach(result => {
            const resIndex = this.reservations.findIndex(r => r.id === result.id);
            if (resIndex === -1) return;

            const res = this.reservations[resIndex];

            if (result.status === 'success') {
              const updated = { ...res };
              updated.status = 'REACTIVATED';
              updated.selected = false;

              // Formateo seguro de horas
              updated.startTime = updated.startTime 
                ? this.format24To12(this.to24ForComparison(updated.startTime)) 
                : '';
              updated.endTime = updated.endTime 
                ? this.format24To12(this.to24ForComparison(updated.endTime)) 
                : '';

              this.reservations[resIndex] = updated;
              this.selectedByAction.delete(result.id);

              dialogData.push({
                code: updated.code ?? '',
                message: 'Reactivada correctamente',
                status: 'success'
              });
            } else {
              dialogData.push({
                code: res.code ?? '',
                message: result.message ?? 'Error desconocido',
                status: 'failed'
              });
            }
          });

          this.filterReservations();

          if (dialogData.length > 0 && !this.reactivateDialogRef) {
            this.reactivateDialogRef = this.dialog.open(ReactivateErrorDialogComponent, {
              width: '500px',
              data: dialogData
            });

            this.reactivateDialogRef.afterClosed().subscribe(() => {
              this.reactivateDialogRef = null;
            });
          }
        },
        error: err => {
          console.error('Error al reactivar masivamente:', err);
          this.showMessage('Error al reactivar las reservas seleccionadas.', 'error');
        }
      });
  }

  // ---------------- Validadores / ayudantes para tooltips de la interfaz de usuario ----------------
  canSelectForReactivation(res: ReservationDTO): boolean {
    if (res.status !== 'CANCELLED') return false;
    // user cannot have another active (PENDING | REACTIVATED)
    const userHasActive = this.reservations.some(r =>
      r.userId === res.userId && r.id !== res.id && (r.status === 'PENDING' || r.status === 'REACTIVATED')
    );
    if (userHasActive) return false;

    // check court date overlap
    const start = new Date(`${res.date}T${this.to24ForComparison(res.startTime)}`);
    const end = new Date(`${res.date}T${this.to24ForComparison(res.endTime)}`);
    const overlapping = this.reservations.some(r => {
      if (r.id === res.id) return false;
      if (r.status !== 'PENDING' && r.status !== 'REACTIVATED') return false;
      if (r.courtId !== res.courtId || r.date !== res.date) return false;
      const rStart = new Date(`${r.date}T${this.to24ForComparison(r.startTime)}`);
      const rEnd = new Date(`${r.date}T${this.to24ForComparison(r.endTime)}`);
      return !(end <= rStart || start >= rEnd);
    });
    return !overlapping;
  }

  getReactivateTooltip(res: ReservationDTO): string {
    if (res.status !== 'CANCELLED') return 'No se puede reactivar: la reserva no está cancelada';
    const hasActive = this.reservations.some(r => r.userId === res.userId && r.id !== res.id && (r.status === 'PENDING' || r.status === 'REACTIVATED'));
    if (hasActive) return 'No se puede reactivar: ya tienes otra reserva pendiente o reactivada';
    const start24 = this.to24ForComparison(res.startTime);
    const end24 = this.to24ForComparison(res.endTime);
    const overlapping = this.reservations.some(r => {
      if (r.id === res.id) return false;
      if (r.status !== 'PENDING' && r.status !== 'REACTIVATED') return false;
      if (r.courtId !== res.courtId || r.date !== res.date) return false;
      const rStart24 = this.to24ForComparison(r.startTime);
      const rEnd24 = this.to24ForComparison(r.endTime);
      return !(end24 <= rStart24 || start24 >= rEnd24);
    });
    if (overlapping) return 'No se puede reactivar: horario ocupado en esta cancha';
    return 'Disponible para reactivar';
  }

  getDeleteTooltip(res: ReservationDTO): string {
    const start24 = this.to24ForComparison(res.startTime);
    const end24 = this.to24ForComparison(res.endTime);
    const conflicting = this.reservations.some(r =>
      r.id !== res.id &&
      (r.status === 'CONFIRMED' || r.status === 'FINISHED') &&
      r.userId === res.userId &&
      r.date === res.date &&
      !(end24 <= this.to24ForComparison(r.startTime) || start24 >= this.to24ForComparison(r.endTime))
    );
    if (!conflicting) return 'No se puede eliminar: ninguna reserva confirmada o finalizada coincide con este horario';
    return 'Disponible para eliminar';
  }
}