package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.CadastroPessoa;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CadastroPessoasRepository extends JpaRepository<CadastroPessoa, Long> {

    @EntityGraph(attributePaths = {"responsavel"})
    @Override
    Optional<CadastroPessoa> findById(Long id);

    @EntityGraph(attributePaths = {"responsavel"})
    @Override
    List<CadastroPessoa> findAll();

    @EntityGraph(attributePaths = {"responsavel"})
    List<CadastroPessoa> findByAtivoTrue();

    Optional<CadastroPessoa> findByEmail(String email);
    Optional<CadastroPessoa> findByCpf(String cpf);
    boolean existsByEmail(String email);
    boolean existsByCpf(String cpf);
    boolean existsByEmailAndIdNot(String email, Long id);
    boolean existsByCpfAndIdNot(String cpf, Long id);
}
