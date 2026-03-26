package br.com.vilareal.usuario.infrastructure.persistence.repository;

import br.com.vilareal.usuario.infrastructure.persistence.entity.PerfilEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PerfilRepository extends JpaRepository<PerfilEntity, Long> {
}
