package br.com.vilareal.pagamento.infrastructure.persistence.repository;

import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoRecorrenciaConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PagamentoRecorrenciaConfigRepository extends JpaRepository<PagamentoRecorrenciaConfigEntity, Long> {

    List<PagamentoRecorrenciaConfigEntity> findByAtivoTrueOrderByIdAsc();

    List<PagamentoRecorrenciaConfigEntity> findByImovel_IdAndAtivoTrueOrderByIdAsc(Long imovelId);

    @Query("""
            SELECT c FROM PagamentoRecorrenciaConfigEntity c
            JOIN FETCH c.imovel im
            LEFT JOIN FETCH c.cliente
            WHERE (:imovelId IS NULL OR im.id = :imovelId)
              AND (:categoria IS NULL OR c.categoria = :categoria)
              AND (:ativo IS NULL OR c.ativo = :ativo)
            ORDER BY CASE WHEN im.numeroPlanilha IS NULL THEN 1 ELSE 0 END,
                     im.numeroPlanilha ASC, c.categoria ASC, c.id ASC
            """)
    List<PagamentoRecorrenciaConfigEntity> listarComFiltros(
            @Param("imovelId") Long imovelId,
            @Param("categoria") String categoria,
            @Param("ativo") Boolean ativo);
}
