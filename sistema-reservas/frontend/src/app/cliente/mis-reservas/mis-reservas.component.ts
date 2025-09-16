import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ReservationPendingService } from '../../services/reservation-pending.service';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { PaymentService, PaymentRequest, InvoiceDTO } from '../../services/payment.service';
import { PaymentMethodDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-method-dialog.component';
import { PaymentFormDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-form-dialog.component';
import { InvoiceDialogComponent } from '../../shared/notificaciones/invoice/invoice-dialog.component';

interface ReservationDTO {
  id: number;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

@Component({
  selector: 'app-mis-reservas',
  templateUrl: './mis-reservas.html',
  styleUrls: ['./mis-reservas.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class MisReservasComponent implements OnInit {
  isSidePanelClosed = true;
  manualClose = false;
  userEmail = '';
  userRole = '';
  searchTerm = '';

  reservations: ReservationDTO[] = [];
  invoice: InvoiceDTO | null = null;

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

  ngOnInit() {
    this.loadUserReservations();
  }

  // Sidebar
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

  // Cargar reservas del usuario
  loadUserReservations() {
    const userId = this.auth.getUserId();
    if (!userId) return;

    this.http.get<ReservationDTO[]>(`http://localhost:8080/api/reservations/user/${userId}`)
      .subscribe(res => {
        this.reservations = res;

        // Mostrar notificación si hay una reserva pendiente
        const pending = res.find(r => r.status === 'PENDING');
        if (pending && !this.pendingService.hasActiveReservation()) {
          this.pendingService.startPendingReservation(
            pending.id,
            0,
            pending.courtName,
            pending.startTime,
            pending.endTime
          );
        }
      });
  }

  // Confirmar reserva con opción de pago
  confirmReservation(reservationId: number) {
    const methodDialog = this.dialog.open(PaymentMethodDialogComponent);

    const methodSub = methodDialog.afterClosed().subscribe((method: 'CARD' | 'CASH') => {
      methodSub.unsubscribe();

      if (!method) {
        this.pendingService.cancelReservation();
        return;
      }

      const reservation = this.reservations.find(r => r.id === reservationId);
      if (reservation) {
        this.pendingService.startPendingReservation(
          reservation.id,
          0,
          reservation.courtName,
          reservation.startTime,
          reservation.endTime
        );
      }

      const formDialog = this.dialog.open(PaymentFormDialogComponent, {
        width: '600px',
        data: { reservationId, method }
      });

      const formSub = formDialog.afterClosed().subscribe(formData => {
        formSub.unsubscribe();

        if (!formData) {
          this.pendingService.cancelReservation();
          return;
        }

        const paymentRequest: PaymentRequest = {
          amount: formData.amount ?? 0,
          method: method,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          // opcionalmente, puedes incluir cardNumber si es tarjeta
          cardNumber: method === 'CARD' ? formData.cardNumber : undefined
        };

        this.paymentService.payReservation(reservationId, paymentRequest).subscribe({
          next: (inv: InvoiceDTO) => {
            this.invoice = inv;
            this.notificationService.show('Reserva confirmada correctamente', 'success');
            this.loadUserReservations();
            this.pendingService.cancelReservation();
          },
          error: () => {
            this.notificationService.show('Error al procesar el pago', 'error');
            this.pendingService.cancelReservation();
          }
        });
      });
    });
  }

  // Cancelar reserva pendiente
  cancelReservation(reservationId: number) {
    const userId = this.auth.getUserId();
    if (!userId) return;

    this.http.delete(`http://localhost:8080/api/reservations/${reservationId}`)
      .subscribe({
        next: () => {
          this.notificationService.show('Reserva cancelada correctamente', 'error');
          this.loadUserReservations();
        },
        error: () => {
          this.notificationService.show('Error al cancelar la reserva', 'error');
        }
      });
  }

  // Ver factura de reserva confirmada
  viewInvoice(reservationId: number) {
    this.paymentService.getInvoiceByReservation(reservationId).subscribe({
      next: (data) => {
        this.dialog.open(InvoiceDialogComponent, {
          width: '600px',
          data: { invoice: data }
        });
      },
      error: () => {
        this.notificationService.show('Error al cargar la factura', 'error');
      }
    });
  }

  // Filtro de búsqueda
  get filteredReservations(): ReservationDTO[] {
    const term = this.searchTerm.toLowerCase();
    return this.reservations.filter(r =>
      r.courtName.toLowerCase().includes(term) ||
      r.date.toLowerCase().includes(term)
    );
  }

  // ¿Hay reservas pendientes?
  get hasPendingReservations(): boolean {
    return this.reservations.some(r => r.status === 'PENDING');
  }
}
