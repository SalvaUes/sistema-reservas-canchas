import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  message: string;
  type: NotificationType;
  duration?: number;
  progress?: number;
  source?: 'manual' | 'realtime';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  notification$ = this.notificationSubject.asObservable();

  private lastShownMap: Map<string, number> = new Map();
  private readonly cooldownMs = 6000; 

  show(message: string, type: NotificationType = 'info', duration = 4000) {
    const now = Date.now();
    if (this.isDuplicate(message, duration, now)) return;

    const notification: Notification = { message, type, duration, source: 'manual' };
    this.notificationSubject.next(notification);
    this.lastShownMap.set(message, now);
  }

  showOnce(message: string, type: NotificationType = 'info', duration = 4000) {
    this.show(message, type, duration);
  }

  pushRealtimeNotification(notification: { message: string; type: NotificationType; duration?: number }) {
    const now = Date.now();
    const duration = notification.duration ?? 5000;

    if (this.isDuplicate(notification.message, duration, now)) return;

    this.notificationSubject.next({
      message: notification.message,
      type: notification.type,
      duration,
      source: 'realtime'
    });

    this.lastShownMap.set(notification.message, now);
  }

  private isDuplicate(message: string, duration: number, now: number): boolean {
    const lastShown = this.lastShownMap.get(message) ?? 0;
    return now - lastShown < Math.max(duration, this.cooldownMs);
  }
}
