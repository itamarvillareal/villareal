package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.UsuarioPerfil;
import br.com.vilareal.api.entity.UsuarioPerfilId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UsuarioPerfilRepository extends JpaRepository<UsuarioPerfil, UsuarioPerfilId> {
    List<UsuarioPerfil> findByUsuario_Id(Long usuarioId);
    void deleteByUsuario_Id(Long usuarioId);
}
