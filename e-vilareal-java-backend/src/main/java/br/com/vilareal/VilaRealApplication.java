package br.com.vilareal;

import br.com.vilareal.importacao.ImportPlanilhasBatchProperties;
import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImportProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({CadastroPessoasPlanilhaImportProperties.class, ImportPlanilhasBatchProperties.class})
public class VilaRealApplication {

    public static void main(String[] args) {
        SpringApplication.run(VilaRealApplication.class, args);
    }
}
