package br.com.vilareal.notificacao.infrastructure.persistence.repository;

import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface NotificacaoDestinatarioRepository extends JpaRepository<NotificacaoDestinatarioEntity, Long> {

    List<NotificacaoDestinatarioEntity> findByProcessoIdIsNullAndAtivoTrue();

    List<NotificacaoDestinatarioEntity> findByProcessoIdAndAtivoTrue(Long processoId);

    List<NotificacaoDestinatarioEntity> findByProcessoIdOrderByCanalAscIdAsc(Long processoId);

    @Query("""
            SELECT d FROM NotificacaoDestinatarioEntity d
            JOIN FETCH d.processo p
            WHERE p.id IN :processoIds
            ORDER BY p.id ASC, d.canal ASC, d.id ASC
            """)
    List<NotificacaoDestinatarioEntity> findByProcessoIdIn(@Param("processoIds") Collection<Long> processoIds);

    boolean existsByProcessoId(Long processoId);

    void deleteByProcessoId(Long processoId);

    void deleteByProcessoIdIsNull();

    boolean existsByProcesso_IdAndCanalAndValor(Long processoId, CanalNotificacao canal, String valor);
}
