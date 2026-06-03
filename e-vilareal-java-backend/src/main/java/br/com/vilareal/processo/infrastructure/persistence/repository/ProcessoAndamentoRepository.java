package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ProcessoAndamentoRepository extends JpaRepository<ProcessoAndamentoEntity, Long> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM ProcessoAndamentoEntity a WHERE a.origem = :origem")
    int deleteByOrigem(@Param("origem") String origem);

    List<ProcessoAndamentoEntity> findByProcesso_IdOrderByMovimentoEmDescIdDesc(Long processoId);

    long countByProcesso_Id(Long processoId);

    @Query(
            """
            SELECT a FROM ProcessoAndamentoEntity a
            LEFT JOIN FETCH a.usuario
            WHERE a.processo.id = :processoId
            ORDER BY a.movimentoEm ASC, a.id ASC
            """)
    List<ProcessoAndamentoEntity> findByProcesso_IdOrderByMovimentoEmAscIdAsc(@Param("processoId") Long processoId);

    List<ProcessoAndamentoEntity> findByProcesso_IdAndUsuario_IdOrderByMovimentoEmDescIdDesc(
            Long processoId, Long usuarioId);

    @Query(
            """
            SELECT a FROM ProcessoAndamentoEntity a
            WHERE a.processo.id = :processoId
              AND a.origem = :origem
              AND a.movimentoEm >= :desde
            ORDER BY a.movimentoEm DESC, a.id DESC
            """)
    List<ProcessoAndamentoEntity> findRecentesPorOrigem(
            @Param("processoId") Long processoId,
            @Param("origem") String origem,
            @Param("desde") Instant desde);

    /**
     * Pares (andamento_id, id do usuário) via join — evita SQL nativo (tipos JDBC variam) e
     * funciona quando a FK existe mas a associação na entidade carregada não foi hidratada.
     */
    @Query(
            "SELECT a.id, u.id FROM ProcessoAndamentoEntity a LEFT JOIN a.usuario u "
                    + "WHERE a.processo.id = :processoId")
    List<Object[]> findAndamentoUsuarioFkPairsByProcessoId(@Param("processoId") Long processoId);

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);

    @Query(
            """
            SELECT a FROM ProcessoAndamentoEntity a
            JOIN FETCH a.processo p
            JOIN FETCH p.pessoa
            LEFT JOIN FETCH a.usuario
            WHERE a.movimentoEm >= :inicio AND a.movimentoEm < :fim
            ORDER BY a.movimentoEm DESC, a.id DESC
            """)
    List<ProcessoAndamentoEntity> findByMovimentoEmBetween(
            @Param("inicio") Instant inicio, @Param("fim") Instant fim);

    /**
     * Andamentos cuja data do movimento ou cuja gravação/atualização na API cai no intervalo
     * (relatório «Consultas Realizadas»).
     */
    @Query(
            """
            SELECT a FROM ProcessoAndamentoEntity a
            JOIN FETCH a.processo p
            JOIN FETCH p.pessoa
            LEFT JOIN FETCH a.usuario
            WHERE (a.movimentoEm >= :inicio AND a.movimentoEm < :fim)
               OR (a.atualizadoEm >= :inicio AND a.atualizadoEm < :fim)
            ORDER BY a.atualizadoEm DESC, a.id DESC
            """)
    List<ProcessoAndamentoEntity> findByMovimentoEmOrAtualizadoEmBetween(
            @Param("inicio") Instant inicio, @Param("fim") Instant fim);
}
