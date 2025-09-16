import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from './notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones.html',
  styleUrls: ['./notificaciones.scss']
})
export class NotificationComponent implements OnInit, OnDestroy {
  notification: Notification | null = null;
  visible = false;
  progress = 100;
  interval: any;
  private sub?: Subscription;

  constructor(
    private notificationService: NotificationService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.sub = this.notificationService.notification$.subscribe(notif => {
      if (notif) this.showNotification(notif);
    });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
    if (this.interval) clearInterval(this.interval);
  }

  showNotification(notif: Notification) {
    this.notification = notif;
    this.visible = true;
    this.progress = 100;

    if (this.interval) clearInterval(this.interval);

    const stepTime = 100;
    const totalSteps = notif.duration ? notif.duration / stepTime : 50;
    let step = 0;

    this.interval = setInterval(() => {
      step++;
      // Forzamos a Angular a actualizar
      this.ngZone.run(() => {
        this.progress = 100 - (step / totalSteps) * 100;
        if (step >= totalSteps) this.close();
      });
    }, stepTime);
  }

  close() {
    this.visible = false;
    this.notification = null;
    if (this.interval) clearInterval(this.interval);
  }
}
