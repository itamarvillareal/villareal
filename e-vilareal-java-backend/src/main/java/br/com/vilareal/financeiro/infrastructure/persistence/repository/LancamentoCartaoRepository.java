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

    @Query("""
            SELECT l FROM LancamentoCartaoEntity l
            JOIN FETCH l.cartao
            JOIN FETCH l.contaContabil
            LEFT JOIN FETCH l.pessoaRef
            LEFT JOIN FETCH l.clienteEntidade
            LEFT JOIN FETCH l.processo
            WHERE l.cartao.id = :cartaoId
              AND l.dataLancamento BETWEEN :inicio AND :fim
            ORDER BY l.dataLancamento DESC, l.id DESC
            """)
    List<LancamentoCartaoEntity> findByCartaoAndPeriodo(
            @Param("cartaoId") Long cartaoId,
            @Param("inicio") java.time.LocalDate inicio,
            @Param("fim") java.time.LocalDate fim);
}
