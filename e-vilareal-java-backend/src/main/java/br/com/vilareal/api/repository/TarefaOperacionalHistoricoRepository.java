package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.TarefaOperacionalHistorico;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TarefaOperacionalHistoricoRepository extends JpaRepository<TarefaOperacionalHistorico, Long> {
    List<TarefaOperacionalHistorico> findByTarefa_IdOrderByCreatedAtDesc(Long tarefaId);
}
