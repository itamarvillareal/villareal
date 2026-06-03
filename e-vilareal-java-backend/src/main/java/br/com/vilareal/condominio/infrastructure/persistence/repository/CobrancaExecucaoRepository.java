package br.com.vilareal.condominio.infrastructure.persistence.repository;

import br.com.vilareal.condominio.infrastructure.persistence.entity.CobrancaExecucaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CobrancaExecucaoRepository extends JpaRepository<CobrancaExecucaoEntity, Long> {

    Optional<CobrancaExecucaoEntity> findByImportacaoId(String importacaoId);
}
