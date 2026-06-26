package br.com.vilareal.projudi.infrastructure.persistence.repository;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ProjudiPeticaoRepository extends JpaRepository<ProjudiPeticaoEntity, Long> {

    List<ProjudiPeticaoEntity> findByStatus(String status);

    @Query("""
            SELECT DISTINCT p FROM ProjudiPeticaoEntity p
            LEFT JOIN FETCH p.arquivos
            ORDER BY p.criadoEm DESC
            """)
    List<ProjudiPeticaoEntity> findAllWithArquivos();

    @Query("""
            SELECT DISTINCT p FROM ProjudiPeticaoEntity p
            LEFT JOIN FETCH p.arquivos
            WHERE p.status = :status
            ORDER BY p.criadoEm DESC
            """)
    List<ProjudiPeticaoEntity> findByStatusWithArquivos(@Param("status") String status);

    @Query("SELECT p FROM ProjudiPeticaoEntity p LEFT JOIN FETCH p.arquivos WHERE p.id = :id")
    Optional<ProjudiPeticaoEntity> findByIdWithArquivos(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.status = 'PROTOCOLANDO'
            WHERE p.id = :id AND p.status = 'ASSINADA'
            """)
    int claimParaProtocolo(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.status = :status,
                p.protocoloMensagem = :mensagem,
                p.protocoladoEm = :protocoladoEm,
                p.protocoloEtapa = null,
                p.protocoloAgendadoPara = CASE WHEN :status = 'PROTOCOLADA' THEN null ELSE p.protocoloAgendadoPara END
            WHERE p.id = :id
            """)
    void finalizarProtocolo(
            @Param("id") Long id,
            @Param("status") String status,
            @Param("mensagem") String mensagem,
            @Param("protocoladoEm") Instant protocoladoEm);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.protocoloEtapa = :etapa
            WHERE p.id IN :ids AND p.status = 'PROTOCOLANDO'
            """)
    void atualizarEtapa(@Param("ids") List<Long> ids, @Param("etapa") String etapa);

    /** Limpa mensagem/etapa de tentativas anteriores ao iniciar um novo protocolo (estado limpo). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.protocoloMensagem = null, p.protocoloEtapa = null
            WHERE p.id IN :ids AND p.status = 'ASSINADA'
            """)
    void limparEstadoFila(@Param("ids") List<Long> ids);

    /** Grava uma mensagem na fila (ex.: "robô ocupado") sem mudar o status ASSINADA. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.protocoloMensagem = :mensagem
            WHERE p.id IN :ids AND p.status = 'ASSINADA'
            """)
    void registrarMensagemFila(@Param("ids") List<Long> ids, @Param("mensagem") String mensagem);

    @Query("""
            SELECT p.id FROM ProjudiPeticaoEntity p
            WHERE p.status = 'ASSINADA'
              AND p.protocoloAgendadoPara IS NOT NULL
              AND p.protocoloAgendadoPara <= :agora
            ORDER BY p.protocoloAgendadoPara ASC, p.id ASC
            """)
    List<Long> findIdsProntasParaProtocoloAgendado(@Param("agora") Instant agora);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.protocoloAgendadoPara = null
            WHERE p.id IN :ids
            """)
    void limparAgendamento(@Param("ids") List<Long> ids);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.protocoloAgendadoPara = null
            WHERE p.id = :id
              AND p.protocoloAgendadoPara IS NOT NULL
              AND p.status NOT IN ('PROTOCOLANDO', 'PROTOCOLADA')
            """)
    int cancelarAgendamentoSePermitido(@Param("id") Long id);

    @Query("""
            SELECT p.id FROM ProjudiPeticaoEntity p
            WHERE p.id IN :ids
              AND p.protocoloAgendadoPara IS NOT NULL
              AND p.status = 'ASSINADA'
            """)
    List<Long> filtrarIdsComAgendamentoAtivo(@Param("ids") List<Long> ids);

    @Override
    Optional<ProjudiPeticaoEntity> findById(Long id);
}
