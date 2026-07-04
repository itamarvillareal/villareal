package br.com.vilareal.config;

import br.com.vilareal.notificacao.config.NotificacaoEmailProperties;
import br.com.vilareal.whatsapp.config.CobrancaWhatsAppProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({
    SecurityProperties.class,
    WhatsAppConfig.class,
    NotificacaoEmailProperties.class,
    CobrancaWhatsAppProperties.class
})
public class AppConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    /** Cliente HTTP para séries SGS do Banco Central (INPC / IPCA) — tela Cálculos. */
    @Bean
    public RestClient bcbSgsRestClient() {
        return RestClient.builder()
                .baseUrl("https://api.bcb.gov.br")
                .build();
    }
}
