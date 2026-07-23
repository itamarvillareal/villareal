package br.com.vilareal.processo.copiaidle.infrastructure.persistence.repository;

import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesCampanhaStatus;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity.CopiaMovimentacoesClienteCampanhaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CopiaMovimentacoesClienteCampanhaRepository
        extends JpaRepository<CopiaMovimentacoesClienteCampanhaEntity, Long> {

    Optional<CopiaMovimentacoesClienteCampanhaEntity> findByCodigoCliente(String codigoCliente);

    Optional<CopiaMovimentacoesClienteCampanhaEntity> findByCodigoClienteAndStatus(
            String codigoCliente, CopiaMovimentacoesCampanhaStatus status);
}
