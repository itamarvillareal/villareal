package br.com.vilareal.tarefa.infrastructure.persistence.repository;

import br.com.vilareal.tarefa.infrastructure.persistence.entity.TarefaOperacionalEntity;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface TarefaOperacionalRepository extends JpaRepository<TarefaOperacionalEntity, Long>, JpaSpecificationExecutor<TarefaOperacionalEntity> {

    @EntityGraph(attributePaths = "responsavel")
    @Override
    List<TarefaOperacionalEntity> findAll(Specification<TarefaOperacionalEntity> spec, Sort sort);
}
