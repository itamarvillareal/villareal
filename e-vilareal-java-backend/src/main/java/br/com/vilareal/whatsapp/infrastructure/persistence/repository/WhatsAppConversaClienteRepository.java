package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface WhatsAppConversaClienteRepository extends JpaRepository<WhatsAppConversaClienteEntity, Long> {

    interface ClienteDistinctRow {
        String getClienteCodigo();

        String getClienteNome();
    }

    int deleteByPhoneNumber(String phoneNumber);

    List<WhatsAppConversaClienteEntity> findByPhoneNumberIn(Collection<String> phoneNumbers);

    @Query(
            """
            SELECT DISTINCT c.clienteCodigo AS clienteCodigo, c.clienteNome AS clienteNome
            FROM WhatsAppConversaClienteEntity c
            ORDER BY c.clienteNome ASC
            """)
    List<ClienteDistinctRow> findDistinctClientes();

    interface GrupoClienteRow {
        String getClienteCodigo();

        String getClienteNome();

        Long getQtdConversas();
    }

    @Query(
            value =
                    """
                    SELECT cliente_codigo AS clienteCodigo,
                           cliente_nome AS clienteNome,
                           COUNT(DISTINCT phone_number) AS qtdConversas
                    FROM whatsapp_conversa_cliente
                    GROUP BY cliente_codigo, cliente_nome
                    ORDER BY cliente_nome ASC
                    """,
            nativeQuery = true)
    List<GrupoClienteRow> listarGruposComContagem();
}
