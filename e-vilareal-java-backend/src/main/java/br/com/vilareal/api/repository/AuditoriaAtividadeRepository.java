package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.AuditoriaAtividade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditoriaAtividadeRepository extends JpaRepository<AuditoriaAtividade, Long>,
        JpaSpecificationExecutor<AuditoriaAtividade> {
}
