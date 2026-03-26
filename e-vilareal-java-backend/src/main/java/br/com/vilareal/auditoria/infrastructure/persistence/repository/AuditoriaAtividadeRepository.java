package br.com.vilareal.auditoria.infrastructure.persistence.repository;

import br.com.vilareal.auditoria.infrastructure.persistence.entity.AuditoriaAtividadeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditoriaAtividadeRepository
        extends JpaRepository<AuditoriaAtividadeEntity, Long>, JpaSpecificationExecutor<AuditoriaAtividadeEntity> {}
