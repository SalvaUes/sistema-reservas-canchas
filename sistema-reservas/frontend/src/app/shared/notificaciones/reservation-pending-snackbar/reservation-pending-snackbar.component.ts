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
  date: string;
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
  formattedDate: Date | null = null;

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
    
    this.formattedDate = this.parseDateSafe(data.date);

    this.updateRemaining();
  }

  // 💡 CORRECCIÓN CRÍTICA DE ZONA HORARIA
  private parseDateSafe(dateStr: string): Date | null {
      if (!dateStr) return null;

      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day); 
      }

      // Fallback para otros formatos (ISO con hora, etc.)
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
  }

  private formatTime12(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    
    let hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }

  private startProgress(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.ngZone.runOutsideAngular(() => {
        this.intervalId = window.setInterval(() => {
          this.ngZone.run(() => this.updateRemaining());
        }, 1000);
    });
  }

  public updateRemaining(remainingMs?: number): void {
    if (!remainingMs) remainingMs = this.data.expireAt - Date.now();
    if (remainingMs <= 0) {
      this.close();
      return;
    }
    this.remainingSeconds = Math.ceil(remainingMs / 1000);
    this.progress = Math.max(0, (remainingMs / this.totalDuration) * 100);
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  close(navigate = true): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.cancelClicked.emit();
    if (navigate) {
      this.ngZone.run(() => this.router.navigate(['/cliente/mis-reservas']));
    }
    this.snackRef.dismiss();
  }

  updateData(courtName: string, date: string, startTime: string, endTime: string, expireAt?: number): void {
    this.data.courtName = courtName;
    this.data.date = date;
    this.data.startTime = startTime;
    this.data.endTime = endTime;

    this.formattedStartTime = this.formatTime12(startTime);
    this.formattedEndTime = this.formatTime12(endTime);
    
    this.formattedDate = this.parseDateSafe(date);

    if (expireAt) {
      this.data.expireAt = expireAt;
      this.totalDuration = Math.max(expireAt - Date.now(), 1);
    }
    this.ngZone.run(() => this.updateRemaining());
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  onCancelClick(): void {
    this.cancelClicked.emit();
  }
}