import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ReservationPendingService } from '../../services/reservation/reservation-pending.service';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { PaymentService, PaymentRequest, InvoiceDTO } from '../../services/payment.service';
import { PaymentMethodDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-method-dialog.component';
import { PaymentFormDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-form-dialog.component';
import { InvoiceDialogComponent } from '../../shared/notificaciones/invoice/invoice-dialog.component';

interface ReservationDTO {
  id: string;
  userFullName: string;
  code: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'FINISHED' | 'CANCELLED' | 'REACTIVATED' | '';


@Component({
  selector: 'app-mis-reservas',
  templateUrl: './mis-reservas.html',
  styleUrls: ['./mis-reservas.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatDialogModule]
})
export class MisReservasComponent implements OnInit, OnDestroy {
  // --- UI State ---
  isSidePanelClosed = true;
  manualClose = false;
  searchTerm = '';

  // --- User & Data ---
  userEmail = '';
  userRole = '';
  reservations: ReservationDTO[] = [];
  invoice: InvoiceDTO | null = null;

  filteredReservations: ReservationDTO[] = [];

  // --- Timers ---
  private timerSub: Subscription | null = null;

  // --- Filters & Sorting ---
  filterStatus: ReservationStatus = '';
  status: ReservationStatus | string = 'PENDING';  
  sortDirection: 'asc' | 'desc' = 'asc';

  // --- Pagination ---
    pagedReservations: ReservationDTO[] = [];
    currentPage = 1;
    itemsPerPage = 10;
    totalPages = 1;



  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private dialog: MatDialog,
    private pendingService: ReservationPendingService,
    private notificationService: NotificationService,
    private paymentService: PaymentService
  ) {
    this.userEmail = this.auth.getUserEmail() || 'cliente@correo.com';
    this.userRole = this.auth.getUserRole() || 'CLIENTE';
  }

  // ============================================================
  // Ciclo de Vida
  // ============================================================
  ngOnInit(): void {
    // Cargar reservas al inicio
    this.loadUserReservations();

    // ============================================================
    // Escuchar cancelaciones de reservas pendientes
    // ============================================================
    this.pendingService.reservationCancelled.subscribe(({ reservationId, reason }) => {
      const index = this.reservations.findIndex(r => r.id === reservationId);
      if (index !== -1) {
        // Marcar como cancelada
        this.reservations[index].status = 'CANCELLED';

        // Si estamos filtrando solo pendientes, quitar de la lista
        if (this.filterStatus === 'PENDING' || this.filterStatus === 'REACTIVATED') {
          this.reservations.splice(index, 1);
        }
      }

      // Re-filtrar la lista y refrescar tabla/paginación
      this.filterReservations();

    });

    // ============================================================
    // Escuchar inicio o reactivación de reserva pendiente
    // ============================================================
    this.pendingService.reservationStarted.subscribe(() => {
      // Solo refrescar lista local sin recargar todo del backend
      this.loadUserReservations(false);
    });

    // ============================================================
    // Refresco visual del contador en la tabla
    // ============================================================
    this.timerSub = interval(1000).subscribe(() => {
      this.reservations = [...this.reservations]; // refresca binding de Angular
    });
  }

  ngOnDestroy(): void {
    // Detener temporizador
    this.timerSub?.unsubscribe();

    // Cancelar todas las subscripciones internas de PendingService si tienes alguna guardada
    // (si no las guardas, suscribirse directamente con subscribe() no se limpia automáticamente,
    //  pero en este caso solo interval es crítico)
  }



  // ============================================================
  // Carga de Reservas
  // ============================================================
  private loadUserReservations(reloadFromServer: boolean = true): void {
    const userId = this.auth.getUserId();
    if (!userId) return;

    // Solo refrescar contadores si no se recarga del backend
    if (!reloadFromServer) {
      this.filterReservations();
      return;
    }

    this.http.get<ReservationDTO[]>(`http://localhost:8080/api/reservations/user/${userId}`)
      .subscribe(res => {
        // Formatear horas a 12h
        this.reservations = res.map(r => {
          const start = new Date(`${r.date}T${r.startTime}`);
          const end = new Date(`${r.date}T${r.endTime}`);
          r.startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          r.endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          return r;
        });

        // Filtrar y paginar
        this.filterReservations();

        // Buscar reserva pendiente o reactivada
        const activePending = this.reservations.find(r => r.status === 'PENDING' || r.status === 'REACTIVATED');
        if (!activePending) return;

        const active = this.pendingService.getActiveReservation();
        const remaining = this.pendingService.getRemainingTime(activePending.id) ?? 3 * 60 * 1000;

        // Iniciar o actualizar reserva pendiente en el servicio
        if (!active || active.reservationId !== activePending.id) {
          this.pendingService.startPendingReservation(
            activePending.id,
            activePending.code,
            remaining,
            activePending.courtName,
            activePending.startTime,
            activePending.endTime
          );
        } else {
          // Actualizar info si cambió sin reiniciar contador
          if (
            active.startTime !== activePending.startTime ||
            active.endTime !== activePending.endTime ||
            active.courtName !== activePending.courtName
          ) {
            this.pendingService.startPendingReservation(
              activePending.id,
              activePending.code,
              remaining,
              activePending.courtName,
              activePending.startTime,
              activePending.endTime
            );
          }
        }
      });
  }

  // ============================================================
  // Acciones de Reserva
  // ============================================================
  confirmReservation(reservationId: string): void {
    const methodDialog = this.dialog.open(PaymentMethodDialogComponent);

    const methodSub = methodDialog.afterClosed().subscribe((method: 'CARD' | 'CASH') => {
      methodSub.unsubscribe();
      if (!method) return;

      const reservation = this.reservations.find(r => r.id === reservationId);
      if (reservation && this.pendingService.hasActiveReservation()) {
        this.pendingService.extendTimeOnce();
      }

      const formDialog = this.dialog.open(PaymentFormDialogComponent, {
        width: '600px',
        data: { reservationId, method }
      });

      const formSub = formDialog.afterClosed().subscribe(formData => {
        formSub.unsubscribe();
        if (!formData) {
          this.pendingService.revertExtension();
          return;
        }

        const paymentRequest: PaymentRequest = {
          amount: formData.amount ?? 0,
          method: method,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          cardNumber: method === 'CARD' ? formData.cardNumber : undefined,
          cardExpiry: method === 'CARD' ? formData.cardExpiry : undefined
        };

        this.paymentService.payReservation(reservationId, paymentRequest).subscribe({
          next: (inv: InvoiceDTO) => {
            this.invoice = inv;
            this.notificationService.show('Reserva confirmada correctamente', 'success');
            this.loadUserReservations();
            this.pendingService.closeLocalReservation();
            this.filterReservations();
          },
          error: () => {
            this.notificationService.show('Error al procesar el pago', 'error');
            this.pendingService.revertExtension();
          }
        });
      });
    });
  }

  cancelReservation(reservationId: string): void {
    this.http.delete(`http://localhost:8080/api/reservations/${reservationId}/cancel`, { observe: 'response' })
      .subscribe({
        next: (res) => {
          if (res.status === 204) {
            this.pendingService.closeLocalReservation();
            this.notificationService.show('Reserva Cancelada correctamente', 'success');
            this.loadUserReservations();
          }
        },
        error: () => {
          this.notificationService.show('Error al cancelar la reserva', 'error');
        }
      });
  }

  viewInvoice(reservationId: string): void {
    this.paymentService.getReservationInvoiceStatus(reservationId).subscribe({
      next: (res: any) => {
        if (res.hasInvoice) {
          this.dialog.open(InvoiceDialogComponent, {
            width: '600px',
            data: { invoice: res.invoice }
          });
        } else {
          this.notificationService.show(res.message || 'No existe factura para esta reserva', 'error');
        }
      },
      error: () => {
        this.notificationService.show('Error al cargar la factura', 'error');
      }
    });
  }

  // ============================================================
  // UI Helpers
  // ============================================================
  toggleSidePanel(): void {
    this.manualClose = !this.manualClose;
    this.isSidePanelClosed = this.manualClose;
  }

  hoverPanel(state: boolean): void {
    if (!this.manualClose) this.isSidePanelClosed = !state;
  }

  logout(): void {
    this.auth.logout();
    location.href = '/login';
  }

  // ============================================================
  // Utilidades y Filtros
  // ============================================================
  translateStatus(reservation: ReservationDTO): string {
    if (reservation.status === 'PENDING' || reservation.status === 'REACTIVATED') {
      const remainingMs = this.pendingService.getRemainingTime(reservation.id) ?? 0;
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      const label = reservation.status === 'PENDING' ? 'Pendiente' : 'Reactivada';
      return `${label} (${minutes}m ${seconds}s)`;
    }

    switch (reservation.status) {
      case 'CONFIRMED': return 'Confirmada';
      case 'CANCELLED': return 'Cancelada';
      case 'FINISHED': return 'Finalizada';
      default: return reservation.status;
    }
  }

  filterReservations() {
    let results = this.reservations.slice();
    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      results = results.filter(r =>
        (r.status || '').toLowerCase().includes(term) ||
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

  onSearchTermChange(): void {
    this.currentPage = 1; // Reinicia a la primera página
    this.setupPagination();
  }


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


  nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.setupPagination(); } }
  previousPage() { if (this.currentPage > 1) { this.currentPage--; this.setupPagination(); } }


  get hasPendingReservations(): boolean {
    return this.reservations.some(r => r.status === 'PENDING' || r.status === 'REACTIVATED');
  }
}
