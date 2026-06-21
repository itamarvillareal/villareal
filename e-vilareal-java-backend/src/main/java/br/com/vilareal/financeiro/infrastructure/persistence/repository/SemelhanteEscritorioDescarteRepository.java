package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.SemelhanteEscritorioDescarteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface SemelhanteEscritorioDescarteRepository extends JpaRepository<SemelhanteEscritorioDescarteEntity, Long> {

    boolean existsByLancamentoIdAndClienteIdAndProcessoId(Long lancamentoId, Long clienteId, Long processoId);

    void deleteByLancamentoId(Long lancamentoId);

    void deleteByLancamentoIdIn(Collection<Long> lancamentoIds);

    @Query(
            """
            SELECT d FROM SemelhanteEscritorioDescarteEntity d
            WHERE d.lancamentoId IN :lancamentoIds
            """)
    List<SemelhanteEscritorioDescarteEntity> findByLancamentoIdIn(
            @Param("lancamentoIds") Collection<Long> lancamentoIds);
}
