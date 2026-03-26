package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PessoaRepository extends JpaRepository<PessoaEntity, Long>, JpaSpecificationExecutor<PessoaEntity> {

    @EntityGraph(attributePaths = "responsavel")
    @Query("SELECT p FROM PessoaEntity p WHERE p.id = :id")
    Optional<PessoaEntity> findDetailById(@Param("id") Long id);

    boolean existsByCpfAndIdNot(String cpf, Long id);

    boolean existsByCpf(String cpf);

    Optional<PessoaEntity> findByCpf(String cpf);

    boolean existsByEmailAndIdNot(String email, Long id);

    boolean existsByEmail(String email);

    @Query("SELECT COALESCE(MAX(p.id), 0) + 1 FROM PessoaEntity p")
    long calcularProximoId();
}
