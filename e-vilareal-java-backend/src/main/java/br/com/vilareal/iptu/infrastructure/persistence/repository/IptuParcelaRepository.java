package br.com.vilareal.iptu.infrastructure.persistence.repository;

import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuParcelaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface IptuParcelaRepository
        extends JpaRepository<IptuParcelaEntity, Long>, JpaSpecificationExecutor<IptuParcelaEntity> {

    List<IptuParcelaEntity> findByIptuAnual_IdOrderByCompetenciaMesAsc(Long iptuAnualId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from IptuParcelaEntity p where p.iptuAnual.id = :anualId and p.status in :st")
    int deleteByIptuAnual_IdAndStatusIn(@Param("anualId") Long anualId, @Param("st") Collection<String> status);

    List<IptuParcelaEntity> findByContratoLocacao_Id(Long contratoLocacaoId);

    @Query(
            """
            SELECT p FROM IptuParcelaEntity p
            JOIN FETCH p.iptuAnual a
            JOIN FETCH a.imovel im
            LEFT JOIN FETCH p.contratoLocacao
            WHERE p.status IN ('PENDENTE', 'ATRASADO')
              AND p.pagamento IS NULL
              AND p.dataVencimento IS NOT NULL
              AND p.dataVencimento BETWEEN :inicio AND :fim
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<IptuParcelaEntity> findAbertasNoPeriodo(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);
}
