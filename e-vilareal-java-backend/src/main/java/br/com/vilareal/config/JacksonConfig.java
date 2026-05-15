package br.com.vilareal.config;

import br.com.vilareal.config.jackson.LenientInstantDeserializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;

@Configuration
public class JacksonConfig {

    /** Permite POST com {@code movimentoEm} sem sufixo Z / offset (ex. histórico / UI legada). */
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer lenientInstantJson() {
        return builder -> builder.deserializerByType(Instant.class, new LenientInstantDeserializer());
    }
}
