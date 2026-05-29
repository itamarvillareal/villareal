package br.com.vilareal.demanda.infrastructure.persistence.repository;

import br.com.vilareal.demanda.infrastructure.persistence.entity.DemandaHistoricoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DemandaHistoricoRepository extends JpaRepository<DemandaHistoricoEntity, Long> {

    List<DemandaHistoricoEntity> findByDemandaIdOrderByCreatedAtDesc(Long demandaId);
}
