package br.com.vilareal.configuracao.application;

import br.com.vilareal.configuracao.infrastructure.persistence.entity.SistemaConfigEntity;
import br.com.vilareal.configuracao.infrastructure.persistence.repository.SistemaConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Service
public class SistemaConfigService {

    private final SistemaConfigRepository repository;

    public SistemaConfigService(SistemaConfigRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Optional<String> obterValor(String chave) {
        if (!StringUtils.hasText(chave)) {
            return Optional.empty();
        }
        return repository.findById(chave.trim()).map(SistemaConfigEntity::getValor);
    }

    @Transactional
    public void salvarValor(String chave, String valor) {
        if (!StringUtils.hasText(chave)) {
            throw new IllegalArgumentException("chave é obrigatória.");
        }
        if (valor == null) {
            throw new IllegalArgumentException("valor é obrigatório.");
        }
        String chaveNorm = chave.trim();
        SistemaConfigEntity entidade =
                repository.findById(chaveNorm).orElseGet(SistemaConfigEntity::new);
        entidade.setChave(chaveNorm);
        entidade.setValor(valor);
        repository.save(entidade);
    }
}
