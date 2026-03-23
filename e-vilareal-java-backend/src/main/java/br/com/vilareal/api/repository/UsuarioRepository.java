package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.Usuario;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    boolean existsByLogin(String login);
    boolean existsByLoginAndIdNot(String login, Long id);

    @EntityGraph(attributePaths = {"pessoa"})
    @Override
    List<Usuario> findAll();

    @EntityGraph(attributePaths = {"pessoa"})
    @Override
    Optional<Usuario> findById(Long id);
}
