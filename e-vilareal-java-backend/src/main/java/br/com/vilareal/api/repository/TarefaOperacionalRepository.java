package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.TarefaOperacional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface TarefaOperacionalRepository extends JpaRepository<TarefaOperacional, Long>, JpaSpecificationExecutor<TarefaOperacional> {
}
