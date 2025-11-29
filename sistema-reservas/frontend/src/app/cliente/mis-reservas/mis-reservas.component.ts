import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { interval, Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ReservationPendingService } from '../../services/reservation/reservation-pending.service';
import { ReservationService, ReservationDTO } from '../../services/reservation/reservation.service';
import { ReservationReactivatedService } from '../../services/reservation/reservation-reactivated.service';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { PaymentService, PaymentRequest, InvoiceDTO } from '../../services/payment.service';
import { PaymentMethodDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-method-dialog.component';
import { PaymentFormDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-form-dialog.component';
import { InvoiceDialogComponent } from '../../shared/notificaciones/invoice/invoice-dialog.component';

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'FINISHED' | 'CANCELLED' | 'REACTIVATED' | '';

@Component({
  selector: 'app-mis-reservas',
  templateUrl: './mis-reservas.html',
  styleUrls: ['./mis-reservas.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatDialogModule]
})
export class MisReservasComponent implements OnInit, OnDestroy {
  searchTerm = '';

  reservations: ReservationDTO[] = [];
  invoice: InvoiceDTO | null = null;
  filteredReservations: ReservationDTO[] = [];
  
  private uiTimerSub: Subscription | null = null;
  private dataPollingSub: Subscription | null = null;
  private serviceSubs = new Subscription();
  
  filterStatus: ReservationStatus = '';
  status: ReservationStatus | string = 'PENDING';  
  sortDirection: 'asc' | 'desc' = 'asc';
  pagedReservations: ReservationDTO[] = [];
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  constructor(
    private reservationService: ReservationService,
    public auth: AuthService, 
    private dialog: MatDialog,
    private pendingService: ReservationPendingService,
    private reactivatedService: ReservationReactivatedService,
    private notificationService: NotificationService,
    private paymentService: PaymentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUserReservations();

    this.dataPollingSub = interval(5000).subscribe(() => this.loadUserReservations(true));

    this.serviceSubs.add(
        this.auth.authError$.subscribe(err => {
            if (err) {
                this.stopPolling();
            }
        })
    );

    this.serviceSubs.add(
      this.pendingService.reservationCancelled.subscribe(({ reservationId }) => {
        this.updateLocalStatus(reservationId, 'CANCELLED');
        setTimeout(() => this.loadUserReservations(true), 300);
      })
    );

    this.serviceSubs.add(
      this.pendingService.reservationStarted.subscribe(() => {
        setTimeout(() => this.loadUserReservations(true), 300);
      })
    );

    this.serviceSubs.add(
      this.reactivatedService.reservationReactivated.subscribe(event => {
        if (event.reservationId && event.reactived) {
          this.updateLocalStatus(event.reservationId, 'REACTIVATED');
          setTimeout(() => this.loadUserReservations(true), 300);
        }
      })
    );

    this.uiTimerSub = interval(1000).subscribe(() => {
        this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.uiTimerSub?.unsubscribe();
    this.serviceSubs.unsubscribe();
  }

  private stopPolling() {
      if (this.dataPollingSub) {
          this.dataPollingSub.unsubscribe();
          this.dataPollingSub = null;
      }
  }

  isExpired(r: ReservationDTO): boolean {
    if (r.status !== 'PENDING' && r.status !== 'REACTIVATED') return false;

    if (r.createdAt) {
        const serviceRemaining = this.pendingService.getRemainingTime(r.id);
        if (serviceRemaining !== null) {
            return serviceRemaining <= 0;
        }
        const createdTime = new Date(r.createdAt).getTime();
        const expireTime = createdTime + (3 * 60 * 1000);
        return Date.now() > expireTime;
    }
    return false;
  }

  private updateLocalStatus(id: string, newStatus: ReservationStatus) {
    const r = this.reservations.find(x => x.id === id);
    if (r) {
      r.status = newStatus;
      if (this.filterStatus && this.filterStatus !== newStatus) {
          this.filterReservations();
      }
    }
    this.cdr.detectChanges();
  }

  private loadUserReservations(reloadFromServer: boolean = true): void {
    if (!reloadFromServer) {
      this.filterReservations();
      return;
    }

    this.reservationService.getMyReservations().subscribe({
      next: (res) => {
        this.reservations = res.map(r => {
          (r as any).startTimeRaw = r.startTime;
          (r as any).endTimeRaw = r.endTime;

          const start = new Date(`${r.date}T${r.startTime}`);
          const end = new Date(`${r.date}T${r.endTime}`);
          
          r.startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          r.endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          
          return r;
        });

        this.filterReservations();

        const activePending = this.reservations.find(r => r.status === 'PENDING' || r.status === 'REACTIVATED');
        
        if (activePending) {
           if (!this.isExpired(activePending)) {
               const rawStart = (activePending as any).startTimeRaw;
               const rawEnd = (activePending as any).endTimeRaw;
               
               this.pendingService.startPendingReservation(
                 activePending.id,
                 activePending.code,
                 activePending.date,
                 activePending.courtName,
                 rawStart,
                 rawEnd,
                 activePending.createdAt
               );
           } else {
               this.pendingService.forceCloseReservation();
           }
        }
      },
      error: (err) => {
          // 💡 MANEJO DE ERRORES DE BLOQUEO
          if (err.status === 403 || err.status === 401) {
              // Si estamos bloqueados, detenemos el polling para no ensuciar la consola
              this.stopPolling();
              return; 
          }
          console.error('Error cargando reservas', err);
      }
    });
  }

  confirmReservation(reservationId: string): void {
    const methodDialog = this.dialog.open(PaymentMethodDialogComponent);
    const methodSub = methodDialog.afterClosed().subscribe((method: 'CARD' | 'CASH') => {
      methodSub.unsubscribe();
      if (!method) return;
      const reservation = this.reservations.find(r => r.id === reservationId);
      if (reservation && this.pendingService.hasActiveReservation()) {
        this.pendingService.onPaymentAttempt();
      }
      const formDialog = this.dialog.open(PaymentFormDialogComponent, {
        width: '600px', data: { reservationId, method }
      });
      const formSub = formDialog.afterClosed().subscribe(formData => {
        formSub.unsubscribe();
        if (!formData) { this.pendingService.revertExtension(); return; }
        const paymentRequest: PaymentRequest = {
          amount: formData.amount ?? 0, method: method, customerName: formData.customerName, customerEmail: formData.customerEmail, customerPhone: formData.customerPhone, cardNumber: method === 'CARD' ? formData.cardNumber : undefined, cardExpiry: method === 'CARD' ? formData.cardExpiry : undefined
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

  cancelReservation(reservationId: string): void { this.pendingService.cancelReservation(false); }

  viewInvoice(reservationId: string): void {
    this.paymentService.getReservationInvoiceStatus(reservationId).subscribe({
      next: (res: any) => {
        if (res.hasInvoice) { this.dialog.open(InvoiceDialogComponent, { width: '600px', data: { invoice: res.invoice } }); } else { this.notificationService.show(res.message || 'No existe factura para esta reserva', 'error'); }
      },
      error: () => { this.notificationService.show('Error al cargar la factura', 'error'); }
    });
  }

  logout(): void { this.auth.logout(); location.href = '/login'; }

  translateStatus(reservation: ReservationDTO): string {
    if (reservation.status === 'PENDING' || reservation.status === 'REACTIVATED') {
      if (this.isExpired(reservation)) return 'Expirado';

      const remainingMs = this.pendingService.getRemainingTime(reservation.id) ?? 0;
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      const label = reservation.status === 'PENDING' ? 'Pendiente' : 'Reactivada';
      return `${label} (${minutes}m ${seconds}s)`;
    }
    return reservation.status === 'CONFIRMED' ? 'Confirmada' : reservation.status === 'CANCELLED' ? 'Cancelada' : 'Finalizada';
  }

  filterReservations() {
    let results = this.reservations.slice();
    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      results = results.filter(r =>
        (r.status || '').toLowerCase().includes(term) || (r.courtName || '').toLowerCase().includes(term) || (r.date || '').toLowerCase().includes(term) || (r.code || '').toLowerCase().includes(term)
      );
    }
    if (this.filterStatus) results = results.filter(r => r.status === this.filterStatus);
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
  onSearchTermChange(): void { this.currentPage = 1; this.setupPagination(); }
  setupPagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredReservations.length / this.itemsPerPage));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.pagedReservations = this.filteredReservations.slice(start, start + this.itemsPerPage).map(r => ({ ...r }));
    if (this.pagedReservations.length === 0 && this.currentPage > 1) { this.currentPage--; this.setupPagination(); }
  }
  translateReservationStatus(status: string): string {
    return status === 'PENDING' ? 'Pendiente' : status === 'CONFIRMED' ? 'Confirmada' : status === 'FINISHED' ? 'Finalizada' : status === 'CANCELLED' ? 'Cancelada' : 'Reactivada';
  }
  nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.setupPagination(); } }
  previousPage() { if (this.currentPage > 1) { this.currentPage--; this.setupPagination(); } }
  get hasPendingReservations(): boolean { return this.reservations.some(r => r.status === 'PENDING' || r.status === 'REACTIVATED'); }
}