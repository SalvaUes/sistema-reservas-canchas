import { Component, EventEmitter, Inject, NgZone, OnDestroy, Output } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface PendingSnackbarData {
  reservationId: string;
  reservationCode: string;
  courtName: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  expireAt: number;  // Timestamp (ms)
}

@Component({
  selector: 'app-reservation-pending-snackbar',
  templateUrl: './reservation-pending-snackbar.component.html',
  styleUrls: ['./reservation-pending-snackbar.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule
  ]
})
export class ReservationPendingSnackbarComponent implements OnDestroy {
  @Output() cancelClicked = new EventEmitter<void>();

  progress = 100;
  remainingSeconds = 0;
  minimized = false;

  formattedStartTime = '';
  formattedEndTime = '';

  private intervalId?: number;
  private totalDuration: number;

  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: PendingSnackbarData,
    private snackRef: MatSnackBarRef<ReservationPendingSnackbarComponent>,
    private ngZone: NgZone,
    private router: Router
  ) {
    this.totalDuration = Math.max(data.expireAt - Date.now(), 1);
    this.formattedStartTime = this.formatTime12(data.startTime);
    this.formattedEndTime = this.formatTime12(data.endTime);

    this.updateRemaining();
    this.startProgress();
  }

  /** Convierte HH:mm a formato 12h (ej: "14:30" → "2:30 PM") */
  private formatTime12(timeStr: string): string {
    const [hourStr, minuteStr] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }

  /** Inicia el temporizador de progreso */
  private startProgress(): void {
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = window.setInterval(() => {
      this.ngZone.run(() => this.updateRemaining());
    }, 1000);
  }

  /** Actualiza el tiempo restante y la barra de progreso */
  public updateRemaining(remainingMs?: number): void {
    if (!remainingMs) remainingMs = this.data.expireAt - Date.now();
    if (remainingMs <= 0) {
      this.close();
      return;
    }
    this.remainingSeconds = Math.ceil(remainingMs / 1000);
    this.progress = Math.max(0, (remainingMs / this.totalDuration) * 100);
  }

  /** Minimiza o expande la notificación */
  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  /** Cierra el snackbar y navega (por defecto) */
  close(navigate = true): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.cancelClicked.emit();

    if (navigate) {
      this.ngZone.run(() => this.router.navigate(['/cliente/mis-reservas']));
    }

    this.snackRef.dismiss();
  }

  /** Actualiza los datos del snackbar si la reserva cambia (por ejemplo, reactivación) */
  updateData(courtName: string, startTime: string, endTime: string, expireAt?: number): void {
    this.data.courtName = courtName;
    this.data.startTime = startTime;
    this.data.endTime = endTime;

    this.formattedStartTime = this.formatTime12(startTime);
    this.formattedEndTime = this.formatTime12(endTime);

    if (expireAt) {
      this.data.expireAt = expireAt;
      this.totalDuration = Math.max(expireAt - Date.now(), 1);
    }

    this.ngZone.run(() => this.updateRemaining());
  }

  /** Limpieza al destruir el componente */
  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }


  /** Solo emite evento sin cerrar el snackbar */
  onCancelClick(): void {
    this.cancelClicked.emit();
    // NO llamar a this.snackRef.dismiss()
  }

}
