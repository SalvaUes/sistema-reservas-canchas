// websocket.config.ts
export const WEBSOCKET_CONFIG = {
  URL: 'ws://localhost:8080/ws',
  TOPICS: {
    GLOBAL: '/topic/reservations/global',
    USER: (userId: string) => `/topic/reservations/${userId}`,
  },
  RECONNECT_DELAY: 5000,
  HEARTBEAT_IN: 8000,
  HEARTBEAT_OUT: 8000,
  MESSAGE_COOLDOWN_MS: 3000, // evita duplicados en menos de 3s
};
