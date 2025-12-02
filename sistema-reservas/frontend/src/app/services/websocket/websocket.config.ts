import { environment } from '../../../environments/environment';

export const WEBSOCKET_CONFIG = {
  URL: environment.socketUrl,
  
  TOPICS: {
    GLOBAL: '/topic/reservations/global',
    USER: (userId: string) => `/topic/reservations/${userId}`,
  },
  RECONNECT_DELAY: 5000,
  HEARTBEAT_IN: 8000,
  HEARTBEAT_OUT: 8000,
  MESSAGE_COOLDOWN_MS: 3000,
};