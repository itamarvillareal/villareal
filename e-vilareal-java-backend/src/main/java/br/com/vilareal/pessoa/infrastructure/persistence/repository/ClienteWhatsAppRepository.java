package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ClienteWhatsAppRepository extends JpaRepository<ClienteWhatsAppEntity, Long> {

    List<ClienteWhatsAppEntity> findByCliente_IdOrderByPrincipalDescIdAsc(Long clienteId);

    List<ClienteWhatsAppEntity> findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(Long clienteId);

    Optional<ClienteWhatsAppEntity> findFirstByCliente_IdAndPrincipalTrueAndAtivoTrue(Long clienteId);

    boolean existsByCliente_IdAndNumero(Long clienteId, String numero);

    void deleteByCliente_Id(Long clienteId);

    @Query(
            value =
                    """
                    SELECT cw.cliente_id FROM cliente_whatsapp cw
                    WHERE cw.ativo = TRUE
                      AND (
                        cw.numero = :digits
                        OR RIGHT(cw.numero, 11) = RIGHT(:digits, 11)
                        OR RIGHT(cw.numero, 10) = RIGHT(:digits, 10)
                      )
                    ORDER BY cw.principal DESC, cw.id ASC
                    LIMIT 1
                    """,
            nativeQuery = true)
    Optional<Long> findClienteIdByTelefoneNormalizado(@Param("digits") String digits);
}
