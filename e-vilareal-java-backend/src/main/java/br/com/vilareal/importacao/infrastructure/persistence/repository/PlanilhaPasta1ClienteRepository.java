package br.com.vilareal.importacao.infrastructure.persistence.repository;

import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlanilhaPasta1ClienteRepository extends JpaRepository<PlanilhaPasta1ClienteEntity, String> {

    List<PlanilhaPasta1ClienteEntity> findByPessoaIdOrderByChaveClienteAsc(Long pessoaId);
}
