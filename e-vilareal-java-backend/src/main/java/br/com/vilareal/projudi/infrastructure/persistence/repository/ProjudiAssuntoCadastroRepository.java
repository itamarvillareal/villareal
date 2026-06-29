package br.com.vilareal.projudi.infrastructure.persistence.repository;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiAssuntoCadastroEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjudiAssuntoCadastroRepository extends JpaRepository<ProjudiAssuntoCadastroEntity, Integer> {

    List<ProjudiAssuntoCadastroEntity> findAllByOrderByIdAssuntoAsc();
}
