package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.ProcessoAndamento;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessoAndamentoRepository extends JpaRepository<ProcessoAndamento, Long> {

    @EntityGraph(attributePaths = {"usuario"})
    List<ProcessoAndamento> findByProcesso_IdOrderByMovimentoEmDesc(Long processoId);
}
