package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaDocumentoDriveEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PessoaDocumentoDriveRepository extends JpaRepository<PessoaDocumentoDriveEntity, Long> {

    List<PessoaDocumentoDriveEntity> findByPessoaIdOrderByCreatedAtDescIdDesc(Long pessoaId);

    List<PessoaDocumentoDriveEntity> findByPessoaIdAndTipoOrderByCreatedAtDescIdDesc(Long pessoaId, String tipo);

    List<PessoaDocumentoDriveEntity> findByPessoaIdAndP7sDriveFileIdIsNotNullOrderByCreatedAtDescIdDesc(
            Long pessoaId);

    boolean existsByP7sDriveFileId(String p7sDriveFileId);
}
