package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoGrupoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AcertoFechamentoGrupoRepository extends JpaRepository<AcertoFechamentoGrupoEntity, Long> {

    List<AcertoFechamentoGrupoEntity> findByAcertoFechamento_Id(Long acertoFechamentoId);

    long countByAcertoFechamento_Id(Long acertoFechamentoId);

    /** Grupos já cobertos por qualquer acerto do cliente na conta (para não revincular no próximo fechamento). */
    @Query("""
            SELECT g.grupoCompensacao FROM AcertoFechamentoGrupoEntity g
            WHERE g.acertoFechamento.cliente.id = :clienteId
              AND g.acertoFechamento.numeroBanco = :numeroBanco
            """)
    List<String> findGruposVinculadosPorClienteEConta(
            @Param("clienteId") Long clienteId, @Param("numeroBanco") Integer numeroBanco);
}
