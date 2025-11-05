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

  // Registro de mensajes recientes con timestamp
  private lastShownMap: Map<string, number> = new Map();
  private readonly cooldownMs = 6000; // tiempo mínimo antes de volver a mostrar el mismo mensaje

  /**
   * Muestra una notificación normal.
   * Evita mostrar si el mismo mensaje sigue activo o acaba de mostrarse.
   */
  show(message: string, type: NotificationType = 'info', duration = 4000) {
    const now = Date.now();
    if (this.isDuplicate(message, duration, now)) return;

    const notification: Notification = { message, type, duration, source: 'manual' };
    this.notificationSubject.next(notification);
    this.lastShownMap.set(message, now);
  }

  /**
   * Muestra una notificación solo una vez durante el intervalo activo.
   */
  showOnce(message: string, type: NotificationType = 'info', duration = 4000) {
    this.show(message, type, duration);
  }

  /**
   * Notificación desde eventos en tiempo real (WebSocket, SSE, etc.)
   * No reinicia si el mismo mensaje sigue visible.
   */
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

  /**
   * Verifica si la notificación ya fue mostrada recientemente.
   */
  private isDuplicate(message: string, duration: number, now: number): boolean {
    const lastShown = this.lastShownMap.get(message) ?? 0;
    return now - lastShown < Math.max(duration, this.cooldownMs);
  }
}
