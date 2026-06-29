package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.AniversarioWhatsAppEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface AniversarioWhatsAppRepository extends JpaRepository<AniversarioWhatsAppEntity, Long> {

    boolean existsByPessoaIdAndAnoEnvio(Long pessoaId, int anoEnvio);

    Optional<AniversarioWhatsAppEntity> findByPessoaIdAndAnoEnvio(Long pessoaId, int anoEnvio);

    Optional<AniversarioWhatsAppEntity> findByWaMessageId(String waMessageId);

    Page<AniversarioWhatsAppEntity> findByAnoEnvioOrderByCreatedAtDesc(int anoEnvio, Pageable pageable);

    Page<AniversarioWhatsAppEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByAnoEnvioAndStatus(int anoEnvio, String status);

    @Query(
            """
            SELECT COUNT(a) FROM AniversarioWhatsAppEntity a
            WHERE a.anoEnvio = :anoEnvio AND a.status <> 'FAILED'
            """)
    long countEnviadosComSucessoByAnoEnvio(@Param("anoEnvio") int anoEnvio);

    @Query(
            """
            SELECT COUNT(a) FROM AniversarioWhatsAppEntity a
            WHERE a.createdAt >= :inicio AND a.createdAt < :fim AND a.status <> 'FAILED'
            """)
    long countEnviadosEntre(@Param("inicio") Instant inicio, @Param("fim") Instant fim);
}
