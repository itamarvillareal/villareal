package br.com.vilareal.pagamento.infrastructure.persistence.repository;

import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PagamentoRepository extends JpaRepository<PagamentoEntity, Long>, JpaSpecificationExecutor<PagamentoEntity> {

    boolean existsByFinanceiroLancamento_Id(Long financeiroLancamentoId);

    List<PagamentoEntity> findByFinanceiroLancamento_IdIn(Collection<Long> financeiroLancamentoIds);

    boolean existsByFinanceiroLancamento_IdAndIdNot(Long financeiroLancamentoId, Long pagamentoId);

    @Query("""
            SELECT p FROM PagamentoEntity p
            WHERE p.tipo = :tipo
              AND p.status IN :statuses
              AND p.financeiroLancamento IS NULL
              AND (
                  p.dataVencimento BETWEEN :inicio AND :fim
                  OR (p.dataAgendamento IS NOT NULL AND p.dataAgendamento BETWEEN :inicio AND :fim)
                  OR (p.dataRecebimento IS NOT NULL AND p.dataRecebimento BETWEEN :inicio AND :fim)
              )
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<PagamentoEntity> findCandidatosConciliacao(
            @Param("tipo") String tipo,
            @Param("statuses") Collection<String> statuses,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    @Query("""
            SELECT DISTINCT p FROM PagamentoEntity p
            LEFT JOIN FETCH p.imovel im
            WHERE p.status = :status
              AND p.prestacaoContas IS NULL
              AND (p.cliente.id = :clienteId OR im.cliente.id = :clienteId)
              AND (
                  :periodoInicio IS NULL OR :periodoFim IS NULL
                  OR (p.dataPagamentoEfetivo IS NOT NULL
                      AND p.dataPagamentoEfetivo BETWEEN :periodoInicio AND :periodoFim)
                  OR (p.dataConferencia IS NOT NULL
                      AND p.dataConferencia BETWEEN :periodoInicio AND :periodoFim)
              )
            ORDER BY im.id, p.dataVencimento, p.id
            """)
    List<PagamentoEntity> findPendentesPrestacaoContas(
            @Param("status") String status,
            @Param("clienteId") Long clienteId,
            @Param("periodoInicio") LocalDate periodoInicio,
            @Param("periodoFim") LocalDate periodoFim);

    Optional<PagamentoEntity> findFirstByRecorrenciaConfig_IdAndMesReferencia(Long recorrenciaConfigId, String mesReferencia);

    Optional<PagamentoEntity> findFirstByOrigemAndMesReferencia(String origem, String mesReferencia);

    Page<PagamentoEntity> findByRecorrenciaConfig_IdOrderByMesReferenciaDescIdDesc(
            Long recorrenciaConfigId, Pageable pageable);

    @Query("""
            SELECT p FROM PagamentoEntity p
            LEFT JOIN p.processo proc
            LEFT JOIN p.imovel im
            WHERE p.status NOT IN :statusEncerrados
              AND (p.cliente.id = :clienteId OR im.cliente.id = :clienteId)
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<PagamentoEntity> findAbertosPorCliente(
            @Param("clienteId") Long clienteId, @Param("statusEncerrados") Collection<String> statusEncerrados);

    @Query("""
            SELECT DISTINCT p FROM PagamentoEntity p
            LEFT JOIN FETCH p.financeiroLancamento fl
            WHERE p.tipo = 'RECEBER'
              AND p.status NOT IN ('CANCELADO', 'SUBSTITUIDO')
              AND (
                  p.processo.id = :processoId
                  OR fl.processo.id = :processoId
              )
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<PagamentoEntity> findReceberPorProcesso(@Param("processoId") Long processoId);

    @Query(
            """
            SELECT p FROM PagamentoEntity p
            LEFT JOIN FETCH p.cliente c
            LEFT JOIN FETCH c.pessoa
            LEFT JOIN FETCH p.processo proc
            LEFT JOIN FETCH p.imovel im
            WHERE p.tipo = 'RECEBER'
              AND p.status IN ('EMITIDO', 'VENCIDO')
              AND p.dataVencimento BETWEEN :inicio AND :fim
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<PagamentoEntity> findReceberAbertosNoPeriodo(
            @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    @Query(
            """
            SELECT DISTINCT p FROM PagamentoEntity p
            LEFT JOIN FETCH p.cliente c
            LEFT JOIN FETCH p.processo proc
            LEFT JOIN FETCH p.imovel im
            WHERE p.tipo = 'PAGAR'
              AND p.status IN ('PENDENTE', 'AGENDADO', 'VENCIDO')
              AND p.dataVencimento <= :fimCompetencia
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<PagamentoEntity> findPagarAbertosAteVencimento(@Param("fimCompetencia") LocalDate fimCompetencia);

    @Query(
            """
            SELECT DISTINCT p FROM PagamentoEntity p
            JOIN FETCH p.recorrenciaConfig rc
            JOIN FETCH rc.imovel im
            LEFT JOIN FETCH p.cliente c
            WHERE p.tipo = 'PAGAR'
              AND p.categoria = 'CONDOMINIO'
              AND p.recorrenciaConfig IS NOT NULL
              AND p.financeiroLancamento IS NULL
              AND p.status IN ('PENDENTE', 'AGENDADO', 'VENCIDO')
              AND (:mesReferencia IS NULL OR p.mesReferencia = :mesReferencia)
            ORDER BY p.dataVencimento ASC, p.id ASC
            """)
    List<PagamentoEntity> findCondominioRecorrenteAbertoParaConciliar(@Param("mesReferencia") String mesReferencia);
}
