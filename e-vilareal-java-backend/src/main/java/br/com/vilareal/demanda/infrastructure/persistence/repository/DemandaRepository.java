package br.com.vilareal.demanda.infrastructure.persistence.repository;

import br.com.vilareal.demanda.infrastructure.persistence.entity.DemandaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DemandaRepository extends JpaRepository<DemandaEntity, Long> {

    List<DemandaEntity> findByImovelIdOrderByCreatedAtDesc(Long imovelId);

    List<DemandaEntity> findByClienteIdOrderByCreatedAtDesc(Long clienteId);

    List<DemandaEntity> findByStatusOrderByCreatedAtDesc(String status);

    @Query(
            """
            SELECT d FROM DemandaEntity d
            WHERE d.imovel.id = :imovelId AND d.status NOT IN ('CONCLUIDO','CANCELADO')
            ORDER BY d.createdAt DESC
            """)
    List<DemandaEntity> findAtivasByImovelId(@Param("imovelId") Long imovelId);

    @Query(
            """
            SELECT d FROM DemandaEntity d
            WHERE d.prazoFinalizacao < CURRENT_DATE AND d.status NOT IN ('CONCLUIDO','CANCELADO')
            """)
    List<DemandaEntity> findVencidas();

    @Query(
            """
            SELECT d FROM DemandaEntity d
            WHERE d.reembolsavelCliente = true AND d.pagamento IS NULL AND d.geraValorContabil = true
              AND d.cliente.id = :clienteId
            """)
    List<DemandaEntity> findPendentesReembolsoByCliente(@Param("clienteId") Long clienteId);

    @Query(
            """
            SELECT d FROM DemandaEntity d
            LEFT JOIN FETCH d.imovel
            LEFT JOIN FETCH d.cliente c
            LEFT JOIN FETCH c.pessoa
            LEFT JOIN FETCH d.pagamento p
            LEFT JOIN FETCH p.financeiroLancamento
            WHERE d.id = :id
            """)
    Optional<DemandaEntity> findByIdComRelacionamentos(@Param("id") Long id);

    @Query(
            """
            SELECT DISTINCT d FROM DemandaEntity d
            LEFT JOIN FETCH d.imovel
            LEFT JOIN FETCH d.cliente c
            LEFT JOIN FETCH c.pessoa
            LEFT JOIN FETCH d.pagamento
            ORDER BY d.createdAt DESC
            """)
    List<DemandaEntity> findAllComRelacionamentos();
}
