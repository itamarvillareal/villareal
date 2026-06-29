package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<ClienteEntity, Long> {

    Optional<ClienteEntity> findByCodigoCliente(String codigoCliente);

    /** Uso fora de transação longa — evita {@code LazyInitializationException} ao ler {@code pessoa}. */
    @Query("SELECT c FROM ClienteEntity c JOIN FETCH c.pessoa WHERE c.codigoCliente = :codigoCliente")
    Optional<ClienteEntity> findByCodigoClienteFetchPessoa(@Param("codigoCliente") String codigoCliente);

    /**
     * Mesmo que {@link #findByCodigoClienteFetchPessoa} com {@code TRIM} em ambos os lados — alinha a
     * comparação a {@code CHAR(8)} com espaços do MySQL.
     */
    @Query("SELECT c FROM ClienteEntity c JOIN FETCH c.pessoa WHERE TRIM(c.codigoCliente) = TRIM(:codigoCliente)")
    Optional<ClienteEntity> findByCodigoClienteFetchPessoaTrim(@Param("codigoCliente") String codigoCliente);

    boolean existsByPessoa_Id(Long pessoaId);

    boolean existsByCodigoCliente(String codigoCliente);

    @Query("SELECT c FROM ClienteEntity c JOIN FETCH c.pessoa ORDER BY c.codigoCliente ASC")
    List<ClienteEntity> findAllFetchPessoaOrderByCodigo();

    @Query("SELECT COUNT(c), MAX(c.updatedAt) FROM ClienteEntity c")
    Object[] countAndMaxUpdatedAt();

    @Query(
            """
            SELECT c FROM ClienteEntity c JOIN FETCH c.pessoa p
            WHERE (:digitsOnly = true AND c.codigoCliente LIKE CONCAT('%', :termo, '%'))
               OR (:digitsOnly = false AND LOWER(p.nome) LIKE LOWER(CONCAT('%', :termo, '%')))
            ORDER BY c.codigoCliente ASC
            """)
    List<ClienteEntity> buscarIndicePorTermo(
            @Param("termo") String termo, @Param("digitsOnly") boolean digitsOnly, Pageable pageable);

    List<ClienteEntity> findByPessoa_IdOrderByCodigoClienteAsc(Long pessoaId);
}
