package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.AtivoRvEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AtivoRvRepository extends JpaRepository<AtivoRvEntity, Long> {
    List<AtivoRvEntity> findByAtivoTrue();
}
