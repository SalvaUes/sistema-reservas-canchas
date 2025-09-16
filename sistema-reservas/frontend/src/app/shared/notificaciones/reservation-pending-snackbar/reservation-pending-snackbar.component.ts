import { Component, EventEmitter, Inject, NgZone, Output } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

export interface PendingSnackbarData {
  reservationId: string;
  reservationCode: string;
  courtName: string;
  startTime: string;
  endTime: string;
  expireAt: number; // Tiempo absoluto de expiración
}

@Component({
  selector: 'app-reservation-pending-snackbar',
  templateUrl: './reservation-pending-snackbar.component.html',
  styleUrls: ['./reservation-pending-snackbar.component.scss'],
  standalone: true,
  imports: [MatProgressBarModule, MatButtonModule]
})
export class ReservationPendingSnackbarComponent {
  progress = 100;
  remainingSeconds = 0; // inicializamos
  @Output() cancelClicked = new EventEmitter<void>();

  private interval: any;

  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: PendingSnackbarData,
    private snackRef: MatSnackBarRef<ReservationPendingSnackbarComponent>,
    private ngZone: NgZone,
    private router: Router
  ) {
    this.updateRemaining(); // inicializamos tiempo restante real
    this.startProgress();
  }

  private startProgress() {
    if (this.interval) clearInterval(this.interval);

    this.interval = setInterval(() => {
      this.ngZone.run(() => this.updateRemaining());
    }, 1000);
  }

  /** Calcula tiempo restante y actualiza barra */
  updateRemaining(remainingMs?: number) {
    if (remainingMs === undefined) {
      remainingMs = this.data.expireAt - Date.now();
    }

    if (remainingMs <= 0) {
      this.close();
      return;
    }

    this.remainingSeconds = Math.ceil(remainingMs / 1000);
    this.progress = (remainingMs / (this.data.expireAt - (this.data.expireAt - remainingMs))) * 100;
  }

  close(navigate = true) {
    if (this.interval) clearInterval(this.interval);
    this.cancelClicked.emit();

    // Solo navegar, no reiniciar reserva
    if (navigate) {
      this.ngZone.run(() => this.router.navigate(['/cliente/mis-reservas']));
    }
  }

}

