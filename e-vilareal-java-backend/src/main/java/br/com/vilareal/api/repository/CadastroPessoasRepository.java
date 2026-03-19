package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.CadastroPessoa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CadastroPessoasRepository extends JpaRepository<CadastroPessoa, Long> {

    Optional<CadastroPessoa> findByEmail(String email);
    Optional<CadastroPessoa> findByCpf(String cpf);
    boolean existsByEmail(String email);
    boolean existsByCpf(String cpf);
    boolean existsByEmailAndIdNot(String email, Long id);
    boolean existsByCpfAndIdNot(String cpf, Long id);
    List<CadastroPessoa> findByAtivoTrue();
}
