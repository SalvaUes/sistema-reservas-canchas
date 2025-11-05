import { Component, OnDestroy, OnInit, NgZone } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Notification, NotificationService } from './notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.html',
  styleUrls: ['./notification.scss']
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private sub?: Subscription;
  private activeIntervals = new Map<Notification, ReturnType<typeof setInterval>>();

  constructor(
    private notificationService: NotificationService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.sub = this.notificationService.notification$.subscribe(n => {
      if (n) this.addNotification(n);
    });
  }

  private addNotification(n: Notification): void {
    n.progress = 100;
    const duration = n.duration ?? 4000;
    this.notifications.push(n);

    // Duración total -> ticks de 100ms
    const steps = Math.max(duration / 100, 1);
    const decrement = 100 / steps;

    // Evita ejecutar lógica de temporizador dentro de Angular
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => {
        n.progress! -= decrement;

        if (n.progress! <= 0) {
          this.ngZone.run(() => this.close(n));
          clearInterval(intervalId);
          this.activeIntervals.delete(n);
        }
      }, 100);

      // Registrar intervalo activo para limpieza posterior
      this.activeIntervals.set(n, intervalId);
    });
  }

  close(n: Notification): void {
    // Limpia intervalo asociado
    const intervalId = this.activeIntervals.get(n);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeIntervals.delete(n);
    }

    // Remueve de lista
    this.notifications = this.notifications.filter(x => x !== n);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();

    // Limpieza de intervalos activos
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals.clear();
  }
}
