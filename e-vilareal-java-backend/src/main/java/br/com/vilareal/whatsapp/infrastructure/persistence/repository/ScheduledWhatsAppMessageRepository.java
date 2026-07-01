package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.ScheduledWhatsAppMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface ScheduledWhatsAppMessageRepository extends JpaRepository<ScheduledWhatsAppMessageEntity, Long> {

    List<ScheduledWhatsAppMessageEntity> findByStatusAndScheduledAtBeforeOrderByScheduledAtAsc(
            ScheduledMessageStatus status, Instant now);

    List<ScheduledWhatsAppMessageEntity> findByClienteIdAndStatusOrderByScheduledAtAsc(
            Long clienteId, ScheduledMessageStatus status);

    Page<ScheduledWhatsAppMessageEntity> findByStatusOrderByScheduledAtAsc(
            ScheduledMessageStatus status, Pageable pageable);

    Page<ScheduledWhatsAppMessageEntity> findAllByOrderByScheduledAtDesc(Pageable pageable);

    List<ScheduledWhatsAppMessageEntity> findByProcessoIdAndStatusAndTemplateName(
            Long processoId, ScheduledMessageStatus status, String templateName);

    boolean existsByPagamentoIdAndTemplateNameAndStatusIn(
            Long pagamentoId, String templateName, Collection<ScheduledMessageStatus> statuses);

    long countByStatus(ScheduledMessageStatus status);
}
