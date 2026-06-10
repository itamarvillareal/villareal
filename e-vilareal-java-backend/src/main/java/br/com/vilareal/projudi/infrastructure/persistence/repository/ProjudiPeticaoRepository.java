package br.com.vilareal.projudi.infrastructure.persistence.repository;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ProjudiPeticaoRepository extends JpaRepository<ProjudiPeticaoEntity, Long> {

    List<ProjudiPeticaoEntity> findByStatus(String status);

    @Query("""
            SELECT DISTINCT p FROM ProjudiPeticaoEntity p
            LEFT JOIN FETCH p.arquivos
            ORDER BY p.criadoEm DESC
            """)
    List<ProjudiPeticaoEntity> findAllWithArquivos();

    @Query("""
            SELECT DISTINCT p FROM ProjudiPeticaoEntity p
            LEFT JOIN FETCH p.arquivos
            WHERE p.status = :status
            ORDER BY p.criadoEm DESC
            """)
    List<ProjudiPeticaoEntity> findByStatusWithArquivos(@Param("status") String status);

    @Query("SELECT p FROM ProjudiPeticaoEntity p LEFT JOIN FETCH p.arquivos WHERE p.id = :id")
    Optional<ProjudiPeticaoEntity> findByIdWithArquivos(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.status = 'PROTOCOLANDO'
            WHERE p.id = :id AND p.status = 'ASSINADA'
            """)
    int claimParaProtocolo(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ProjudiPeticaoEntity p
            SET p.status = :status,
                p.protocoloMensagem = :mensagem,
                p.protocoladoEm = :protocoladoEm
            WHERE p.id = :id
            """)
    void finalizarProtocolo(
            @Param("id") Long id,
            @Param("status") String status,
            @Param("mensagem") String mensagem,
            @Param("protocoladoEm") Instant protocoladoEm);

    @Override
    Optional<ProjudiPeticaoEntity> findById(Long id);
}
