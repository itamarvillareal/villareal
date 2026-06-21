package br.com.vilareal.documento.infrastructure.persistence.repository;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ContratoHonorariosParcelaRepository extends JpaRepository<ContratoHonorariosParcelaEntity, Long> {

    @Query(
            """
            SELECT par FROM ContratoHonorariosParcelaEntity par
            JOIN FETCH par.contrato c
            JOIN FETCH c.pessoa
            LEFT JOIN FETCH c.processo
            WHERE par.pagamento IS NULL
              AND par.dataVencimento BETWEEN :inicio AND :fim
            ORDER BY par.dataVencimento ASC, par.id ASC
            """)
    List<ContratoHonorariosParcelaEntity> findAbertasSemPagamentoNoPeriodo(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);
}
