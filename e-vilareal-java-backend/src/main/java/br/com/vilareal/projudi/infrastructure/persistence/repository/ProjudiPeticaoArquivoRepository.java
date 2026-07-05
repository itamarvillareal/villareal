package br.com.vilareal.projudi.infrastructure.persistence.repository;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjudiPeticaoArquivoRepository extends JpaRepository<ProjudiPeticaoArquivoEntity, Long> {

    List<ProjudiPeticaoArquivoEntity> findByPdfSha256AndStatus(String pdfSha256, String status);

    List<ProjudiPeticaoArquivoEntity> findByStatus(String status);

    @Query("""
            SELECT a FROM ProjudiPeticaoArquivoEntity a
            JOIN FETCH a.peticao p
            WHERE a.pdfSha256 = :pdfSha256
            """)
    List<ProjudiPeticaoArquivoEntity> findAllByPdfSha256WithPeticao(@Param("pdfSha256") String pdfSha256);

    @Query("""
            SELECT a FROM ProjudiPeticaoArquivoEntity a
            JOIN FETCH a.peticao p
            WHERE a.status = :status
            AND p.id IN :peticaoIds
            ORDER BY p.id ASC, a.ordem ASC
            """)
    List<ProjudiPeticaoArquivoEntity> findByStatusAndPeticaoIdIn(
            @Param("status") String status, @Param("peticaoIds") List<Long> peticaoIds);

    @Query("""
            SELECT a FROM ProjudiPeticaoArquivoEntity a
            JOIN FETCH a.peticao p
            WHERE a.id = :id
            """)
    Optional<ProjudiPeticaoArquivoEntity> findByIdWithPeticao(@Param("id") Long id);

    @Override
    Optional<ProjudiPeticaoArquivoEntity> findById(Long id);
}
