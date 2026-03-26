package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoPrazoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessoPrazoRepository extends JpaRepository<ProcessoPrazoEntity, Long> {

    List<ProcessoPrazoEntity> findByProcesso_IdOrderByIdAsc(Long processoId);
}
