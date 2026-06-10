package br.com.vilareal.projudi.infrastructure.persistence.repository;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiCredencialEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

import java.util.List;

public interface ProjudiCredencialRepository extends JpaRepository<ProjudiCredencialEntity, Long> {

    List<ProjudiCredencialEntity> findByAtivoTrueOrderByIdAsc();

    Optional<ProjudiCredencialEntity> findByCpfUsuario(String cpfUsuario);

    boolean existsByCpfUsuario(String cpfUsuario);
}
