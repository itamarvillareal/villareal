package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.Cliente;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    boolean existsByCodigoCliente(String codigoCliente);
    boolean existsByCodigoClienteAndIdNot(String codigoCliente, Long id);

    @EntityGraph(attributePaths = {"pessoa"})
    @Override
    List<Cliente> findAll();

    @EntityGraph(attributePaths = {"pessoa"})
    @Override
    Optional<Cliente> findById(Long id);

    @EntityGraph(attributePaths = {"pessoa"})
    Optional<Cliente> findByCodigoCliente(String codigoCliente);
}
