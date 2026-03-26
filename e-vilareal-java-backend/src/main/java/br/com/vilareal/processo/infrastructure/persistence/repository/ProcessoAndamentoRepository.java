package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessoAndamentoRepository extends JpaRepository<ProcessoAndamentoEntity, Long> {

    List<ProcessoAndamentoEntity> findByProcesso_IdOrderByMovimentoEmDescIdDesc(Long processoId);
}
