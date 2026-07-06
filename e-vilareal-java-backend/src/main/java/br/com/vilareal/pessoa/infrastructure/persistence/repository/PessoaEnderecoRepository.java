package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PessoaEnderecoRepository extends JpaRepository<PessoaEnderecoEntity, Long> {

    void deleteByPessoa_Id(Long pessoaId);

    @Query("""
            SELECT e FROM PessoaEnderecoEntity e
            LEFT JOIN FETCH e.municipio m
            LEFT JOIN FETCH m.estado
            WHERE e.pessoa.id = :pessoaId
            ORDER BY e.numeroOrdem ASC
            """)
    List<PessoaEnderecoEntity> findByPessoa_IdOrderByNumeroOrdemAsc(@Param("pessoaId") Long pessoaId);

    @Query("SELECT COALESCE(MAX(e.numeroOrdem), 0) FROM PessoaEnderecoEntity e WHERE e.pessoa.id = :pessoaId")
    int findMaxNumeroOrdemByPessoaId(@Param("pessoaId") Long pessoaId);

    @Query("SELECT e FROM PessoaEnderecoEntity e JOIN FETCH e.pessoa WHERE e.id = :id")
    java.util.Optional<PessoaEnderecoEntity> findByIdWithPessoa(@Param("id") Long id);

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);
}
