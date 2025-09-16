import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';

interface PendingData {
  reservationId: number;
  courtName: string;
  startTime: string;
  endTime: string;
}

@Injectable({ providedIn: 'root' })
export class ReservationPendingService {
  private snackRef: MatSnackBarRef<SimpleSnackBar> | null = null;
  private activeReservation: PendingData | null = null;

  constructor(private snackBar: MatSnackBar) {}

  startPendingReservation(reservationId: number, _durationMs: number, courtName: string, startTime: string, endTime: string) {
    this.activeReservation = { reservationId, courtName, startTime, endTime };
    this.showNotification(courtName, startTime, endTime);
  }

  cancelReservation() {
    if (this.snackRef) {
      this.snackRef.dismiss();
      this.snackRef = null;
    }
    this.activeReservation = null;
  }

  hasActiveReservation(): boolean {
    return !!this.activeReservation;
  }

  private showNotification(court: string, start: string, end: string) {
    if (this.snackRef) this.snackRef.dismiss();

    this.snackRef = this.snackBar.open(
      `⚡ Reserva pendiente en: ${court}\n🕒 Horario: ${start} - ${end}`,
      'Cerrar',
      {
        duration: undefined, // permanece hasta cerrar
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['reservation-card-snackbar']
      }
    );
  }
}
