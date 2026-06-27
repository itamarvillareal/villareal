package br.com.vilareal.configuracao.infrastructure.persistence.repository;

import br.com.vilareal.configuracao.infrastructure.persistence.entity.SistemaConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SistemaConfigRepository extends JpaRepository<SistemaConfigEntity, String> {}
