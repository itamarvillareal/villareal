package br.com.vilareal.configuracao.infrastructure.persistence.repository;

import br.com.vilareal.configuracao.infrastructure.persistence.entity.UsuarioMenuItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UsuarioMenuItemRepository extends JpaRepository<UsuarioMenuItemEntity, UsuarioMenuItemEntity.Pk> {

    List<UsuarioMenuItemEntity> findByUsuarioIdOrderByOrdemAscModuloIdAsc(Long usuarioId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM UsuarioMenuItemEntity e WHERE e.usuarioId = :usuarioId")
    void deleteByUsuarioId(@Param("usuarioId") Long usuarioId);
}
