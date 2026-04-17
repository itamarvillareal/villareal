package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProcessoAndamentoRepository extends JpaRepository<ProcessoAndamentoEntity, Long> {

    List<ProcessoAndamentoEntity> findByProcesso_IdOrderByMovimentoEmDescIdDesc(Long processoId);

    /**
     * Pares (andamento_id, id do usuário) via join — evita SQL nativo (tipos JDBC variam) e
     * funciona quando a FK existe mas a associação na entidade carregada não foi hidratada.
     */
    @Query(
            "SELECT a.id, u.id FROM ProcessoAndamentoEntity a LEFT JOIN a.usuario u "
                    + "WHERE a.processo.id = :processoId")
    List<Object[]> findAndamentoUsuarioFkPairsByProcessoId(@Param("processoId") Long processoId);

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);
}
