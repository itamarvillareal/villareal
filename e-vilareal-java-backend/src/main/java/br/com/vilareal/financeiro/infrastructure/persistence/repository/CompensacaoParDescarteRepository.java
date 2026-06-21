package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.CompensacaoParDescarteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface CompensacaoParDescarteRepository extends JpaRepository<CompensacaoParDescarteEntity, Long> {

    boolean existsByLancamentoIdMenorAndLancamentoIdMaior(Long lancamentoIdMenor, Long lancamentoIdMaior);

    void deleteByLancamentoIdMenor(Long lancamentoIdMenor);

    void deleteByLancamentoIdMaior(Long lancamentoIdMaior);

    @Modifying
    @Query(
            """
            DELETE FROM CompensacaoParDescarteEntity d
            WHERE d.lancamentoIdMenor IN :lancamentoIds OR d.lancamentoIdMaior IN :lancamentoIds
            """)
    void deleteByEnvolvendoLancamentos(@Param("lancamentoIds") Collection<Long> lancamentoIds);

    @Query(
            """
            SELECT d FROM CompensacaoParDescarteEntity d
            WHERE d.lancamentoIdMenor IN :lancamentoIds OR d.lancamentoIdMaior IN :lancamentoIds
            """)
    List<CompensacaoParDescarteEntity> findByEnvolvendoLancamentos(
            @Param("lancamentoIds") Collection<Long> lancamentoIds);
}
