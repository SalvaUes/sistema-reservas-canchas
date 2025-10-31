// frontend/src/app/shared/notificaciones/notification.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Notification {
  message: string;
  type?: 'success' | 'error' | 'warning';
  duration?: number;
  progress?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notificationSubject = new Subject<Notification>();
  notification$ = this.notificationSubject.asObservable();

  private lastMessage: string | null = null;
  private lastType: 'success' | 'error' | 'warning' | null = null;

  show(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
    duration = 5000
  ) {
    // Evita repetir la misma notificación inmediatamente
    if (this.lastMessage === message && this.lastType === type) return;

    this.lastMessage = message;
    this.lastType = type;

    this.notificationSubject.next({ message, type, duration });

    // Reinicia para permitir futuras notificaciones después de 'duration'
    setTimeout(() => {
      this.lastMessage = null;
      this.lastType = null;
    }, duration);
  }
}
