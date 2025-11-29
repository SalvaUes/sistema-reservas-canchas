import { Injectable, NgZone } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { NotificationService } from '../../shared/notificaciones/notification.service';
import { WEBSOCKET_CONFIG } from './websocket.config';

// Definimos tipos para evitar errores de 'any'
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface WebSocketNotification {
  message: string;
  type: NotificationType;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client?: Client;
  private connected = false;
  private lastMessageCache = new Map<string, number>();

  constructor(
    private ngZone: NgZone,
    private notificationService: NotificationService
  ) {}

  /**
   * Conecta al WebSocket del backend con STOMP nativo
   */
  connect(userId: string) {
    if (this.connected) return;

    this.client = new Client({
      brokerURL: WEBSOCKET_CONFIG.URL,
      reconnectDelay: WEBSOCKET_CONFIG.RECONNECT_DELAY,
      heartbeatIncoming: WEBSOCKET_CONFIG.HEARTBEAT_IN,
      heartbeatOutgoing: WEBSOCKET_CONFIG.HEARTBEAT_OUT,
    });

    this.client.onConnect = () => {
      this.connected = true;
      console.log(`✅ Conectado al WebSocket como usuario ${userId}`);

      // Suscripción global y por usuario
      this.subscribeToChannel(WEBSOCKET_CONFIG.TOPICS.GLOBAL);
      this.subscribeToChannel(WEBSOCKET_CONFIG.TOPICS.USER(userId));
    };

    this.client.onStompError = (frame: any) => {
      console.error('❌ Error STOMP:', frame.headers['message']);
    };

    this.client.onWebSocketClose = () => {
      this.connected = false;
      console.warn('🔌 Conexión WebSocket cerrada, reintentando...');
    };

    this.client.onDisconnect = () => {
      this.connected = false;
      console.warn('⚠️ Desconectado de WebSocket');
    };

    this.client.activate();
  }

  /**
   * Desconecta manualmente del WebSocket
   */
  disconnect() {
    this.connected = false;
    this.client?.deactivate();
  }

  /**
   * Suscribe a un canal STOMP y procesa mensajes en tiempo real
   */
  private subscribeToChannel(channel: string) {
    this.client?.subscribe(channel, (msg: IMessage) => {
      if (!msg.body) return;

      let payload: any;
      try {
        payload = JSON.parse(msg.body);
      } catch {
        console.warn('[WebSocket] Payload inválido:', msg.body);
        return;
      }

      const typeStr = (payload.type ?? 'info').toLowerCase();
      const type: NotificationType = ['success', 'error', 'warning', 'info'].includes(typeStr)
        ? (typeStr as NotificationType)
        : 'info';

      const notification: WebSocketNotification = {
        message: payload.message ?? '(sin mensaje)',
        type,
        duration: payload.duration ?? 5000,
      };

      // Evita mostrar mensajes duplicados (Cooldown)
      const cacheKey = `${channel}:${notification.message}:${notification.type}`;
      const now = Date.now();
      const lastShown = this.lastMessageCache.get(cacheKey) ?? 0;
      
      if (now - lastShown < WEBSOCKET_CONFIG.MESSAGE_COOLDOWN_MS) return;
      
      this.lastMessageCache.set(cacheKey, now);

      // Ejecuta en zona segura para actualizar la UI
      this.ngZone.run(() =>
        // Asegúrate de que tu NotificationService tenga este método o usa .show()
        this.notificationService.show(notification.message, notification.type, notification.duration)
      );
    });
  }

  /**
   * Permite a otros servicios suscribirse a canales personalizados
   */
  listen(channel: string, callback: (payload: any) => void) {
    this.client?.subscribe(channel, (msg: IMessage) => {
      if (!msg.body) return;
      let payload: any;
      try {
        payload = JSON.parse(msg.body);
      } catch {
        console.warn('[WebSocket] Payload inválido en canal:', channel);
        return;
      }
      this.ngZone.run(() => callback(payload));
    });
  }
}