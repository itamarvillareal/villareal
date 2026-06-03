package br.com.vilareal.integracao.cora;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Beans da integração Cora (produção). Só sobem com {@code cora.enabled=true}.
 */
@Configuration
@ConditionalOnProperty(name = "cora.enabled", havingValue = "true")
public class CoraConfiguration {

    @Bean
    CoraMtlsHttpClient coraMtlsHttpClient(CoraProperties props) {
        return new CoraMtlsHttpClient(CoraMtlsSslContextFactory.build(props));
    }

    @Bean
    CoraTokenService coraTokenService(
            CoraProperties props, CoraMtlsHttpClient httpClient, ObjectMapper objectMapper) {
        return new CoraTokenService(props, httpClient, objectMapper);
    }

    @Bean
    CoraClient coraClient(CoraProperties props, CoraMtlsHttpClient httpClient, CoraTokenService tokenService) {
        return new CoraClient(props, httpClient, tokenService);
    }

    @Bean
    CoraHealthService coraHealthService(CoraProperties props, CoraClient coraClient, CoraTokenService tokenService) {
        return new CoraHealthService(props, coraClient, tokenService);
    }
}
