package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.WhatsAppDriveFileIdUtil;
import br.com.vilareal.whatsapp.WhatsAppMediaRangeSupport;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import br.com.vilareal.whatsapp.service.WhatsAppMediaBytesCacheService;
import br.com.vilareal.whatsapp.service.WhatsAppMediaProcessingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;

/**
 * Proxy autenticado de bytes de mídia WhatsApp armazenada no Google Drive.
 */
@RestController
@RequestMapping("/api/whatsapp")
@Tag(name = "WhatsApp", description = "Mídia inline de conversas WhatsApp")
public class WhatsAppMediaController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaController.class);
    private static final String CACHE_CONTROL = "private, max-age=3600";

    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final WhatsAppMediaBytesCacheService mediaBytesCacheService;
    private final WhatsAppMediaProcessingService whatsAppMediaProcessingService;

    public WhatsAppMediaController(
            WhatsAppMessageRepository whatsAppMessageRepository,
            WhatsAppMediaBytesCacheService mediaBytesCacheService,
            WhatsAppMediaProcessingService whatsAppMediaProcessingService) {
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.mediaBytesCacheService = mediaBytesCacheService;
        this.whatsAppMediaProcessingService = whatsAppMediaProcessingService;
    }

    @GetMapping("/media/{messageId}")
    @Operation(summary = "Servir bytes de mídia WhatsApp (proxy Drive, suporte a Range)")
    public ResponseEntity<byte[]> servirMidia(
            @PathVariable Long messageId,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        WhatsAppMessageEntity message =
                whatsAppMessageRepository.findById(messageId).orElse(null);
        if (message == null) {
            return ResponseEntity.notFound().build();
        }

        String fileId =
                WhatsAppDriveFileIdUtil.resolverFileId(message.getMediaDriveFileId(), message.getMediaDriveUrl());
        if (!StringUtils.hasText(fileId)) {
            return ResponseEntity.notFound().build();
        }

        byte[] bytes;
        try {
            bytes = mediaBytesCacheService.obterBytes(fileId);
        } catch (Exception e) {
            log.error(
                    "Falha ao baixar mídia WhatsApp do Drive messageId={} fileId={}: {}",
                    messageId,
                    fileId,
                    e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }

        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }

        // Repassa mime completo (ex.: audio/ogg; codecs=opus) — sem truncar parâmetros.
        String contentType = StringUtils.hasText(message.getMediaMimeType())
                ? message.getMediaMimeType().trim()
                : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        String filename = sanitizarFilename(message.getMediaFilename());

        WhatsAppMediaRangeSupport.Decision rangeDecision =
                WhatsAppMediaRangeSupport.interpretar(rangeHeader, bytes.length);

        if (rangeDecision instanceof WhatsAppMediaRangeSupport.Decision.Unsatisfiable) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + bytes.length)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .build();
        }

        if (rangeDecision instanceof WhatsAppMediaRangeSupport.Decision.Partial partial) {
            byte[] slice = Arrays.copyOfRange(bytes, partial.start(), partial.end() + 1);
            return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDispositionInline(filename))
                    .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(
                            HttpHeaders.CONTENT_RANGE,
                            "bytes %d-%d/%d".formatted(partial.start(), partial.end(), bytes.length))
                    .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(slice.length))
                    .body(slice);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDispositionInline(filename))
                .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(bytes.length))
                .body(bytes);
    }

    @PostMapping("/media/{messageId}/reprocessar")
    @Operation(summary = "Reprocessar download de mídia inbound (reset PENDING + async imediato)")
    public ResponseEntity<Void> reprocessarMidia(@PathVariable Long messageId) {
        try {
            whatsAppMediaProcessingService.solicitarReprocessamentoManual(messageId);
            return ResponseEntity.accepted().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    static String sanitizarFilename(String filename) {
        if (!StringUtils.hasText(filename)) {
            return "midia";
        }
        return filename.replace("\"", "")
                .replace("\r", "")
                .replace("\n", "")
                .trim();
    }

    private static String contentDispositionInline(String filename) {
        return "inline; filename=\"" + filename + "\"";
    }
}
