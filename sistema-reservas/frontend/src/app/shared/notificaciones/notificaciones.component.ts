import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from './notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones.html',
  styleUrls: ['./notificaciones.scss']
})
export class NotificationComponent implements OnInit {
  notification: Notification | null = null;
  visible = false;
  progress = 100;
  interval: any;

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.notificationService.notification$.subscribe(notif => {
      if (notif) this.showNotification(notif);
    });
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
      this.progress = 100 - (step / totalSteps) * 100;
      if (step >= totalSteps) this.close();
    }, stepTime);
  }

  close() {
    this.visible = false;
    this.notification = null;
    if (this.interval) clearInterval(this.interval);
  }
}
