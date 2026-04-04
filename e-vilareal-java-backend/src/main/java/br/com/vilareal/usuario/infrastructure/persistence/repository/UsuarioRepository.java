package br.com.vilareal.usuario.infrastructure.persistence.repository;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long>, JpaSpecificationExecutor<UsuarioEntity> {

    @EntityGraph(attributePaths = {"perfis", "pessoa"})
    @Query("SELECT DISTINCT u FROM UsuarioEntity u")
    List<UsuarioEntity> findAllForListing();

    @EntityGraph(attributePaths = {"pessoa"})
    @Override
    Page<UsuarioEntity> findAll(Specification<UsuarioEntity> spec, Pageable pageable);

    boolean existsByLoginIgnoreCase(String login);

    boolean existsByLoginIgnoreCaseAndIdNot(String login, Long id);

    boolean existsByPessoa_Id(Long pessoaId);

    boolean existsByPessoa_IdAndIdNot(Long pessoaId, Long id);

    @EntityGraph(attributePaths = {"perfis", "pessoa"})
    Optional<UsuarioEntity> findWithPerfisByLoginIgnoreCase(String login);

    @EntityGraph(attributePaths = {"perfis", "pessoa"})
    Optional<UsuarioEntity> findWithPerfisById(Long id);
}
