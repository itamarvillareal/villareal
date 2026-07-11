package br.com.vilareal.monitoramento.infrastructure.persistence.repository;

import br.com.vilareal.monitoramento.infrastructure.persistence.entity.SegredoJusticaContagemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SegredoJusticaContagemRepository
        extends JpaRepository<SegredoJusticaContagemEntity, SegredoJusticaContagemEntity.Pk> {

    List<SegredoJusticaContagemEntity> findByPessoaId(Long pessoaId);

    /** Soma do segredo por pessoa para a listagem de pessoas monitoradas: [pessoaId, sum(qtd)]. */
    @Query("SELECT s.pessoaId, SUM(s.qtd) FROM SegredoJusticaContagemEntity s GROUP BY s.pessoaId")
    List<Object[]> somaPorPessoa();
}
