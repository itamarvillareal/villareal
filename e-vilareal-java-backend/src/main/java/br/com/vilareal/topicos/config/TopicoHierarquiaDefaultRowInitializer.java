package br.com.vilareal.topicos.config;

import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoHierarquiaEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoHierarquiaRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Integer.MAX_VALUE)
public class TopicoHierarquiaDefaultRowInitializer implements ApplicationRunner {

    private static final int CONFIG_ID = 1;
    private static final String RAIZ_MINIMA =
            "{\"id\":\"_raiz\",\"label\":\"Início\",\"children\":[]}";

    private final TopicoHierarquiaRepository repository;

    public TopicoHierarquiaDefaultRowInitializer(TopicoHierarquiaRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (repository.existsById(CONFIG_ID)) {
            return;
        }
        TopicoHierarquiaEntity row = new TopicoHierarquiaEntity();
        row.setId(CONFIG_ID);
        row.setRaizJson(RAIZ_MINIMA);
        repository.save(row);
    }
}
