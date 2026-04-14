package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PessoaEnderecoRepository extends JpaRepository<PessoaEnderecoEntity, Long> {

    void deleteByPessoa_Id(Long pessoaId);

    List<PessoaEnderecoEntity> findByPessoa_IdOrderByNumeroOrdemAsc(Long pessoaId);

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);
}
