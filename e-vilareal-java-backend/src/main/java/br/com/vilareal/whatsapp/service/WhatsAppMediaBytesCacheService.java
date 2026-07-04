package br.com.vilareal.whatsapp.service;

import br.com.vilareal.documento.GoogleDriveService;
import com.github.benmanes.caffeine.cache.Cache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Cache de bytes de mídia WhatsApp no Drive, chaveado por {@code fileId}.
 */
@Service
public class WhatsAppMediaBytesCacheService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaBytesCacheService.class);

    private final Cache<String, byte[]> cache;
    private final GoogleDriveService googleDriveService;

    public WhatsAppMediaBytesCacheService(Cache<String, byte[]> whatsAppMediaBytesCache, GoogleDriveService googleDriveService) {
        this.cache = whatsAppMediaBytesCache;
        this.googleDriveService = googleDriveService;
    }

    public byte[] obterBytes(String fileId) throws Exception {
        byte[] cached = cache.getIfPresent(fileId);
        if (cached != null) {
            log.info(
                    "WhatsApp media cache HIT fileId={} ({} bytes, stats={})",
                    fileId,
                    cached.length,
                    resumoStats());
            return cached;
        }

        log.info("WhatsApp media cache MISS fileId={} — baixando do Drive", fileId);
        byte[] bytes = googleDriveService.baixarBytesArquivo(fileId);
        cache.put(fileId, bytes);
        log.debug(
                "WhatsApp media cache PUT fileId={} ({} bytes, stats={})",
                fileId,
                bytes.length,
                resumoStats());
        return bytes;
    }

    private String resumoStats() {
        var stats = cache.stats();
        return "hitRate=%.2f hits=%d misses=%d".formatted(stats.hitRate(), stats.hitCount(), stats.missCount());
    }
}
