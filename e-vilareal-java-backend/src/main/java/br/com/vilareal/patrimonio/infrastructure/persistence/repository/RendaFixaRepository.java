package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.RendaFixaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RendaFixaRepository extends JpaRepository<RendaFixaEntity, Long> {
    List<RendaFixaEntity> findByAtivoTrue();
}
