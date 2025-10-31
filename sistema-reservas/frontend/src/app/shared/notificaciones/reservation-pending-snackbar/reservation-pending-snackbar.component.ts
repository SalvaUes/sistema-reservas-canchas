import { Component, EventEmitter, Inject, NgZone, Output } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon'; // ✅ Importar esto
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface PendingSnackbarData {
  reservationId: string;
  reservationCode: string;
  courtName: string;
  startTime: string;
  endTime: string;
  expireAt: number;
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
    MatIconModule // ✅ AÑADIDO AQUÍ
  ]
})
export class ReservationPendingSnackbarComponent {
  @Output() cancelClicked = new EventEmitter<void>();

  progress = 100;
  remainingSeconds = 0;
  minimized = false;

  private interval?: any;
  private readonly totalDuration: number;

  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: PendingSnackbarData,
    private snackRef: MatSnackBarRef<ReservationPendingSnackbarComponent>,
    private ngZone: NgZone,
    private router: Router
  ) {
    this.totalDuration = data.expireAt - Date.now();
    this.updateRemaining();
    this.startProgress();
  }

  private startProgress() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.ngZone.run(() => this.updateRemaining());
    }, 1000);
  }

  updateRemaining(remainingMs?: number) {
    if (remainingMs === undefined) remainingMs = this.data.expireAt - Date.now();
    if (remainingMs <= 0) {
      this.close();
      return;
    }
    this.remainingSeconds = Math.ceil(remainingMs / 1000);
    this.progress = Math.max(0, (remainingMs / this.totalDuration) * 100);
  }

  toggleMinimize() {
    this.minimized = !this.minimized;
  }

  close(navigate = true) {
    if (this.interval) clearInterval(this.interval);
    this.cancelClicked.emit();
    if (navigate) {
      this.ngZone.run(() => this.router.navigate(['/cliente/mis-reservas']));
    }
  }
}
