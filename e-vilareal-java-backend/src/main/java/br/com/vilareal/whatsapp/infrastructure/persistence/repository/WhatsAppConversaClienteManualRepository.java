package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteManualEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface WhatsAppConversaClienteManualRepository
        extends JpaRepository<WhatsAppConversaClienteManualEntity, Long> {

    interface GrupoClienteRow {
        String getClienteCodigo();

        String getClienteNome();

        Long getQtdConversas();
    }

    List<WhatsAppConversaClienteManualEntity> findByPhoneNumber(String phoneNumber);

    List<WhatsAppConversaClienteManualEntity> findByPhoneNumberIn(Collection<String> phoneNumbers);

    Optional<WhatsAppConversaClienteManualEntity> findByPhoneNumberAndClienteCodigo(
            String phoneNumber, String clienteCodigo);

    @Modifying
    @Query(
            value =
                    """
                    INSERT INTO whatsapp_conversa_cliente_manual
                        (phone_number, cliente_codigo, cliente_nome, acao, criado_por, criado_em)
                    VALUES (:phoneNumber, :clienteCodigo, :clienteNome, :acao, :criadoPor, :criadoEm)
                    ON DUPLICATE KEY UPDATE
                        acao = VALUES(acao),
                        cliente_nome = VALUES(cliente_nome),
                        criado_por = VALUES(criado_por),
                        criado_em = VALUES(criado_em)
                    """,
            nativeQuery = true)
    void upsert(
            @Param("phoneNumber") String phoneNumber,
            @Param("clienteCodigo") String clienteCodigo,
            @Param("clienteNome") String clienteNome,
            @Param("acao") String acao,
            @Param("criadoPor") String criadoPor,
            @Param("criadoEm") Instant criadoEm);

    @Modifying
    int deleteByPhoneNumberAndClienteCodigo(String phoneNumber, String clienteCodigo);

    @Modifying
    int deleteByPhoneNumber(String phoneNumber);

    @Query(
            value =
                    """
                    SELECT eff.cliente_codigo AS clienteCodigo,
                           MAX(eff.cliente_nome) AS clienteNome,
                           COUNT(DISTINCT eff.phone_number) AS qtdConversas
                    FROM (
                        SELECT wcc.cliente_codigo, wcc.cliente_nome, wcc.phone_number
                        FROM whatsapp_conversa_cliente wcc
                        WHERE NOT EXISTS (
                            SELECT 1 FROM whatsapp_conversa_cliente_manual m
                            WHERE m.phone_number = wcc.phone_number
                              AND m.cliente_codigo = wcc.cliente_codigo
                              AND m.acao = 'EXCLUIR'
                        )
                        UNION
                        SELECT m.cliente_codigo, m.cliente_nome, m.phone_number
                        FROM whatsapp_conversa_cliente_manual m
                        WHERE m.acao = 'INCLUIR'
                    ) eff
                    GROUP BY eff.cliente_codigo
                    ORDER BY MAX(eff.cliente_nome) ASC
                    """,
            nativeQuery = true)
    List<GrupoClienteRow> listarGruposEfetivosComContagem();
}
