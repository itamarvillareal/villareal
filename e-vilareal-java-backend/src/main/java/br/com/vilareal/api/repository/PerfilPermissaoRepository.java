package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.PerfilPermissao;
import br.com.vilareal.api.entity.PerfilPermissaoId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PerfilPermissaoRepository extends JpaRepository<PerfilPermissao, PerfilPermissaoId> {
    List<PerfilPermissao> findByPerfil_Id(Long perfilId);
    void deleteByPerfil_Id(Long perfilId);
}
