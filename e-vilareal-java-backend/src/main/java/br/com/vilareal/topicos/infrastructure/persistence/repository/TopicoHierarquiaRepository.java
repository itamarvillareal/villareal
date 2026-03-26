package br.com.vilareal.topicos.infrastructure.persistence.repository;

import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoHierarquiaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TopicoHierarquiaRepository extends JpaRepository<TopicoHierarquiaEntity, Integer> {
}
