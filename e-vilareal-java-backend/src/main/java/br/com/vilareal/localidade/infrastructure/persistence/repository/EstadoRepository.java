package br.com.vilareal.localidade.infrastructure.persistence.repository;

import br.com.vilareal.localidade.infrastructure.persistence.entity.EstadoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EstadoRepository extends JpaRepository<EstadoEntity, Integer> {

    List<EstadoEntity> findAllByOrderByNomeAsc();

    Optional<EstadoEntity> findBySiglaIgnoreCase(String sigla);
}
