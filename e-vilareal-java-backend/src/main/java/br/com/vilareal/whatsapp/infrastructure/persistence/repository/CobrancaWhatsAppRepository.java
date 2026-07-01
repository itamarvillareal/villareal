package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CobrancaWhatsAppRepository extends JpaRepository<CobrancaWhatsAppEntity, Long> {

    List<CobrancaWhatsAppEntity> findByLoteIdOrderByPessoaNomeAsc(String loteId);

    List<CobrancaWhatsAppEntity> findByProcessoIdAndStatusNotOrderByCreatedAtDesc(
            Long processoId, String status);

    List<CobrancaWhatsAppEntity> findByProcessoIdInAndStatusNotOrderByCreatedAtDesc(
            Collection<Long> processoIds, String status);

    List<CobrancaWhatsAppEntity> findByImovelIdInAndStatusNotOrderByCreatedAtDesc(
            Collection<Long> imovelIds, String status);

    long countByStatus(String status);

    List<CobrancaWhatsAppEntity> findByStatusInAndScheduledAtIsNotNullOrderByScheduledAtDesc(
            Collection<String> statuses);

    interface LoteResumoRow {
        String getLoteId();

        String getLoteDescricao();

        Instant getCreatedAt();

        String getCreatedBy();

        Long getTotal();

        Long getEnviados();

        Long getFalhos();

        Long getPendentes();
    }

    @Query(
            value =
                    """
                    SELECT c.lote_id AS loteId,
                           c.lote_descricao AS loteDescricao,
                           MIN(c.created_at) AS createdAt,
                           c.created_by AS createdBy,
                           COUNT(c.id) AS total,
                           SUM(CASE WHEN c.status IN ('ENVIADO', 'ENTREGUE', 'LIDO') THEN 1 ELSE 0 END) AS enviados,
                           SUM(CASE WHEN c.status = 'FALHOU' THEN 1 ELSE 0 END) AS falhos,
                           SUM(CASE WHEN c.status IN ('PENDENTE', 'AGENDADO') THEN 1 ELSE 0 END) AS pendentes
                    FROM whatsapp_cobrancas c
                    GROUP BY c.lote_id, c.lote_descricao, c.created_by
                    ORDER BY MIN(c.created_at) DESC
                    """,
            countQuery = "SELECT COUNT(DISTINCT c.lote_id) FROM whatsapp_cobrancas c",
            nativeQuery = true)
    Page<LoteResumoRow> findLotesResumo(Pageable pageable);

    long countByLoteIdAndStatus(String loteId, String status);

    @Query(
            """
            SELECT COUNT(c) > 0 FROM CobrancaWhatsAppEntity c
            WHERE c.imovelId = :imovelId
              AND c.status <> 'CANCELADO'
              AND c.createdAt >= :inicioMes
              AND c.createdAt < :fimMes
            """)
    boolean existsCobrancaNoMes(
            @Param("imovelId") Long imovelId,
            @Param("inicioMes") Instant inicioMes,
            @Param("fimMes") Instant fimMes);

    Optional<CobrancaWhatsAppEntity> findByWaMessageId(String waMessageId);

    List<CobrancaWhatsAppEntity> findByLoteIdAndStatus(String loteId, String status);

    List<CobrancaWhatsAppEntity> findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(
            String status, Instant scheduledAt);

    @Query(
            """
            SELECT COUNT(c) > 0 FROM CobrancaWhatsAppEntity c
            WHERE c.processoId = :processoId
              AND c.status <> 'CANCELADO'
              AND c.createdAt >= :inicioMes
              AND c.createdAt < :fimMes
            """)
    boolean existsCobrancaNoMesPorProcesso(
            @Param("processoId") Long processoId,
            @Param("inicioMes") Instant inicioMes,
            @Param("fimMes") Instant fimMes);

    @Query(
            """
            SELECT COUNT(c),
                   SUM(CASE WHEN c.status IN ('ENTREGUE', 'LIDO') THEN 1 ELSE 0 END),
                   COALESCE(SUM(c.valorPendente), 0)
            FROM CobrancaWhatsAppEntity c
            WHERE c.createdAt >= :inicioMes AND c.createdAt < :fimMes
            """)
    Object[] statsDoMes(@Param("inicioMes") Instant inicioMes, @Param("fimMes") Instant fimMes);
}
