package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.AluguelFollowupEventoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface AluguelFollowupEventoRepository extends JpaRepository<AluguelFollowupEventoEntity, Long> {

    List<AluguelFollowupEventoEntity> findByContratoIdInOrderByCreatedAtAsc(Collection<Long> contratoIds);
}
