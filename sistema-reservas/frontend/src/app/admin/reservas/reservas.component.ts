import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../usuarios/confirm-dialog.component';
import { InvoiceDialogComponent, InvoiceDialogData } from '../../shared/notificaciones/invoice/invoice-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';


interface UserDTO { id: number; firstName: string; lastName: string; email: string; }
interface CourtDTO { id: string; name: string; sportType: string; pricePerHour: number; }
interface ReservationDTO {
  id: string;
  reservationId: string;
  code: string;
  userId: number;
  userFullName: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  previousStatus?: string;
  selected?: boolean;
}

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'FINISHED' | 'CANCELLED' | '';


@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,  MatTooltipModule, MatTimepickerModule, MatFormFieldModule, MatInputModule],
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.scss'],
})
export class ReservasComponent implements OnInit {
  reservations: ReservationDTO[] = [];
  filteredReservations: ReservationDTO[] = [];
  pagedReservations: ReservationDTO[] = [];
  users: UserDTO[] = [];
  courts: CourtDTO[] = [];

  searchTerm = '';
  filterStatus: ReservationStatus = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  showForm = false;
  editMode = false;
  editingReservationId: string | null = null;

  userId: number | null = null;
  courtId = '';
  reservationDate = '';
  
  status = 'PENDIENTE';

  startTimeDisplay: string = ''; // para mostrar en 12h
  endTimeDisplay: string = '';
  startTime: string = ''; // este es el que se enviará al backend (24h)
  endTime: string = '';

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Arrays para hora y minuto
  hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2,'0'));
  minutes = ['00','10','20','30','40','50'];

  // Variables del formulario
  startHour = '07'; startMinute = '00'; startAMPM: 'AM'|'PM' = 'PM';
  endHour = '08'; endMinute = '00'; endAMPM: 'AM'|'PM' = 'PM';

  selectedReservations: any[] = [];
  selectedReservationsReactivate: any[] = [];
  selectAllGlobal: boolean = false;
 

  isSidePanelClosed = true;
  userEmail = '';
  userRole = '';

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
    this.loadUsers();
    this.loadCourts();
    this.loadReservations();
  }

  toggleSidePanel() { this.isSidePanelClosed = !this.isSidePanelClosed; }
  hoverPanel(isHovering: boolean) {
    if (this.isSidePanelClosed) this.isSidePanelClosed = !isHovering ? true : false;
  }
  logout() { this.auth.logout(); location.href = '/login'; }

  showMessage(msg: string, type: 'error' | 'warning' | 'success' = 'error') {
    this.notify.show(msg, type, 5000);
  }

  canReactivate(res: ReservationDTO): boolean {
    if (res.status !== 'CANCELLED') return false;

    const start24 = this.convertDisplayTo24h(res.startTime);
    const end24 = this.convertDisplayTo24h(res.endTime);

    const overlapping = this.reservations.some(r => {
      if (r.id === res.id) return false;
      if (r.status === 'CANCELLED') return false;
      if (r.courtId !== res.courtId || r.date !== res.date) return false;

      const rStart24 = this.convertDisplayTo24h(r.startTime);
      const rEnd24 = this.convertDisplayTo24h(r.endTime);

      return !(end24 <= rStart24 || start24 >= rEnd24);
    });

    return !overlapping; // true si puede reactivarse
  }

  canDeleteCancelled(res: ReservationDTO): boolean {
    // Solo canceladas que no se pueden reactivar
    return res.status === 'CANCELLED' && !this.canReactivate(res);
  }

  deleteReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar eliminación',
        message: `¿Eliminar permanentemente la reservación "${res.code}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.http.delete(`http://localhost:8080/api/reservations/${res.id}`).subscribe({
        next: () => {
          this.reservations = this.reservations.filter(r => r.id !== res.id);
          this.selectedReservations = this.selectedReservations.filter(r => r.id !== res.id);
          this.selectedReservationsReactivate = this.selectedReservationsReactivate.filter(r => r.id !== res.id);
          this.filterReservations();
          this.showMessage(`Reservación "${res.code}" eliminada.`, 'success');
        },
        error: err => {
          console.error('Error al eliminar:', err);
          this.showMessage('Error al eliminar la reservación.', 'error');
        }
      });
    });
  }


  convertTo24h(field: 'start' | 'end') {
  const displayValue = field === 'start' ? this.startTimeDisplay : this.endTimeDisplay;
  if (!displayValue) return;

  // Acepta formatos como "10:30 am", "2:15PM", etc.
    const match = displayValue.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/i);
    if (!match) {
      alert('Formato inválido. Usa ej: 10:30 AM o 2:00 PM');
      return;
    }

    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridian = match[3].toUpperCase();

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    if (field === 'start') this.startTime = time24;
    else this.endTime = time24;
  }
  
  loadUsers() {
    this.http.get<UserDTO[]>('http://localhost:8080/api/users').subscribe({
      next: res => this.users = res,
      error: err => { console.error(err); this.showMessage('Error al cargar los usuarios.'); }
    });
  }

  loadCourts() {
    this.http.get<CourtDTO[]>('http://localhost:8080/api/courts').subscribe({
      next: res => this.courts = res,
      error: err => { console.error(err); this.showMessage('Error al cargar las canchas.'); }
    });
  }

  loadReservations() {
    this.http.get<ReservationDTO[]>('http://localhost:8080/api/reservations').subscribe({
      next: res => {
        // actualizar estado localmente y asignar nombres
        this.reservations = res.map(r => this.updateReservationStatus(r)).map(r => {
          const user = this.users.find(u => u.id === r.userId);
          r.userFullName = user ? `${user.firstName} ${user.lastName}` : r.userFullName || '';
          const court = this.courts.find(c => c.id === r.courtId);
          r.courtName = court ? court.name : r.courtName || '';
          r.selected = false;

          // --- CONVERTIR HORAS A AM/PM ---
          const start = new Date(`${r.date}T${r.startTime}`);
          const end = new Date(`${r.date}T${r.endTime}`);
          r.startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          r.endTime   = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

          return r;
        });
        this.filterReservations(); // esto llamará setupPagination
      },
      error: err => { console.error(err); this.showMessage('Error al cargar las reservaciones.'); }
    });
  }


  private updateReservationStatus(res: ReservationDTO): ReservationDTO {
    const now = new Date();
    const end = new Date(`${res.date}T${res.endTime}`);
    // solo actualizar si estaba pendiente y ya finalizó
    if ((res.status === 'PENDING' || res.status === 'PENDIENTE') && end < now) {
      res.status = 'FINISHED';
      // intentar actualizar en backend, pero no bloqueamos la UI
      this.http.put(`http://localhost:8080/api/reservations/${res.id}`, {
        userId: res.userId,
        courtId: res.courtId,
        date: res.date,
        startTime: res.startTime,
        endTime: res.endTime,
        status: res.status
      }).subscribe({ error: e => console.error('Error al sincronizar estado finalizado', e) });
    }
    return res;
  }

  filterReservations() {
    let results = this.reservations.slice(); // copia
    const term = this.searchTerm.trim().toLowerCase();

    if (term) {
      results = results.filter(r =>
        (r.userFullName || '').toLowerCase().includes(term) ||
        (r.courtName || '').toLowerCase().includes(term) ||
        (r.date || '').toLowerCase().includes(term) ||
        (r.code || '').toLowerCase().includes(term)
      );
    }

    if (this.filterStatus) {
      results = results.filter(r => r.status === this.filterStatus);
    }

    results.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });

    this.filteredReservations = results;

    // importante: resetear página al filtrar para evitar páginas vacías
    this.currentPage = 1;
    this.setupPagination();
  }

  toggleSortByDate() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.filterReservations();
  }

  canShowInvoice(res: ReservationDTO): boolean {
    return (res.status === 'CONFIRMED' || res.status === 'Confirmada') && !!res.id;
  }

  canSelectForReactivation(res: ReservationDTO): boolean {
    if (res.status !== 'CANCELLED') return false;

    const start = new Date(`${res.date}T${this.to24Hour(res.startTime)}`);
    const end = new Date(`${res.date}T${this.to24Hour(res.endTime)}`);

    const overlapping = this.reservations.some(r => {
      if (r.id === res.id || r.status === 'CANCELLED') return false;
      if (r.courtId !== res.courtId) return false;

      const rStart = new Date(`${r.date}T${this.to24Hour(r.startTime)}`);
      const rEnd = new Date(`${r.date}T${this.to24Hour(r.endTime)}`);
      return !(end <= rStart || start >= rEnd);
    });

    return !overlapping;
  }

  openInvoice(res: ReservationDTO) {
    this.http.get<{ hasInvoice: boolean; invoice?: InvoiceDialogData['invoice'] }>(
      `http://localhost:8080/api/payments/reservation/${res.id}`
    ).subscribe({
      next: data => {
        if (data.hasInvoice && data.invoice) {
          this.dialog.open(InvoiceDialogComponent, { width: '600px', data: { invoice: data.invoice } });
        } else {
          this.showMessage('No existe factura para esta reserva.');
        }
      },
      error: err => {
        console.error('Error al cargar factura:', err);
        this.showMessage('Error al consultar la factura.');
      }
    });
  }

  openForm(editMode = false, res?: ReservationDTO) {
  this.showForm = true;
  this.editMode = editMode;

  if (editMode && res) {
    this.editingReservationId = res.id;
    this.userId = res.userId;
    this.courtId = res.courtId;
    this.reservationDate = res.date;

    // Convertir a formato AM/PM para mostrar en timepicker
    this.startTimeDisplay = this.formatToAMPM(res.startTime);
    this.endTimeDisplay   = this.formatToAMPM(res.endTime);

    // No enviamos startTime/endTime directamente, lo convertimos al submit
    this.status = res.status;
  } else {
    this.editingReservationId = null;
    this.userId = this.users.length > 0 ? this.users[0].id : null;
    this.courtId = this.courts.length > 0 ? this.courts[0].id : '';
    this.reservationDate = '';
    this.startTime = '';
    this.endTime = '';
    this.status = 'PENDING';
  }
}


  cancelForm() { this.showForm = false; this.editMode = false; this.editingReservationId = null; }

  private buildReservationPayload(): any {
    return {
      userId: this.userId,
      courtId: this.courtId,
      date: this.reservationDate,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status
    };
  }

  private validateReservation(): boolean {
    // Convertir a 24h primero
    const startTime24 = this.convertDisplayTo24h(this.startTimeDisplay);
    const endTime24 = this.convertDisplayTo24h(this.endTimeDisplay);

    if (!this.userId || !this.courtId || !this.reservationDate || !startTime24 || !endTime24) {
      this.showMessage('Complete todos los campos obligatorios.');
      return false;
    }

    // Actualizamos this.startTime y this.endTime para enviar al backend
    this.startTime = startTime24;
    this.endTime = endTime24;

    // Convertir a objetos Date
    const start = new Date(`${this.reservationDate}T${startTime24}`);
    const end = new Date(`${this.reservationDate}T${endTime24}`);
    const now = new Date();

    // Validación: no reservar en el pasado
    if (start < now) {
      this.showMessage('No puede reservar en fecha/hora pasada.');
      return false;
    }

    // Validación: mínimo de 10 minutos antes del inicio
    const diffMinutes = (start.getTime() - now.getTime()) / 60000;
    if (diffMinutes < 10) {
      this.showMessage('Debe crear o editar la reservación al menos 10 minutos antes del inicio.');
      return false;
    }

    // Duración mínima de 1 hora
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    if (durationMinutes < 60) {
      this.showMessage('La reservación debe durar al menos 1 hora.');
      return false;
    }

    // Verificar solapamiento correctamente
    const overlapping = this.reservations.some(r => {
      if (r.status === 'CANCELLED') return false;
      if (r.id === this.editingReservationId) return false;
      if (r.courtId !== this.courtId) return false;

      const rStart = new Date(`${r.date}T${this.to24Hour(r.startTime)}`);
      const rEnd = new Date(`${r.date}T${this.to24Hour(r.endTime)}`);

      return !(end <= rStart || start >= rEnd);
    });

    if (overlapping) {
      this.showMessage('Ya existe una reserva en ese horario para esta cancha.');
      return false;
    }

    return true;
  }


  convertDisplayTo24h(display: string | Date | null | undefined): string {
    if (!display) return '';

    if (display instanceof Date) {
      const hour = display.getHours();
      const minute = display.getMinutes();
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    if (typeof display !== 'string') return '';

    const clean = display.replace(/\./g, '').replace(/\s/g, '').toUpperCase(); // "12:30AM"
    const match = clean.match(/^(\d{1,2}):?(\d{2})?(AM|PM)$/);
    if (!match) return '';

    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const meridian = match[3];

    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }


  onStartTimeChange(time: string | null | undefined) {
    this.startTime = this.convertDisplayTo24h(this.startTimeDisplay);
    if (!this.startTime) {
      this.showMessage('Formato de hora inválido', 'error');
      return;
    }
    console.log('Start time 24h:', this.startTime);
  }

  onEndTimeChange(time: string | null | undefined) {
    this.endTime = this.convertDisplayTo24h(this.endTimeDisplay);
    if (!this.startTime) {
      this.showMessage('Formato de hora inválido', 'error');
      return;
    }
    console.log('End time 24h:', this.endTime);
  }

  submitForm() {
    if (!this.editMode) {
      if (!this.validateReservation()) return;

      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '350px',
        data: {
          title: 'Confirmar creación',
          message: `¿Desea crear la nueva reservación?`
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;

        const payload = {
          userId: this.userId,
          courtId: this.courtId,
          date: this.reservationDate,
          startTime: this.startTime,
          endTime: this.endTime,
          status: this.status
        };

        this.http.post<ReservationDTO>('http://localhost:8080/api/reservations', payload)
          .subscribe({
            next: res => {
              const user = this.users.find(u => u.id === res.userId);
              res.userFullName = user ? `${user.firstName} ${user.lastName}` : '';
              const court = this.courts.find(c => c.id === res.courtId);
              res.courtName = court ? court.name : '';
              res.selected = false;

              // Convertir a formato AM/PM
              const start = new Date(`${res.date}T${res.startTime}`);
              const end = new Date(`${res.date}T${res.endTime}`);
              res.startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
              res.endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

              this.reservations.push(res);
              this.filterReservations();
              this.cancelForm();
              this.showMessage(`Reservación creada para "${res.userFullName}" en cancha "${res.courtName}".`, 'success');
            },
            error: err => {
              console.error(err);
              const msg = err?.error?.message || `Error al crear la reservación: ${err.message}`;
              this.showMessage(msg);
            }
          });
      });

    } else if (this.editingReservationId) {
      const existing = this.reservations.find(r => r.id === this.editingReservationId);
      if (!existing) return;

      // 🔹 Convertir a 24h antes de enviar
      this.startTime = this.convertDisplayTo24h(this.startTimeDisplay);
      this.endTime = this.convertDisplayTo24h(this.endTimeDisplay);
      
      if (existing.status === 'CONFIRMED' || existing.status === 'FINISHED') {
        this.showMessage('No se puede editar una reserva confirmada o finalizada.');
        return;
      }

      const payload: any = {};
      if (this.userId !== null && this.userId !== existing.userId) payload.userId = this.userId;
      if (this.courtId && this.courtId !== existing.courtId) payload.courtId = this.courtId;
      if (this.reservationDate && this.reservationDate !== existing.date) payload.date = this.reservationDate;
      if (this.status && this.status !== existing.status) payload.status = this.status;
      if (this.startTime && this.startTime !== existing.startTime) payload.startTime = this.startTime;
      if (this.endTime && this.endTime !== existing.endTime) payload.endTime = this.endTime;

      if (Object.keys(payload).length === 0) {
        this.showMessage('No se detectaron cambios en la reservación.');
        return;
      }

      if (!this.validateReservation()) return;

      // 🔹 Confirmar antes de editar
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '350px',
        data: {
          title: 'Confirmar actualización',
          message: `¿Desea guardar los cambios de esta reservación?`
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;

        this.http.put<ReservationDTO>(`http://localhost:8080/api/reservations/${this.editingReservationId}`, payload)
          .subscribe({
            next: res => {
              const index = this.reservations.findIndex(r => r.id === this.editingReservationId);
              if (index !== -1) {
                const user = this.users.find(u => u.id === res.userId);
                res.userFullName = user ? `${user.firstName} ${user.lastName}` : '';
                const court = this.courts.find(c => c.id === res.courtId);
                res.courtName = court ? court.name : '';
                res.selected = false;

                const start = new Date(`${res.date}T${res.startTime}`);
                const end = new Date(`${res.date}T${res.endTime}`);
                res.startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                res.endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

                this.reservations[index] = res;
                this.filterReservations();
              }
              this.cancelForm();
              this.showMessage(`Reservación actualizada para "${res.userFullName}".`, 'success');
            },
            error: err => {
              console.error(err);
              const msg = err?.error?.message || `Error al actualizar la reservación: ${err.message}`;
              this.showMessage(msg);
            }
          });
      });
    }
  }

  cancelReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar cancelación',
        message: `¿Cancelar reservación "${res.code}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.http.delete(`http://localhost:8080/api/reservations/${res.id}/cancel`).subscribe({
        next: () => {
          const index = this.reservations.findIndex(r => r.id === res.id);
          if (index !== -1) {
            this.reservations[index].status = 'CANCELLED';
            this.reservations[index].selected = false;
            this.removeFromSelectionById(res.id);
            this.filterReservations();

          }
          this.showMessage(`Reservación "${res.code}" cancelada.`, 'success');
        },
        error: err => {
          console.error('Error al cancelar:', err);
          this.showMessage('Error al cancelar la reservación.');
        }
      });

    });
  }

  formatToAMPM(time: string): string {
  // Convierte cualquier "HH:mm" o "hh:mm" a "hh:mm AM/PM"
  if (!time) return '';

  let [hour, minute] = time.split(':').map(Number);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')} ${ampm}`;
}


  private to24Hour(time: string): string {
    const t = time.trim().toLowerCase().replace(/\s/g, '');
    const match = t.match(/(\d{1,2}):(\d{2})(a|p)/);
    if (!match) return time;

    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const ampm = match[3];

    if (ampm === 'p' && hour < 12) hour += 12;
    if (ampm === 'a' && hour === 12) hour = 0;

    return `${hour.toString().padStart(2,'0')}:${minute}`;
  }


  reactivateReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar reactivación',
        message: `¿Reactivar reservación de "${res.code}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;
      console.log('Payload a enviar:', res);

      this.http.patch<ReservationDTO>(
        `http://localhost:8080/api/reservations/${res.id}/reactivate`,
        {}
      ).subscribe({
        next: updated => {
          // Actualizar la lista de forma inmutable
          this.reservations = this.reservations.map(r =>
            r.id === updated.id ? { ...updated, selected: false } : r
          );
          this.removeFromSelectionById(res.id);
          this.filterReservations();
          this.showMessage(`Reservación "${res.code}" reactivada.`, 'success');
        },
        error: err => {
                console.log('Payload a enviar:', res);
          console.error('Error al reactivar:', err);
          this.showMessage('No se puede reactivar: ya existe una reserva en ese horario o ocurrió un error.', 'error');
        }
      });
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
        if (res.status === 'CANCELLED') {
          if (!this.selectedReservationsReactivate.some(r => r.id === res.id))
            this.selectedReservationsReactivate.push(res);
        } else {
          if (!this.selectedReservations.some(r => r.id === res.id))
            this.selectedReservations.push(res);
        }
      } else {
        this.selectedReservations = this.selectedReservations.filter(r => r.id !== res.id);
        this.selectedReservationsReactivate = this.selectedReservationsReactivate.filter(r => r.id !== res.id);
      }
    });

    if (!checked) {
      this.selectedReservations = [];
      this.selectedReservationsReactivate = [];
    }

    this.setupPagination(); // refresca la tabla
  }

  toggleSelectAllPage(event: any) {
    const checked = (event.target as HTMLInputElement).checked;
        this.filteredReservations.forEach(res => {
      if (res.status === 'CONFIRMED' || res.status === 'FINISHED') return;
      if (res.status === 'CANCELLED' && !this.canSelectForReactivation(res)) return;

      res.selected = checked;
      if (checked) {
        if (res.status === 'CANCELLED') {
          if (!this.selectedReservationsReactivate.some(r => r.id === res.id))
            this.selectedReservationsReactivate.push(res);
        } else {
          if (!this.selectedReservations.some(r => r.id === res.id))
            this.selectedReservations.push(res);
        }
      } else {
        this.selectedReservations = this.selectedReservations.filter(r => r.id !== res.id);
        this.selectedReservationsReactivate = this.selectedReservationsReactivate.filter(r => r.id !== res.id);
      }
    });
  }

  areAllSelectedOnPage(): boolean {
    return (
      this.pagedReservations.length > 0 &&
      this.pagedReservations.every(
        r =>
          r.selected ||
          r.status === 'CONFIRMED' ||
          r.status === 'FINISHED'
      )
    );
  }

  // ------------- Masivas -------------
  cancelSelected() {
    if (this.selectedReservations.length === 0) return;

    // clonamos para evitar mutaciones mientras iteramos
    const snapshot = [...this.selectedReservations];
    snapshot.forEach(res => {
      this.http.delete(`http://localhost:8080/api/reservations/${res.id}/cancel`).subscribe({
        next: () => {
          const index = this.reservations.findIndex(r => r.id === res.id);
          if (index !== -1) this.reservations[index].status = 'CANCELLED';
          this.removeFromSelectionById(res.id);
          this.filterReservations();
        },
        error: err => console.error('Error al cancelar:', err)
      });
    });

    this.selectedReservations = [];
    this.showMessage('Reservaciones seleccionadas canceladas.', 'success');
  }

  reactivateSelected() {
    if (this.selectedReservationsReactivate.length === 0) return;

    const snapshot = [...this.selectedReservationsReactivate];

    for (let res of snapshot) {
      // Convertir a formato 24h seguro
      const start24 = this.convertDisplayTo24h(res.startTime); 
      const end24 = this.convertDisplayTo24h(res.endTime);

      // Verificar solapamiento
      const overlapping = this.reservations.some(r => {
        if (r.id === res.id || r.status === 'CANCELLED') return false;
        if (r.courtId !== res.courtId || r.date !== res.date) return false;

        const rStart24 = this.to24Hour(r.startTime);
        const rEnd24 = this.to24Hour(r.endTime);

        return !(end24 <= rStart24 || start24 >= rEnd24);
      });

      if (overlapping) {
        this.showMessage(
          `No se puede reactivar la reserva de "${res.userFullName}" por solapamiento de horario.`,
          'warning'
        );
        continue; // pasar a la siguiente reserva
      }

      const payload = {
        userId: res.userId,
        courtId: res.courtId,
        date: res.date,
        startTime: start24,
        endTime: end24,
        status: 'PENDING'
      };

      // Usar PATCH como en reactivateReservation si solo cambias estado
      this.http.patch<ReservationDTO>(
        `http://localhost:8080/api/reservations/${res.id}/reactivate`,
        {}
      ).subscribe({
        next: updated => {
          // Actualizar lista de manera inmutable
          this.reservations = this.reservations.map(r =>
            r.id === updated.id ? { ...updated, selected: false } : r
          );
          this.removeFromSelectionById(res.id);
          this.filterReservations();
        },
        error: err => {
          console.error('Error al reactivar:', err);
          this.showMessage(
            `No se puede reactivar la reserva de "${res.userFullName}".`,
            'error'
          );
        }
      });
    }

    // Limpiar selección y mensaje final
    this.selectedReservationsReactivate = [];
    this.showMessage('Reservaciones seleccionadas reactivadas.', 'success');
  }

  // ------------- Selección -------------
  areAllSelected(): boolean {
    const selectable = this.pagedReservations.filter(r => r.status !== 'CONFIRMED' && r.status !== 'FINISHED');
    return selectable.length > 0 && selectable.every(r => !!r.selected);
  }

  onReservationSelect(res: ReservationDTO, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    res.selected = checked;

    if (checked) {
      // agregar sin duplicar
      if (res.status === 'CANCELLED') {
        if (!this.selectedReservationsReactivate.some(x => x.id === res.id)) this.selectedReservationsReactivate.push(res);
      } else {
        if (!this.selectedReservations.some(x => x.id === res.id)) this.selectedReservations.push(res);
      }
    } else {
      this.selectedReservations = this.selectedReservations.filter(r => r.id !== res.id);
      this.selectedReservationsReactivate = this.selectedReservationsReactivate.filter(r => r.id !== res.id);
    }
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    // Aplicar solo a la página actual
    this.pagedReservations.forEach(res => {
      if (res.status === 'CONFIRMED' || res.status === 'FINISHED') return;
      res.selected = checked;
      
      if (checked) {
        if (res.status === 'CANCELLED') {
          if (!this.selectedReservationsReactivate.some(x => x.id === res.id)) this.selectedReservationsReactivate.push(res);
        } else {
          if (!this.selectedReservations.some(x => x.id === res.id)) this.selectedReservations.push(res);
        }
      } else {
        this.selectedReservations = this.selectedReservations.filter(r => r.id !== res.id);
        this.selectedReservationsReactivate = this.selectedReservationsReactivate.filter(r => r.id !== res.id);
      }
    });
  }

  private removeFromSelectionById(id: string) {
    this.selectedReservations = this.selectedReservations.filter(r => r.id !== id);
    this.selectedReservationsReactivate = this.selectedReservationsReactivate.filter(r => r.id !== id);
  }

  // ------------- Paginación -------------
  setupPagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredReservations.length / this.itemsPerPage));
    // asegurar que currentPage esté en rango
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.pagedReservations = this.filteredReservations.slice(start, end).map(r => ({ ...r })); // copia defensiva

    // Si la página actual queda vacía (por ejemplo borraste todos de esa página), bajar una página y recalcular
    if (this.pagedReservations.length === 0 && this.currentPage > 1) {
      this.currentPage--;
      this.setupPagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.setupPagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.setupPagination();
    }
  }

  translateReservationStatus(status: string): string {
    switch(status) {
      case 'PENDING': return 'Pendiente';
      case 'CONFIRMED': return 'Confirmada';
      case 'FINISHED': return 'Finalizada';
      case 'CANCELLED': return 'Cancelada';
      // por si vienen traducciones en español directamente
      case 'Pendiente': return 'Pendiente';
      case 'Confirmada': return 'Confirmada';
      case 'Finalizada': return 'Finalizada';
      case 'Cancelada': return 'Cancelada';
      default: return status;
    }
  }
}
