package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.CaixaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaixaRepository extends JpaRepository<CaixaEntity, Long> {
    List<CaixaEntity> findByAtivoTrue();
}
