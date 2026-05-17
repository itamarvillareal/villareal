package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LancamentoCartaoRepository
        extends JpaRepository<LancamentoCartaoEntity, Long>, JpaSpecificationExecutor<LancamentoCartaoEntity> {

    @Query(
            """
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.cartao c
            JOIN FETCH l.contaContabil
            WHERE UPPER(TRIM(c.nome)) = :nomeNorm
            """)
    List<LancamentoCartaoEntity> findAllByCartaoNomeNormalizado(@Param("nomeNorm") String nomeNorm);

    @Query(
            """
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.cartao c
            JOIN FETCH l.contaContabil
            WHERE c.numeroCartao = :numero
            """)
    List<LancamentoCartaoEntity> findAllByNumeroCartao(@Param("numero") Integer numero);
}
