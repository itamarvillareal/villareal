package br.com.vilareal.mensalista.infrastructure.persistence.repository;

import br.com.vilareal.mensalista.infrastructure.persistence.entity.MensalistaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MensalistaRepository extends JpaRepository<MensalistaEntity, Long> {

    @Query(
            """
            SELECT m FROM MensalistaEntity m
            JOIN FETCH m.cliente c
            JOIN FETCH c.pessoa
            WHERE m.cliente.id = :clienteId
            """)
    Optional<MensalistaEntity> findByCliente_IdWithDetalhes(@Param("clienteId") Long clienteId);

    @Query(
            """
            SELECT m FROM MensalistaEntity m
            JOIN FETCH m.cliente c
            JOIN FETCH c.pessoa
            WHERE m.ativo = true
            ORDER BY m.id ASC
            """)
    List<MensalistaEntity> findAtivosComCliente();
}
