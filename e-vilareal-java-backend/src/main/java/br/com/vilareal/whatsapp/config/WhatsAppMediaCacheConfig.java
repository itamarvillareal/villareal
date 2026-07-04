package br.com.vilareal.whatsapp.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Cache em memória de bytes de mídia WhatsApp baixados do Google Drive (proxy inline).
 */
@Configuration
public class WhatsAppMediaCacheConfig {

    /** Teto total aproximado de bytes em cache (~256 MB). */
    public static final long MAX_CACHE_WEIGHT_BYTES = 256L * 1024 * 1024;

    public static final Duration CACHE_EXPIRE_AFTER_ACCESS = Duration.ofMinutes(10);

    @Bean
    public Cache<String, byte[]> whatsAppMediaBytesCache() {
        return Caffeine.newBuilder()
                .expireAfterAccess(CACHE_EXPIRE_AFTER_ACCESS)
                .maximumWeight(MAX_CACHE_WEIGHT_BYTES)
                .weigher((String fileId, byte[] bytes) -> bytes != null ? bytes.length : 0)
                .recordStats()
                .build();
    }
}
