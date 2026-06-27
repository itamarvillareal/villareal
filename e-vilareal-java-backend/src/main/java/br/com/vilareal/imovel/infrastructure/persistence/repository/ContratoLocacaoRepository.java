package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ContratoLocacaoRepository extends JpaRepository<ContratoLocacaoEntity, Long> {

    List<ContratoLocacaoEntity> findByImovel_IdOrderByDataInicioDescIdDesc(Long imovelId);

    List<ContratoLocacaoEntity> findByImovel_IdAndProcesso_IdOrderByDataInicioDescIdDesc(
            Long imovelId, Long processoId);

    /** Contratos do imóvel cujo processo é o informado (mais recente primeiro). */
    @Query("""
            SELECT c FROM ContratoLocacaoEntity c
            JOIN FETCH c.imovel i
            WHERE i.processo.id = :processoId
            ORDER BY c.id DESC
            """)
    List<ContratoLocacaoEntity> findByImovelProcessoId(@Param("processoId") Long processoId);

    /** Contratos cuja vigência intersecta o intervalo [inicio, fim] (inclusive). */
    @Query(
            """
            SELECT c FROM ContratoLocacaoEntity c
            JOIN FETCH c.imovel
            LEFT JOIN FETCH c.locadorPessoa
            WHERE (c.dataInicio IS NULL OR c.dataInicio <= :fim)
              AND (c.dataFim IS NULL OR c.dataFim >= :inicio)
            ORDER BY c.id ASC
            """)
    List<ContratoLocacaoEntity> findVigentesNoPeriodo(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    /** Contratos VIGENTES sem vínculo ALUGUEL na competência (candidatos à auto-conciliação). */
    @Query(
            """
            SELECT DISTINCT c FROM ContratoLocacaoEntity c
            JOIN FETCH c.imovel i
            LEFT JOIN FETCH c.locadorPessoa
            JOIN ImovelProcessoEntity ip ON ip.imovel.id = i.id AND ip.ativo = true
            WHERE UPPER(c.status) = 'VIGENTE'
              AND c.valorAluguel IS NOT NULL AND c.valorAluguel > 0
              AND (c.dataInicio IS NULL OR c.dataInicio <= :fim)
              AND (c.dataFim IS NULL OR c.dataFim >= :inicio)
              AND NOT EXISTS (
                  SELECT 1 FROM LocacaoRepasseLancamentoEntity v
                  WHERE v.contratoLocacao.id = c.id
                    AND v.competenciaMes = :competencia
                    AND v.papel = br.com.vilareal.imovel.domain.PapelReconciliacao.ALUGUEL
              )
            ORDER BY c.id ASC
            """)
    List<ContratoLocacaoEntity> findVigentesSemAluguelNaCompetencia(
            @Param("competencia") String competencia,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    @Query(
            """
            SELECT c FROM ContratoLocacaoEntity c
            JOIN FETCH c.imovel i
            JOIN ImovelProcessoEntity ip ON ip.imovel.id = i.id AND ip.ativo = true
            WHERE ip.processo.id = :processoId
              AND UPPER(c.status) = 'VIGENTE'
              AND c.valorAluguel IS NOT NULL AND c.valorAluguel > 0
              AND (c.dataInicio IS NULL OR c.dataInicio <= :fim)
              AND (c.dataFim IS NULL OR c.dataFim >= :inicio)
            ORDER BY c.id ASC
            """)
    List<ContratoLocacaoEntity> findVigentesByProcessoNaCompetencia(
            @Param("processoId") Long processoId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    /** Contratos VIGENTES com {@code data_fim} no intervalo inclusive (renovação). */
    @Query(
            """
            SELECT c FROM ContratoLocacaoEntity c
            JOIN FETCH c.imovel i
            LEFT JOIN FETCH c.locadorPessoa
            WHERE UPPER(c.status) = 'VIGENTE'
              AND c.dataFim IS NOT NULL
              AND c.dataFim >= :inicio
              AND c.dataFim <= :fim
            ORDER BY c.dataFim ASC, c.id ASC
            """)
    List<ContratoLocacaoEntity> findVigentesComDataFimEntre(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);
}
