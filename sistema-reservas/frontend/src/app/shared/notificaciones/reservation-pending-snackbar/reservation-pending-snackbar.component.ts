import { Component, EventEmitter, Inject, NgZone, Output } from '@angular/core';
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
  startTime: string; // Formato 24h: "14:30"
  endTime: string;   // Formato 24h: "15:30"
  expireAt: number;  // Timestamp en ms
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
export class ReservationPendingSnackbarComponent {
  @Output() cancelClicked = new EventEmitter<void>();

  progress = 100;
  remainingSeconds = 0;
  minimized = false;

  formattedStartTime: string;
  formattedEndTime: string;

  private interval?: any;
  private totalDuration: number;

  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: PendingSnackbarData,
    private snackRef: MatSnackBarRef<ReservationPendingSnackbarComponent>,
    private ngZone: NgZone,
    private router: Router,
  ) {
    this.totalDuration = Math.max(this.data.expireAt - Date.now(), 1);
    this.formattedStartTime = this.formatTime12(data.startTime);
    this.formattedEndTime = this.formatTime12(data.endTime);

    this.updateRemaining();
    this.startProgress();
  }

  private formatTime12(timeStr: string): string {
    const [hourStr, minuteStr] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }

  private startProgress() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.ngZone.run(() => this.updateRemaining());
    }, 1000);
  }

  updateRemaining(remainingMs?: number) {
    if (!remainingMs) remainingMs = this.data.expireAt - Date.now();

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

  updateData(courtName: string, startTime: string, endTime: string, expireAt?: number) {
    this.data.courtName = courtName;
    this.data.startTime = startTime;
    this.data.endTime = endTime;

    this.formattedStartTime = this.formatTime12(startTime);
    this.formattedEndTime = this.formatTime12(endTime);

    if (expireAt) {
      this.data.expireAt = expireAt;
      this.totalDuration = Math.max(this.data.expireAt - Date.now(), 1);
    }

    this.ngZone.run(() => this.updateRemaining());
  }

}
