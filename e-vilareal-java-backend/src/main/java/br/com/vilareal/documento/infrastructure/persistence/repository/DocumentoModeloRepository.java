package br.com.vilareal.documento.infrastructure.persistence.repository;

import br.com.vilareal.documento.infrastructure.persistence.entity.DocumentoModeloEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentoModeloRepository extends JpaRepository<DocumentoModeloEntity, Long> {

    @EntityGraph(attributePaths = "usuarioResponsavel")
    List<DocumentoModeloEntity> findAllByOrderByLabelAsc();

    @EntityGraph(attributePaths = "usuarioResponsavel")
    Optional<DocumentoModeloEntity> findByIdAndAtivoTrue(Long id);

    @EntityGraph(attributePaths = "usuarioResponsavel")
    Optional<DocumentoModeloEntity> findByUsuarioResponsavelIdAndAtivoTrue(Long usuarioResponsavelId);

    boolean existsByUsuarioResponsavelId(Long usuarioResponsavelId);

    @EntityGraph(attributePaths = "usuarioResponsavel")
    Optional<DocumentoModeloEntity> findWithUsuarioById(Long id);
}
