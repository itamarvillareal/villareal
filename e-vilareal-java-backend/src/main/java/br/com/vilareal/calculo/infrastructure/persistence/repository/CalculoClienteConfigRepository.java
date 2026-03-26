package br.com.vilareal.calculo.infrastructure.persistence.repository;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoClienteConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalculoClienteConfigRepository extends JpaRepository<CalculoClienteConfigEntity, String> {}
