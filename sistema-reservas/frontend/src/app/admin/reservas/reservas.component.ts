import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core'; // 1. Imports
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
import { environment } from '../../../environments/environment';

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
  date: string;           
  startTime: string;      
  endTime: string;
  status: string;
  previousStatus?: string;
  selected?: boolean;
  createdAt?: string; 
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
  changeDetection: ChangeDetectionStrategy.OnPush // 2. Estrategia OnPush
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
  sortColumn: 'date' | 'status' = 'date'; 
  sortDirection: 'asc' | 'desc' = 'asc';
  showForm = false;
  editingReservationId: string | null = null;

  // Form fields
  currentUserFullName: string = '';
  courtId = '';
  reservationDate = '';
  status: ReservationStatus | string = 'PENDING';

  startTimeDisplay = ''; 
  endTimeDisplay = '';
  startTime = ''; 
  endTime = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Selección
  selectedByAction = new Map<string, 'cancel' | 'reactivate'>();
  selectAllGlobal = false;

  get hasCancelSelected(): boolean { return Array.from(this.selectedByAction.values()).includes('cancel'); }
  get hasReactivateSelected(): boolean { return Array.from(this.selectedByAction.values()).includes('reactivate'); }
  get selectedCount(): number { return this.selectedByAction.size; }

  // UI state
  userEmail = '';
  userRole = '';

  // Internal
  private uiTimerSub: Subscription | null = null;   
  private dataPollingSub: Subscription | null = null; 
  
  private readonly baseUrl = environment.apiUrl;
  private reactivateDialogRef: MatDialogRef<ReactivateErrorDialogComponent> | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private notify: NotificationService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef // 3. Inyectar ChangeDetectorRef
  ) {
    this.userEmail = this.auth.getUserEmail() || 'usuario@correo.com';
    this.userRole = this.auth.getUserRole() || 'ROL_NO_DEFINIDO';
  }

  ngOnInit() {
    forkJoin({
      users: this.http.get<UserDTO[]>(`${this.baseUrl}/users`),
      courts: this.http.get<CourtDTO[]>(`${this.baseUrl}/courts`)
    }).subscribe({
      next: ({ users, courts }) => {
        this.users = users;
        this.courts = courts;
        this.loadReservations(); 
        this.cdr.markForCheck(); // Actualizar UI inicial
      },
      error: err => {
        console.error(err);
        this.showMessage('Error al cargar usuarios o canchas.', 'error');
        this.cdr.markForCheck();
      }
    });

    this.dataPollingSub = interval(5000).subscribe(() => {
        this.loadReservations(true); 
    });

    // Timer para actualizar contadores visuales (3m 00s)
    this.uiTimerSub = interval(1000).subscribe(() => { 
        this.cdr.markForCheck(); // Forzar actualización cada segundo para el reloj
    });
  }

  ngOnDestroy() {
    this.uiTimerSub?.unsubscribe();
    this.dataPollingSub?.unsubscribe();
  }

  // ---------------- Lógica de Tiempo Real ----------------
  getRemainingTime(res: ReservationDTO): number {
      if (!res.createdAt) return 0;
      if (res.status !== 'PENDING' && res.status !== 'REACTIVATED') return 0;

      const created = new Date(res.createdAt).getTime();
      const now = Date.now();
      const expiresAt = created + (3 * 60 * 1000); 
      const remaining = expiresAt - now;
      return remaining > 0 ? remaining : 0;
  }

  formatStatusWithTimer(res: ReservationDTO): string {
      const status = res.status;
      if (status === 'PENDING' || status === 'REACTIVATED') {
          const ms = this.getRemainingTime(res);
          if (ms <= 0) return 'Expirado'; 
          const min = Math.floor(ms / 60000);
          const sec = Math.floor((ms % 60000) / 1000);
          const label = status === 'PENDING' ? 'Pendiente' : 'Reactivada';
          return `${label} (${min}m ${sec}s)`;
      }
      switch (status) {
          case 'CONFIRMED': return 'Confirmada';
          case 'CANCELLED': return 'Cancelada';
          case 'FINISHED': return 'Finalizada';
          default: return status;
      }
  }

  // ---------------- Servicios públicos ----------------
  private showMessage(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }

  logout() {
    this.auth.logout();
    location.href = '/login';
  }

  // ---------------- Helpers Hora ----------------
  private parse12hTo24(input: string | null | undefined): string {
    if (!input) return '';
    const s = input.toString().trim().replace(/\./g, '').toUpperCase();
    const regex24h = /^(\d{1,2}):(\d{2})$/;
    const match24 = s.match(regex24h);
    if (match24) {
      const hh = parseInt(match24[1], 10);
      const mm = parseInt(match24[2], 10);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
      }
    }
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
    const maybe24 = this.parse12hTo24(displayOrBackendTime);
    return maybe24 || displayOrBackendTime;
  }

  private endpoint(path: string) { return `${this.baseUrl}${path}`; }

  // ---------------- Loading ----------------
  loadReservations(isPolling = false) {
    this.http.get<ReservationDTO[]>(this.endpoint('/reservations')).subscribe({
      next: res => {
        this.reservations = res.map(r => {
          const existing = this.reservations.find(old => old.id === r.id);
          const updated = this.updateReservationStatus(r);
          const user = this.users.find(u => u.id === updated.userId);
          updated.userFullName = user ? `${user.firstName} ${user.lastName}` : updated.userFullName || '';
          const court = this.courts.find(c => c.id === updated.courtId);
          updated.courtName = court ? court.name : updated.courtName || '';
          
          updated.selected = existing ? existing.selected : false; 
          updated.startTime = this.format24To12(this.to24ForComparison(updated.startTime));
          updated.endTime = this.format24To12(this.to24ForComparison(updated.endTime));
          return updated;
        });
        
        if (!isPolling) {
              this.filterReservations();
        } else {
              this.applyFilterOnly(); 
        }
        this.cdr.markForCheck(); // 4. Notificar cambios tras polling o carga
      },
      error: err => { 
          if(!isPolling) { 
              console.error(err); 
              this.showMessage('Error al cargar las reservaciones.'); 
          }
          this.cdr.markForCheck();
      }
    });
  }

  private updateReservationStatus(res: ReservationDTO): ReservationDTO {
    try {
      const now = new Date();
      const endStr = this.to24ForComparison(res.endTime);
      const end = new Date(`${res.date}T${endStr}`);
      if ((res.status === 'PENDING' || res.status === 'PENDIENTE') && end < now) {
        res.status = 'FINISHED'; 
      }
    } catch (e) { }
    return res;
  }

  // ---------------- Filtros / Ordenación / Paginación ----------------
  filterReservations() {
    this.applyFilterOnly();
    this.currentPage = 1; 
    this.setupPagination();
    this.cdr.markForCheck();
  }

  applyFilterOnly() {
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
      let comparison = 0;

      if (this.sortColumn === 'date') {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        comparison = aTime - bTime;
      } else if (this.sortColumn === 'status') {
        const statusA = (a.status || '').toLowerCase();
        const statusB = (b.status || '').toLowerCase();
        if (statusA < statusB) comparison = -1;
        if (statusA > statusB) comparison = 1;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.filteredReservations = results;
    this.setupPagination();
  }

  toggleSortByDate() {
    if (this.sortColumn === 'date') {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = 'date';
      this.sortDirection = 'asc';
    }
    this.filterReservations(); 
  }

  toggleSortByStatus() {
    if (this.sortColumn === 'status') {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = 'status';
      this.sortDirection = 'asc';
    }
    this.filterReservations();
  }

  setupPagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredReservations.length / this.itemsPerPage));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.pagedReservations = this.filteredReservations.slice(start, end).map(r => ({ ...r }));
    this.cdr.markForCheck();
  }

  nextPage() { 
      if (this.currentPage < this.totalPages) { 
          this.currentPage++; 
          this.setupPagination(); 
          this.cdr.markForCheck();
      } 
  }
  
  previousPage() { 
      if (this.currentPage > 1) { 
          this.currentPage--; 
          this.setupPagination(); 
          this.cdr.markForCheck();
      } 
  }

  // ---------------- UI Helpers ----------------
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

  // ---------------- Validación ----------------
  private validateReservation(isEditing = false): boolean {
    const start24 = this.parse12hTo24(this.startTimeDisplay);
    const end24 = this.parse12hTo24(this.endTimeDisplay);

    if (!this.courtId || !this.reservationDate || !start24 || !end24) {
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

    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    if (durationMinutes < 60) { 
      this.showMessage('La reservación debe durar al menos 1 hora.', 'warning'); 
      return false; 
    }

    // Check overlap
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
        `Ya existe la reserva [${conflictCode}] de ${conflictStartStr} a ${conflictEndStr} en esta cancha.`,
        'warning'
      );
      return false;
    }

    return true;
  }
  
  canReactivate(res: ReservationDTO): boolean {
    if (!res) return false;
    if (res.status !== 'CANCELLED') return false;
    const userHasActive = this.reservations.some(r =>
      r.userId === res.userId &&
      r.id !== res.id &&
      (r.status === 'PENDING' || r.status === 'REACTIVATED')
    );
    if (userHasActive) return false;
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

  canDeleteReservation(res: ReservationDTO): boolean {
    if (!res) return false;
    if (res.status === 'FINISHED') {
      return true; 
    }
    if (res.status === 'CANCELLED') {
      const start24 = this.to24ForComparison(res.startTime);
      const end24 = this.to24ForComparison(res.endTime);
      const hasActiveConflict = this.reservations.some(r =>
        r.id !== res.id &&
        r.courtName === res.courtName &&
        r.date === res.date &&
        this.to24ForComparison(r.startTime) === start24 &&
        this.to24ForComparison(r.endTime) === end24 &&
        (r.status === 'CONFIRMED' || r.status === 'FINISHED')
      );
      return !hasActiveConflict;
    }

    return false;
  }

  // ---------------- FORMULARIO DE EDICIÓN ----------------
  openForm(res: ReservationDTO) {
    this.showForm = true;
    this.editingReservationId = res.id;
    this.currentUserFullName = res.userFullName || res.email; 
    this.courtId = res.courtId;
    this.reservationDate = res.date;
    this.startTimeDisplay = this.to24ForComparison(res.startTime);
    this.endTimeDisplay = this.to24ForComparison(res.endTime);
    this.startTime = this.startTimeDisplay;
    this.endTime = this.endTimeDisplay;
    this.status = res.status;
    this.cdr.markForCheck();
  }

  cancelForm() { 
    this.showForm = false; 
    this.editingReservationId = null; 
    this.currentUserFullName = '';
    this.cdr.markForCheck();
  }

  submitForm() {
    if (!this.editingReservationId) return;

    const original = this.reservations.find(r => r.id === this.editingReservationId);
    if (!original) return;

    if (original.status === 'FINISHED') {
      this.showMessage('No se puede editar una reserva finalizada.', 'warning');
      return;
    }

    if (!this.validateReservation(true)) return;

    const payload: any = {};
    if (this.courtId && this.courtId !== original.courtId) payload.courtId = this.courtId;
    if (this.reservationDate && this.reservationDate !== original.date) payload.date = this.reservationDate;
    if (this.status && this.status !== original.status) payload.status = this.status;
    if (this.startTime && this.startTime !== this.to24ForComparison(original.startTime)) payload.startTime = this.startTime;
    if (this.endTime && this.endTime !== this.to24ForComparison(original.endTime)) payload.endTime = this.endTime;

    if (Object.keys(payload).length === 0) {
      this.showMessage('No se detectaron cambios en la reservación.', 'warning');
      return;
    }

    const overlap = this.reservations.some(r =>
      r.id !== this.editingReservationId &&
      r.courtId === (payload.courtId ?? original.courtId) &&
      r.date === (payload.date ?? original.date) &&
      ['PENDING', 'ACTIVE'].includes(r.status) &&
      this.isOverlap(
        payload.startTime ?? this.to24ForComparison(original.startTime),
        payload.endTime ?? this.to24ForComparison(original.endTime),
        this.to24ForComparison(r.startTime),
        this.to24ForComparison(r.endTime)
      )
    );

    if (overlap) {
      this.showMessage('Ya existe una reserva pendiente o activa en este horario.', 'warning');
      return;
    }

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
          this.cdr.markForCheck();
        },
        error: err => {
          console.error(err);
          const msg = err?.error?.message || `Error al actualizar la reservación: ${err?.message ?? ''}`;
          this.showMessage(msg, 'error');
          this.cdr.markForCheck();
        }
      });
    });
  }

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
          this.cdr.markForCheck();
        },
        error: err => { 
            console.error('Error al eliminar:', err); 
            const msg = err.error?.message || 'Error al eliminar la reservación.';
            this.showMessage(msg, 'error'); 
            this.cdr.markForCheck();
        }
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
          this.cdr.markForCheck();
        },
        error: err => { 
            console.error('Error al cancelar:', err); 
            this.showMessage('Error al cancelar la reservación.', 'error'); 
            this.cdr.markForCheck();
        }
      });
    });
  }

  reactivateReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: { title: 'Confirmar reactivación', message: `¿Desea reactivar la reservación con código "${res.code}"?` }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.http.patch<ReservationDTO>(this.endpoint(`/reservations/${res.id}/reactivate`), {}).subscribe({
        next: updated => {
          const index = this.reservations.findIndex(r => r.id === updated.id);
          if (index !== -1) {
            this.reservations[index] = {
              ...updated,
              selected: false,
              startTime: updated.startTime ? this.format24To12(this.to24ForComparison(updated.startTime)) : '',
              endTime: updated.endTime ? this.format24To12(this.to24ForComparison(updated.endTime)) : ''
            };
            this.selectedByAction.delete(res.id);
            this.filterReservations();
          }
          this.showMessage(`Reservación "${res.code}" reactivada con éxito.`, 'success');
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Error al reactivar:', err);
          const backendMsg = err?.error?.message || err?.error?.error || err?.message || `No se pudo reactivar la reserva "${res.code}".`;
          this.showMessage(backendMsg, 'error');
          this.cdr.markForCheck();
        }
      });
    });
  }

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
        this.cdr.markForCheck();
      },
      error: err => { 
          console.error('Error al cargar factura:', err); 
          this.showMessage('Error al consultar la factura.', 'error');
          this.cdr.markForCheck();
      }
    });
  }

  // ---------------- Selección ----------------
  onReservationSelect(res: ReservationDTO, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    res.selected = checked;
    if (checked) {
      const action = res.status === 'CANCELLED' ? 'reactivate' : 'cancel';
      this.selectedByAction.set(res.id, action);
    } else {
      this.selectedByAction.delete(res.id);
    }
    this.cdr.markForCheck();
  }

  toggleSelectAllPage(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    
    const usersMarkedForReactivation = new Set<number>();

    this.pagedReservations.forEach(res => {
      if (res.status === 'CONFIRMED' || res.status === 'FINISHED') return;
      
      if (res.status === 'CANCELLED') {
        if (!this.canSelectForReactivation(res)) return;
        
        if (checked) {
          if (usersMarkedForReactivation.has(res.userId)) {
            res.selected = false;
            this.selectedByAction.delete(res.id);
            return; 
          }
          usersMarkedForReactivation.add(res.userId);
        }
      }

      res.selected = checked;
      if (checked) {
        const action = res.status === 'CANCELLED' ? 'reactivate' : 'cancel';
        this.selectedByAction.set(res.id, action);
      } else {
        this.selectedByAction.delete(res.id);
      }
    });
    this.cdr.markForCheck();
  }

  // ⚡ OPTIMIZACIÓN CRÍTICA: Desconectar detector durante bucle masivo
  toggleSelectAllGlobal(event: any) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAllGlobal = checked;

    this.cdr.detach(); // Detener detección

    const usersMarkedForReactivation = new Set<number>();

    this.filteredReservations.forEach(res => {
      if (res.status === 'CONFIRMED' || res.status === 'FINISHED') return;

      if (res.status === 'CANCELLED') {
        if (!this.canSelectForReactivation(res)) return;

        if (checked) {
          if (usersMarkedForReactivation.has(res.userId)) {
             res.selected = false;
             this.selectedByAction.delete(res.id);
             return;
          }
          usersMarkedForReactivation.add(res.userId);
        }
      }

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
    
    this.cdr.reattach(); // Reanudar detección
    this.cdr.markForCheck();
  }

  areAllSelected(): boolean {
    const selectable = this.pagedReservations.filter(r => r.status !== 'CONFIRMED' && r.status !== 'FINISHED');
    return selectable.length > 0 && selectable.every(r => !!r.selected);
  }

  private removeFromSelectionById(id: string) {
    this.selectedByAction.delete(id);
  }

  cancelSelected() {
    const idsToCancel = Array.from(this.selectedByAction.entries()).filter(([, v]) => v === 'cancel').map(([k]) => k);
    if (idsToCancel.length === 0) return;
    
    idsToCancel.forEach(id => {
      this.http.delete(this.endpoint(`/reservations/${id}/cancel`)).subscribe({
        next: () => {
          const index = this.reservations.findIndex(r => r.id === id);
          if (index !== -1) this.reservations[index].status = 'CANCELLED';
          this.removeFromSelectionById(id);
          this.filterReservations();
          this.cdr.markForCheck();
        },
        error: err => { 
            console.error('Error al cancelar:', err);
            this.cdr.markForCheck();
        }
      });
    });
    this.showMessage('Reservaciones seleccionadas canceladas.', 'success');
  }

  reactivateSelected() {
    const rawIds = Array.from(this.selectedByAction.entries())
      .filter(([, v]) => v === 'reactivate')
      .map(([k]) => k);

    if (rawIds.length === 0) return;

    const selectedReservations = this.reservations.filter(r => rawIds.includes(r.id));

    const uniqueUserIds = new Set<number>();
    const finalIds: string[] = [];
    const duplicateIds: string[] = [];

    selectedReservations.forEach(res => {
      const hasActiveGlobal = this.reservations.some(r => 
        r.userId === res.userId && 
        r.id !== res.id && 
        (r.status === 'PENDING' || r.status === 'REACTIVATED')
      );

      if (hasActiveGlobal || uniqueUserIds.has(res.userId)) {
        duplicateIds.push(res.id);
      } else {
        uniqueUserIds.add(res.userId);
        finalIds.push(res.id);
      }
    });

    if (duplicateIds.length > 0) {
      duplicateIds.forEach(id => {
        const index = this.reservations.findIndex(r => r.id === id);
        if (index !== -1) this.reservations[index].selected = false;
        this.selectedByAction.delete(id);
      });
      this.showMessage(`Se omitieron ${duplicateIds.length} reservas (límite de 1 activa por usuario).`, 'warning');
    }

    if (finalIds.length === 0) return;

    this.http.patch<any[]>(this.endpoint('/reservations/reactivate-bulk'), finalIds).subscribe({
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
            updated.startTime = updated.startTime ? this.format24To12(this.to24ForComparison(updated.startTime)) : '';
            updated.endTime = updated.endTime ? this.format24To12(this.to24ForComparison(updated.endTime)) : '';
            this.reservations[resIndex] = updated;
            this.selectedByAction.delete(result.id);
            dialogData.push({ code: updated.code ?? '', message: 'Reactivada correctamente', status: 'success' });
          } else {
            dialogData.push({ code: res.code ?? '', message: result.message ?? 'Error desconocido', status: 'failed' });
          }
        });

        this.filterReservations();
        if (dialogData.length > 0 && !this.reactivateDialogRef) {
          this.reactivateDialogRef = this.dialog.open(ReactivateErrorDialogComponent, {
            width: '500px',
            data: dialogData
          });
          this.reactivateDialogRef.afterClosed().subscribe(() => { this.reactivateDialogRef = null; });
        }
        this.cdr.markForCheck();
      },
      error: err => {
        console.error('Error al reactivar masivamente:', err);
        this.showMessage('Error al reactivar las reservas seleccionadas.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  canSelectForReactivation(res: ReservationDTO): boolean {
    if (res.status !== 'CANCELLED') return false;
    const userHasActive = this.reservations.some(r => r.userId === res.userId && r.id !== res.id && (r.status === 'PENDING' || r.status === 'REACTIVATED'));
    if (userHasActive) return false;
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
    if (res.status === 'FINISHED') {
      return 'Eliminar reserva finalizada (Solo si no tiene factura)';
    }

    if (res.status === 'CANCELLED') {
      const start24 = this.to24ForComparison(res.startTime);
      const end24 = this.to24ForComparison(res.endTime);
      const conflicting = this.reservations.some(r =>
        r.id !== res.id &&
        (r.status === 'CONFIRMED' || r.status === 'FINISHED') &&
        r.userId === res.userId &&
        r.date === res.date &&
        !(end24 <= this.to24ForComparison(r.startTime) || start24 >= this.to24ForComparison(r.endTime))
      );
      if (!conflicting) return 'No se puede eliminar: conflicto de historial';
      return 'Disponible para eliminar';
    }

    return '';
  }
}