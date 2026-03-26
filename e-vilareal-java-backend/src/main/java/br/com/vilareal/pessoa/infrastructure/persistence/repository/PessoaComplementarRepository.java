package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaComplementarEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PessoaComplementarRepository extends JpaRepository<PessoaComplementarEntity, Long> {
}
