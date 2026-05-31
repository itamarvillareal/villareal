package br.com.vilareal.projudi.infrastructure.persistence.repository;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiCredencialEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProjudiCredencialRepository extends JpaRepository<ProjudiCredencialEntity, Long> {

    Optional<ProjudiCredencialEntity> findByCpfUsuario(String cpfUsuario);

    boolean existsByCpfUsuario(String cpfUsuario);
}
