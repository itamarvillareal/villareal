package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.ParametroEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ParametroRepository extends JpaRepository<ParametroEntity, Long> {
    Optional<ParametroEntity> findTopByVigenteAteIsNullOrderByVersaoDesc();
}
