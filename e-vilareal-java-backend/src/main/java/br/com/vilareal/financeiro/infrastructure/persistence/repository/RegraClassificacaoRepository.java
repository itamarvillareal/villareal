package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RegraClassificacaoRepository extends JpaRepository<RegraClassificacaoEntity, Long> {

    @EntityGraph(attributePaths = {"contaContabil", "pessoaRef", "clienteEntidade", "processo"})
    List<RegraClassificacaoEntity> findByAtivoTrueOrderByPrioridadeAscIdAsc();

    List<RegraClassificacaoEntity> findByAtivoTrueOrderByConfiancaDescPrioridadeAscIdAsc();
}
