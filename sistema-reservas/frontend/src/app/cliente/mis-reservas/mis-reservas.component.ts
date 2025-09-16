import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ReservationPendingService } from '../../services/reservation-pending.service';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { PaymentService, PaymentRequest, InvoiceDTO } from '../../services/payment.service';
import { PaymentMethodDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-method-dialog.component';
import { PaymentFormDialogComponent } from '../../shared/notificaciones/notificacionespago/payment-form-dialog.component';
import { InvoiceDialogComponent } from '../../shared/notificaciones/invoice/invoice-dialog.component';
import { interval, Subscription } from 'rxjs';

interface ReservationDTO {
  id: string;        // UUID
  code: string;       // código legible
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
export class MisReservasComponent implements OnInit, OnDestroy {
  isSidePanelClosed = true;
  manualClose = false;
  userEmail = '';
  userRole = '';
  searchTerm = '';

  reservations: ReservationDTO[] = [];
  invoice: InvoiceDTO | null = null;

  private timerSub: Subscription | null = null;

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
    this.pendingService.reservationCancelled.subscribe(() => {
      this.loadUserReservations();
    });

    // Actualiza tabla y estados en tiempo real
    this.timerSub = interval(1000).subscribe(() => {
      this.reservations = [...this.reservations]; // fuerza refresh en tabla
    });
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
  }

  loadUserReservations() {
    const userId = this.auth.getUserId();
    if (!userId) return;

    this.http.get<ReservationDTO[]>(`http://localhost:8080/api/reservations/user/${userId}`)
      .subscribe(res => {
        this.reservations = res;

        const pending = this.reservations.find(r => r.status === 'PENDING');
        if (pending) {
            const remaining = this.pendingService.getRemainingTime(pending.id) ?? 60000;
            this.pendingService.startPendingReservation(
              pending.id,
              pending.code,
              remaining,
              pending.courtName,
              pending.startTime,
              pending.endTime
            );
          }

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

  translateStatus(reservation: ReservationDTO): string {
    if (reservation.status === 'PENDING') {
      const remainingMs = this.pendingService.getRemainingTime(reservation.id) ?? 0;
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      return `Pendiente (${minutes}m ${seconds}s)`;
    } else if (reservation.status === 'CONFIRMED') {
      return 'Confirmada';
    } else if (reservation.status === 'CANCELLED') {
      return 'Cancelada';
    }
    return reservation.status;
  }

  confirmReservation(reservationId: string) {
    const methodDialog = this.dialog.open(PaymentMethodDialogComponent);

    const methodSub = methodDialog.afterClosed().subscribe((method: 'CARD' | 'CASH') => {
      methodSub.unsubscribe();

      if (!method) return; // Usuario cerró diálogo de método de pago

      const reservation = this.reservations.find(r => r.id === reservationId);

      // Solo extender el tiempo una vez si hay reserva activa
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
          // Usuario cerró el formulario sin pagar → revertimos tiempo extra
          this.pendingService.revertExtension();
          return; // No se cancela la reserva principal
        }

        // Usuario completó pago → procesar
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
            this.pendingService.closeLocalReservation(); // cerrar snackbar al completar pago
          },
          error: () => {
            this.notificationService.show('Error al procesar el pago', 'error');
            // Opcional: revertir tiempo extra si falla el pago
            this.pendingService.revertExtension();
          }
        });
      });
    });
  }

  cancelReservation(reservationId: string) {
    this.http.delete(`http://localhost:8080/api/reservations/${reservationId}`, { observe: 'response' })
      .subscribe({
        next: (res) => {
          if (res.status === 204) {
            this.notificationService.show('Reserva cancelada correctamente', 'success');
            this.pendingService.cancelReservation(); // limpiar snackbar/localStorage
            this.loadUserReservations();
          }
        },
        error: () => {
          this.notificationService.show('Error al cancelar la reserva', 'error');
        }
      });
  }

  viewInvoice(reservationId: string) {
    this.paymentService.getReservationInvoiceStatus(reservationId).subscribe({
      next: (res: any) => {
        if (res.hasInvoice) {
          // Abrir diálogo con la factura
          this.dialog.open(InvoiceDialogComponent, {
            width: '600px',
            data: { invoice: res.invoice }
          });
        } else {
          // Mostrar notificación si no existe factura
          this.notificationService.show(res.message || 'No existe factura para esta reserva', 'error');
        }
      },
      error: () => {
        this.notificationService.show('Error al cargar la factura', 'error');
      }
    });
  }


  get filteredReservations(): ReservationDTO[] {
      const normalize = (str: string) =>
        str
          .toLowerCase()
          .normalize('NFD')      // descompone caracteres acentuados
          .replace(/[\u0300-\u036f]/g, ''); // elimina tildes

      const term = normalize(this.searchTerm);

      const translateStatus = (status: string): string => {
        switch(status) {
          case 'PENDING': return 'pendiente';
          case 'CONFIRMED': return 'confirmada';
          case 'CANCELLED': return 'cancelada';
          default: return status.toLowerCase();
        }
      };

      return this.reservations.filter(r =>
        normalize(r.courtName).includes(term) ||
        normalize(r.date).includes(term) ||
        normalize(r.code).includes(term) ||
        normalize(translateStatus(r.status)).includes(term)
      );
  }


  get hasPendingReservations(): boolean {
    return this.reservations.some(r => r.status === 'PENDING');
  }
}
