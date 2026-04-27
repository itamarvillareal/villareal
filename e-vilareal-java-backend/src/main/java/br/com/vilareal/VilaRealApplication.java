package br.com.vilareal;

import br.com.vilareal.importacao.ImportPlanilhasBatchProperties;
import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImportProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;
import java.time.ZoneId;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({CadastroPessoasPlanilhaImportProperties.class, ImportPlanilhasBatchProperties.class})
public class VilaRealApplication {

    public static void main(String[] args) {
        SpringApplication.run(VilaRealApplication.class, args);
    }

    @Configuration
    static class PagamentoClockBean {
        @Bean
        public Clock clock() {
            return Clock.system(ZoneId.of("America/Sao_Paulo"));
        }
    }
}
