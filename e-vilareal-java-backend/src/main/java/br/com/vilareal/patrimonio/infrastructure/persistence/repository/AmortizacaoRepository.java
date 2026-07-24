package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.AmortizacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public interface AmortizacaoRepository extends JpaRepository<AmortizacaoEntity, Long> {
    List<AmortizacaoEntity> findByPassivoIdOrderByDataSolicitacaoDesc(Long passivoId);

    List<AmortizacaoEntity> findByStatusOrderByDataSolicitacaoDesc(String status);

    @Query("""
            select coalesce(sum(a.valor), 0) from AmortizacaoEntity a
            where a.status = 'EFETIVADA'
              and a.dataEfetivacao >= :inicio
              and a.dataEfetivacao < :fim
            """)
    BigDecimal somaEfetivadaNoPeriodo(@Param("inicio") Instant inicio, @Param("fim") Instant fim);
}
