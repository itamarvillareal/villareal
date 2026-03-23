package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.Processo;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProcessoRepository extends JpaRepository<Processo, Long> {

    @EntityGraph(attributePaths = {"cliente", "usuarioResponsavel"})
    @Override
    Optional<Processo> findById(Long id);

    @EntityGraph(attributePaths = {"cliente", "usuarioResponsavel"})
    @Query("SELECT p FROM Processo p WHERE (:clienteId IS NULL OR p.cliente.id = :clienteId) " +
            "AND (:ativo IS NULL OR p.ativo = :ativo) ORDER BY p.cliente.id, p.numeroInterno")
    List<Processo> findAllFiltered(@Param("clienteId") Long clienteId, @Param("ativo") Boolean ativo);

    @EntityGraph(attributePaths = {"cliente", "usuarioResponsavel"})
    List<Processo> findByClienteIdOrderByNumeroInternoAsc(Long clienteId);

    Optional<Processo> findByClienteIdAndNumeroInterno(Long clienteId, Integer numeroInterno);

    boolean existsByClienteIdAndNumeroInterno(Long clienteId, Integer numeroInterno);

    boolean existsByClienteIdAndNumeroInternoAndIdNot(Long clienteId, Integer numeroInterno, Long id);
}
