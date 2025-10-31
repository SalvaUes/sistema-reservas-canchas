import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Notification, NotificationService } from './notification.service';

@Component({
  selector: 'app-notification',
  imports: [CommonModule],
  templateUrl: './notificaciones.html',
  styleUrls: ['./notificaciones.scss']
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private sub?: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.sub = this.notificationService.notification$.subscribe(n => {
      if (n) this.addNotification(n);
    });
  }

  private addNotification(n: Notification) {
    n.progress = 100;
    this.notifications.push(n);
    const intervalId = setInterval(() => {
      n.progress! -= 100 / (n.duration! / 100);
      if (n.progress! <= 0) {
        this.close(n);
        clearInterval(intervalId);
      }
    }, 100);
  }

  close(n: Notification) {
    this.notifications = this.notifications.filter(x => x !== n);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
