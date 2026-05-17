package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoBancoMapeamentoEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CartaoBancoMapeamentoRepository extends JpaRepository<CartaoBancoMapeamentoEntity, Long> {

    @EntityGraph(attributePaths = "cartao")
    List<CartaoBancoMapeamentoEntity> findByAtivoTrueOrderByCartaoIdAscIdAsc();
}
