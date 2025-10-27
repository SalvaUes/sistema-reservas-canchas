import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../usuarios/confirm-dialog.component';
import { InvoiceDialogComponent, InvoiceDialogData } from '../../shared/notificaciones/invoice/invoice-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';


interface UserDTO { id: number; firstName: string; lastName: string; email: string; }
interface CourtDTO { id: string; name: string; sportType: string; pricePerHour: number; }
interface ReservationDTO {
  id: string;
  code: string
  userId: number;
  userFullName: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  previousStatus?: string; // Para controlar reactivación
}

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,  MatTooltipModule],
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.scss'],
})
export class ReservasComponent implements OnInit {
  reservations: ReservationDTO[] = [];
  filteredReservations: ReservationDTO[] = [];
  users: UserDTO[] = [];
  courts: CourtDTO[] = [];

  searchTerm = '';
  filterStatus: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  showForm = false;
  editMode = false;
  editingReservationId: string | null = null;

  userId: number | null = null;
  courtId = '';
  reservationDate = '';
  startTime = '';
  endTime = '';
  status = 'PENDIENTE';

  isSidePanelClosed = true;
  userEmail = '';
  userRole = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.userEmail = this.auth.getUserEmail() || 'usuario@correo.com';
    this.userRole = this.auth.getUserRole() || 'ROL_NO_DEFINIDO';
  }

  // Este es el método que faltaba
  canReactivate(res: ReservationDTO): boolean {
    return res.status === 'CANCELLED';
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

  private showMessage(msg: string) {
    this.snackBar.open(msg, 'Cerrar', { duration: 4000, horizontalPosition: 'center', verticalPosition: 'top' });
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
        this.reservations = res.map(r => this.updateReservationStatus(r));
        this.filterReservations();
      },
      error: err => { console.error(err); this.showMessage('Error al cargar las reservaciones.'); }
    });
  }

  private updateReservationStatus(res: ReservationDTO): ReservationDTO {
    const now = new Date();
    const end = new Date(`${res.date}T${res.endTime}`);
    if (res.status === 'PENDING' && end < now) {
      res.status = 'FINALIZADA';
      this.http.put(`http://localhost:8080/api/reservations/${res.id}`, {
        userId: res.userId,
        courtId: res.courtId,
        date: res.date,
        startTime: res.startTime,
        endTime: res.endTime,
        status: res.status
      }).subscribe();
    }
    return res;
  }

  filterReservations() {
    const term = this.searchTerm.toLowerCase();
  
    // Filtrar por término de búsqueda (usuario, cancha, fecha, código)
    let results = this.reservations.filter(
      r =>
        r.userFullName.toLowerCase().includes(term) ||
        r.courtName.toLowerCase().includes(term) ||
        r.date.includes(term) ||
        r.code.toLowerCase().includes(term)
    );
  
    // Filtrar por estado (si se seleccionó alguno)
    if (this.filterStatus) {
      results = results.filter(r => r.status === this.filterStatus);
    }
  
    // Ordenar por fecha según dirección actual
    results.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });
  
    this.filteredReservations = results;
  }
  
  toggleSortByDate() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.filterReservations();
  }

  canShowInvoice(res: ReservationDTO): boolean {
    return res.status === 'CONFIRMED' && !!res.id;
  }

  openInvoice(res: ReservationDTO) {
    this.http.get<{ hasInvoice: boolean; invoice?: InvoiceDialogData['invoice'] }>(
      `http://localhost:8080/api/payments/reservation/${res.id}`
    ).subscribe({
      next: data => {
        if (data.hasInvoice && data.invoice) {
          // Envolver en { invoice: ... } para el componente
          this.dialog.open(InvoiceDialogComponent, {
            width: '600px',
            data: { invoice: data.invoice }
          });
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
      this.startTime = res.startTime;
      this.endTime = res.endTime;
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
  if (!this.userId || !this.courtId || !this.reservationDate || !this.startTime || !this.endTime) {
      this.showMessage('Complete todos los campos obligatorios.');
      return false;
    }

    const now = new Date();
    const start = new Date(`${this.reservationDate}T${this.startTime}`);
    const end = new Date(`${this.reservationDate}T${this.endTime}`);

    if (start < now) {
      this.showMessage('No puede reservar en fecha/hora pasada.');
      return false;
    }

    // Validar que la reserva dure al menos 1 hora
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    if (durationMinutes < 60) {
      this.showMessage('La reservación debe durar al menos 1 hora.');
      return false;
    }

    // Validar solapamiento con otras reservas
    const overlapping = this.reservations.some(r =>
      r.courtId === this.courtId &&
      r.id !== this.editingReservationId &&
      r.date === this.reservationDate &&
      !(this.endTime <= r.startTime || this.startTime >= r.endTime) &&
      r.status !== 'CANCELLED'
    );

    if (overlapping) {
      this.showMessage('Ya existe una reserva en ese horario para esta cancha.');
      return false;
    }

    return true;
  }

  // Editar o crear reservación
  submitForm() {
    if (!this.editMode) {
      // Crear nueva reserva
      if (!this.validateReservation()) return;

      const payload = {
        userId: this.userId,
        courtId: this.courtId,
        date: this.reservationDate,
        startTime: `${this.startTime.split(':')[0]}:00`,
        endTime: `${this.endTime.split(':')[0]}:00`,
        status: this.status
      };

      this.http.post<ReservationDTO>('http://localhost:8080/api/reservations', payload)
        .subscribe({
          next: res => {
            const user = this.users.find(u => u.id === res.userId);
            res.userFullName = user ? `${user.firstName} ${user.lastName}` : '';
            const court = this.courts.find(c => c.id === res.courtId);
            res.courtName = court ? court.name : '';
            this.reservations.push(res);
            this.filterReservations();
            this.cancelForm();
            this.showMessage(`Reservación creada para "${res.userFullName}" en cancha "${res.courtName}".`);
          },
          error: err => {
            console.error(err);
            const msg = err?.error?.message || `Error al crear la reservación: ${err.message}`;
            this.showMessage(msg);
          }
        });

    } else if (this.editingReservationId) {
      // Editar reserva existente
      const existing = this.reservations.find(r => r.id === this.editingReservationId);
      if (!existing) return;

      if (existing.status === 'CONFIRMED' || existing.status === 'FINISHED') {
        this.showMessage('No se puede editar una reserva confirmada o finalizada.');
        return;
      }

      // Detectar cambios
      const payload: any = {};
      let onlyUserChanged = false;

      if (this.userId !== null && this.userId !== existing.userId) {
        payload.userId = this.userId;
        onlyUserChanged = true;
      }

      if (this.courtId && this.courtId !== existing.courtId) payload.courtId = this.courtId;
      if (this.reservationDate && this.reservationDate !== existing.date) payload.date = this.reservationDate;
      if (this.startTime && this.startTime !== existing.startTime) payload.startTime = `${this.startTime.split(':')[0]}:${this.startTime.split(':')[1] || '00'}`;
      if (this.endTime && this.endTime !== existing.endTime) payload.endTime = `${this.endTime.split(':')[0]}:${this.endTime.split(':')[1] || '00'}`;
      if (this.status && this.status !== existing.status) payload.status = this.status;

      // Si no hay cambios, no hacer nada
      if (Object.keys(payload).length === 0) {
        this.showMessage('No se detectaron cambios en la reservación.');
        return;
      }

      // Validar solo si no es solo cambio de usuario
      if (!onlyUserChanged && !this.validateReservation()) return;

      // Llamada PATCH o PUT según corresponda
      const request$ = onlyUserChanged
        ? this.http.patch<ReservationDTO>(`http://localhost:8080/api/reservations/${this.editingReservationId}/user`, { userId: this.userId })
        : this.http.put<ReservationDTO>(`http://localhost:8080/api/reservations/${this.editingReservationId}`, payload);

      request$.subscribe({
        next: res => {
          const index = this.reservations.findIndex(r => r.id === this.editingReservationId);
          if (index !== -1) {
            const user = this.users.find(u => u.id === res.userId);
            res.userFullName = user ? `${user.firstName} ${user.lastName}` : '';
            const court = this.courts.find(c => c.id === res.courtId);
            res.courtName = court ? court.name : '';
            this.reservations[index] = res;
            this.filterReservations();
          }
          this.cancelForm();
          this.showMessage(`Reservación actualizada para "${res.userFullName}".`);
        },
        error: err => {
          console.error(err);
          const msg = err?.error?.message || `Error al actualizar la reservación: ${err.message}`;
          this.showMessage(msg);
        }
      });
    }
  }

  // Cancelar reservación usando DELETE
  cancelReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar cancelación',
        message: `¿Cancelar reservación de "${res.userFullName}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      this.http.delete(`http://localhost:8080/api/reservations/${res.id}`).subscribe({
        next: () => {
          // Solo actualizar el estado en frontend
          const index = this.reservations.findIndex(r => r.id === res.id);
          if (index !== -1) {
            this.reservations[index].status = 'CANCELLED';
            this.filterReservations();
          }
          this.showMessage(`Reservación de "${res.userFullName}" cancelada.`);
        },
        error: err => {
          console.error('Error al cancelar:', err);
          this.showMessage('Error al cancelar la reservación.');
        }
      });
    });
  }

  // Reactivar reservación usando PUT
  reactivateReservation(res: ReservationDTO) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar reactivación',
        message: `¿Reactivar reservación de "${res.userFullName}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      // Construir payload de reactivación
      const payload = {
        userId: res.userId,
        courtId: res.courtId,
        date: res.date,
        startTime: res.startTime,
        endTime: res.endTime,
        status: 'PENDING'
      };

      // Validar solapamiento con otras reservas
      const overlapping = this.reservations.some(r =>
        r.courtId === res.courtId &&
        r.id !== res.id &&
        r.date === res.date &&
        !(res.endTime <= r.startTime || res.startTime >= r.endTime) &&
        r.status !== 'CANCELLED'
      );

      if (overlapping) {
        this.showMessage('No se puede reactivar: ya existe una reserva en ese horario para esta cancha. Cambie la fecha u hora antes de reactivar.');
        return;
      }

      // Reactivar
      this.http.put<ReservationDTO>(`http://localhost:8080/api/reservations/${res.id}`, payload).subscribe({
        next: updated => {
          const index = this.reservations.findIndex(r => r.id === res.id);
          if (index !== -1) {
            this.reservations[index] = updated;
            this.filterReservations();
          }
          this.showMessage(`Reservación de "${res.userFullName}" reactivada.`);
        },
        error: err => {
          console.error('Error al reactivar:', err);
          this.showMessage('Error al reactivar la reservación.');
        }
      });
    });
  }



  translateReservationStatus(status: string): string {
    switch(status) {
      case 'PENDING': return 'Pendiente';
      case 'CONFIRMED': return 'Confirmada';
      case 'FINISHED': return 'Finalizada';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  }
}
