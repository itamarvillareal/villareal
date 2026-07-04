package br.com.vilareal.whatsapp.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Optional;

/**
 * Cache de nomes do cadastro resolvidos por telefone canônico (exibição inbox WhatsApp).
 *
 * <p>TTL curto: cadastro muda pouco; invalidação por expiração é suficiente.</p>
 */
@Configuration
public class WhatsAppNomeExibicaoCacheConfig {

    /** Tempo de vida do nome resolvido por telefone (positivo ou negative cache). */
    public static final Duration CACHE_TTL = Duration.ofMinutes(8);

    public static final int CACHE_MAX_SIZE = 10_000;

    @Bean
    public Cache<String, Optional<String>> whatsAppNomeCadastroPorTelefoneCache() {
        return Caffeine.newBuilder()
                .expireAfterWrite(CACHE_TTL)
                .maximumSize(CACHE_MAX_SIZE)
                .recordStats()
                .build();
    }
}
