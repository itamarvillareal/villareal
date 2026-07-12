package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoClienteConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AcertoClienteConfigRepository extends JpaRepository<AcertoClienteConfigEntity, Long> {

    Optional<AcertoClienteConfigEntity> findByCliente_Id(Long clienteId);
}
