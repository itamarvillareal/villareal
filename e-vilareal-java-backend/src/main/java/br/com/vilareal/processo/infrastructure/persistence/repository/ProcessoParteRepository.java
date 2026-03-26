package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessoParteRepository extends JpaRepository<ProcessoParteEntity, Long> {

    List<ProcessoParteEntity> findByProcesso_IdOrderByOrdemAscIdAsc(Long processoId);
}
