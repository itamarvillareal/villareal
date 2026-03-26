package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PessoaContatoRepository extends JpaRepository<PessoaContatoEntity, Long> {

    void deleteByPessoa_Id(Long pessoaId);

    List<PessoaContatoEntity> findByPessoa_IdOrderByIdAsc(Long pessoaId);
}
