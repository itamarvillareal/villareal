package br.com.vilareal.notificacao.infrastructure.persistence.repository;

import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificacaoDestinatarioRepository extends JpaRepository<NotificacaoDestinatarioEntity, Long> {

    List<NotificacaoDestinatarioEntity> findByProcessoIdIsNullAndAtivoTrue();

    List<NotificacaoDestinatarioEntity> findByProcessoIdAndAtivoTrue(Long processoId);

    List<NotificacaoDestinatarioEntity> findByProcessoIdOrderByCanalAscIdAsc(Long processoId);

    boolean existsByProcessoId(Long processoId);

    void deleteByProcessoId(Long processoId);

    void deleteByProcessoIdIsNull();
}
