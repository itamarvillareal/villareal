package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.ContaContabil;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContaContabilRepository extends JpaRepository<ContaContabil, Long> {
    Optional<ContaContabil> findByCodigo(String codigo);
    Optional<ContaContabil> findByNome(String nome);
    List<ContaContabil> findAllByOrderByOrdemExibicaoAscNomeAsc();
    boolean existsByCodigoAndIdNot(String codigo, Long id);
    boolean existsByNomeAndIdNot(String nome, Long id);
}
