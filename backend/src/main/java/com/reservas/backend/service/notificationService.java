package com.reservas.backend.service;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Servicio centralizado para el envío de notificaciones en tiempo real.
 */
@Service
public class notificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public notificationService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Payload tipado para notificaciones.
     */
    public record NotificationPayload(
            String message,
            String type,          // success | warning | error | info
            String reservationId, // opcional, puede ser null
            int duration          // opcional, en milisegundos
    ) {}

    /**
     * Envía una notificación a un usuario específico.
     */
    public void notifyUser(String userId, NotificationPayload payload) {
        messagingTemplate.convertAndSend(
                "/topic/reservations/" + userId,
                Map.of(
                        "message", payload.message(),
                        "type", payload.type(),
                        "reservationId", payload.reservationId(),
                        "duration", payload.duration(),
                        "timestamp", LocalDateTime.now().toString()
                )
        );
    }

    /**
     * Envía una notificación global a todos los clientes suscritos.
     */
    public void notifyAll(NotificationPayload payload) {
        messagingTemplate.convertAndSend(
                "/topic/reservations/global",
                Map.of(
                        "message", payload.message(),
                        "type", payload.type(),
                        "reservationId", payload.reservationId(),
                        "duration", payload.duration(),
                        "timestamp", LocalDateTime.now().toString()
                )
        );
    }
}
