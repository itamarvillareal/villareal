package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ContratoLocacaoRepository extends JpaRepository<ContratoLocacaoEntity, Long> {

    List<ContratoLocacaoEntity> findByImovel_IdOrderByDataInicioDescIdDesc(Long imovelId);

    /** Contratos do imóvel cujo processo é o informado (mais recente primeiro). */
    @Query("""
            SELECT c FROM ContratoLocacaoEntity c
            JOIN FETCH c.imovel i
            WHERE i.processo.id = :processoId
            ORDER BY c.id DESC
            """)
    List<ContratoLocacaoEntity> findByImovelProcessoId(@Param("processoId") Long processoId);
}
