package br.com.vilareal.email.infrastructure.persistence.repository;

import br.com.vilareal.email.infrastructure.persistence.entity.EmailImportacaoSyncEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailImportacaoSyncRepository extends JpaRepository<EmailImportacaoSyncEntity, String> {}
