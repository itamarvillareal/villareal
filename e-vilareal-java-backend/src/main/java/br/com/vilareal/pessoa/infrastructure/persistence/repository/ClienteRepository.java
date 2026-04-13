package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<ClienteEntity, Long> {

    Optional<ClienteEntity> findByCodigoCliente(String codigoCliente);

    /** Uso fora de transação longa — evita {@code LazyInitializationException} ao ler {@code pessoa}. */
    @Query("SELECT c FROM ClienteEntity c JOIN FETCH c.pessoa WHERE c.codigoCliente = :codigoCliente")
    Optional<ClienteEntity> findByCodigoClienteFetchPessoa(@Param("codigoCliente") String codigoCliente);

    boolean existsByPessoa_Id(Long pessoaId);

    boolean existsByCodigoCliente(String codigoCliente);

    @Query("SELECT c FROM ClienteEntity c JOIN FETCH c.pessoa ORDER BY c.codigoCliente ASC")
    List<ClienteEntity> findAllFetchPessoaOrderByCodigo();

    List<ClienteEntity> findByPessoa_IdOrderByCodigoClienteAsc(Long pessoaId);
}
