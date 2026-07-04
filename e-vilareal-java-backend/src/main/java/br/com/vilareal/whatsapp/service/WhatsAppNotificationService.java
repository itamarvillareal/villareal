package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppNotificationDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class WhatsAppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationService.class);

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    public void notifyNewMessage(WhatsAppNotificationDTO notification) {
        broadcast("whatsapp-message", notification);
    }

    public void notifyStatusUpdate(String waMessageId, String newStatus) {
        broadcast("whatsapp-status", Map.of("waMessageId", waMessageId, "status", newStatus));
    }

    public void notifyMediaReady(
            Long messageId, String phoneNumber, String waMessageId, String mediaDriveUrl, String mediaFilename) {
        broadcast(
                "whatsapp-media-ready",
                Map.of(
                        "messageId", messageId,
                        "phoneNumber", phoneNumber != null ? phoneNumber : "",
                        "waMessageId", waMessageId != null ? waMessageId : "",
                        "mediaDriveUrl", mediaDriveUrl != null ? mediaDriveUrl : "",
                        "mediaFilename", mediaFilename != null ? mediaFilename : ""));
    }

    /** Broadcast quando uma conversa é marcada como lida globalmente (sync entre abas/atendentes). */
    public void notifyConversationRead(String phoneNumber, Instant lastReadAt) {
        broadcast(
                "conversation-read",
                Map.of(
                        "phoneNumber", phoneNumber != null ? phoneNumber : "",
                        "lastReadAt", lastReadAt != null ? lastReadAt.toString() : ""));
    }

    private void broadcast(String eventName, Object data) {
        List<SseEmitter> deadEmitters = new ArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }

        if (!deadEmitters.isEmpty()) {
            emitters.removeAll(deadEmitters);
            log.debug("Removidos {} clientes SSE WhatsApp desconectados", deadEmitters.size());
        }
    }
}
