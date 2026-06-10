package br.com.vilareal.projudi.infrastructure.persistence.repository;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjudiPeticaoArquivoRepository extends JpaRepository<ProjudiPeticaoArquivoEntity, Long> {

    List<ProjudiPeticaoArquivoEntity> findByPdfSha256AndStatus(String pdfSha256, String status);

    List<ProjudiPeticaoArquivoEntity> findByStatus(String status);

    @Override
    Optional<ProjudiPeticaoArquivoEntity> findById(Long id);
}
