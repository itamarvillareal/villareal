package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.dto.WhatsAppContactPhotoResponse;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppContactPhotoEntity;
import br.com.vilareal.whatsapp.service.WhatsAppContactPhotoService;
import br.com.vilareal.whatsapp.service.WhatsAppMediaBytesCacheService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Foto manual de contato por conversa (telefone canônico) — upload, proxy de bytes e remoção.
 */
@RestController
@RequestMapping("/api/whatsapp/conversations")
@Tag(name = "WhatsApp", description = "Foto manual de contato WhatsApp")
public class WhatsAppContactPhotoController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppContactPhotoController.class);
    private static final String CACHE_CONTROL = "private, max-age=3600";

    private final WhatsAppContactPhotoService contactPhotoService;
    private final WhatsAppMediaBytesCacheService mediaBytesCacheService;

    public WhatsAppContactPhotoController(
            WhatsAppContactPhotoService contactPhotoService,
            WhatsAppMediaBytesCacheService mediaBytesCacheService) {
        this.contactPhotoService = contactPhotoService;
        this.mediaBytesCacheService = mediaBytesCacheService;
    }

    @PostMapping(value = "/{phoneNumber}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Definir ou substituir foto manual do contato")
    public ResponseEntity<WhatsAppContactPhotoResponse> definirFoto(
            @PathVariable String phoneNumber, @RequestParam("arquivo") MultipartFile arquivo) {
        try {
            String url = contactPhotoService.definirFoto(phoneNumber, arquivo);
            return ResponseEntity.ok(new WhatsAppContactPhotoResponse(url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (IllegalStateException e) {
            log.warn("Falha ao definir foto contato phone={}: {}", phoneNumber, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    @GetMapping("/{phoneNumber}/photo")
    @Operation(summary = "Servir bytes da foto manual do contato (proxy Drive autenticado)")
    public ResponseEntity<byte[]> servirFoto(@PathVariable String phoneNumber) {
        WhatsAppContactPhotoEntity entity;
        try {
            entity = contactPhotoService.buscarPorTelefone(phoneNumber).orElse(null);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
        if (entity == null) {
            return ResponseEntity.notFound().build();
        }

        String fileId = WhatsAppContactPhotoService.resolverDriveFileId(entity);
        if (!StringUtils.hasText(fileId)) {
            return ResponseEntity.notFound().build();
        }

        byte[] bytes;
        try {
            bytes = mediaBytesCacheService.obterBytes(fileId);
        } catch (Exception e) {
            log.error(
                    "Falha ao baixar foto contato do Drive phone={} fileId={}: {}",
                    phoneNumber,
                    fileId,
                    e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }

        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }

        String contentType = inferirContentType(entity.getDriveUrl(), bytes);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(bytes.length))
                .body(bytes);
    }

    @DeleteMapping("/{phoneNumber}/photo")
    @Operation(summary = "Remover foto manual do contato")
    public ResponseEntity<Void> removerFoto(@PathVariable String phoneNumber) {
        try {
            contactPhotoService.removerFoto(phoneNumber);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private static String inferirContentType(String driveUrl, byte[] bytes) {
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47) {
            return MediaType.IMAGE_PNG_VALUE;
        }
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) {
            return MediaType.IMAGE_JPEG_VALUE;
        }
        if (StringUtils.hasText(driveUrl) && driveUrl.toLowerCase().contains(".png")) {
            return MediaType.IMAGE_PNG_VALUE;
        }
        return MediaType.IMAGE_JPEG_VALUE;
    }
}
