package br.com.vilareal.integracao.cora.sandbox;

import br.com.vilareal.integracao.cora.CoraMtlsHttpClient;
import br.com.vilareal.integracao.cora.CoraMtlsSslContextFactory;
import br.com.vilareal.integracao.cora.CoraTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Beans do laboratório Cora — isolados do módulo financeiro/pagamentos.
 * Ativo apenas com profile {@code cora-sandbox} e {@code cora.sandbox.enabled=true}.
 */
@Configuration
@Profile("cora-sandbox")
@ConditionalOnProperty(name = "cora.sandbox.enabled", havingValue = "true")
@EnableConfigurationProperties(CoraSandboxProperties.class)
public class CoraSandboxConfiguration {

    @Bean
    CoraSandboxLogWriter coraSandboxLogWriter(CoraSandboxProperties props) {
        return new CoraSandboxLogWriter(props);
    }

    @Bean
    CoraMtlsHttpClient coraSandboxMtlsHttpClient(CoraSandboxProperties props) {
        return new CoraMtlsHttpClient(CoraMtlsSslContextFactory.build(props));
    }

    @Bean
    CoraSandboxHttpClient coraSandboxHttpClient(
            CoraMtlsHttpClient coraSandboxMtlsHttpClient, CoraSandboxLogWriter logWriter) {
        return new CoraSandboxHttpClient(coraSandboxMtlsHttpClient, logWriter);
    }

    @Bean
    CoraTokenService coraSandboxTokenService(
            CoraSandboxProperties props, CoraMtlsHttpClient coraSandboxMtlsHttpClient, ObjectMapper objectMapper) {
        return new CoraTokenService(props, coraSandboxMtlsHttpClient, objectMapper);
    }

    @Bean
    CoraSandboxApiClient coraSandboxApiClient(
            CoraSandboxProperties props,
            CoraSandboxHttpClient httpClient,
            CoraTokenService tokenService,
            ObjectMapper objectMapper) {
        return new CoraSandboxApiClient(props, httpClient, tokenService, objectMapper);
    }

    @Bean
    CoraSandboxService coraSandboxService(
            CoraTokenService tokenService, CoraSandboxApiClient apiClient, ObjectMapper objectMapper) {
        return new CoraSandboxService(tokenService, apiClient, objectMapper);
    }
}
