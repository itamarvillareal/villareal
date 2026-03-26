package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContaContabilRepository extends JpaRepository<ContaContabilEntity, Long> {

    List<ContaContabilEntity> findByAtivoTrueOrderByOrdemExibicaoAscIdAsc();

    boolean existsByCodigoIgnoreCase(String codigo);

    boolean existsByNome(String nome);

    boolean existsByCodigoIgnoreCaseAndIdNot(String codigo, Long id);

    boolean existsByNomeAndIdNot(String nome, Long id);
}
