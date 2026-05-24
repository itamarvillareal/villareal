package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PessoaContatoRepository extends JpaRepository<PessoaContatoEntity, Long> {

    void deleteByPessoa_Id(Long pessoaId);

    List<PessoaContatoEntity> findByPessoa_IdOrderByIdAsc(Long pessoaId);

    /**
     * Busca pessoa por telefone normalizado (somente dígitos). Formatos em {@code pessoa_contato.valor} variam
     * (máscara, com/sem DDI) — compara número completo e sufixos de 10/11 dígitos.
     */
    @Query(
            value =
                    """
                    SELECT pc.pessoa_id FROM pessoa_contato pc
                    WHERE LOWER(pc.tipo) = 'telefone'
                      AND (
                        REGEXP_REPLACE(pc.valor, '[^0-9]', '') = :digits
                        OR RIGHT(REGEXP_REPLACE(pc.valor, '[^0-9]', ''), 11) = RIGHT(:digits, 11)
                        OR RIGHT(REGEXP_REPLACE(pc.valor, '[^0-9]', ''), 10) = RIGHT(:digits, 10)
                      )
                    LIMIT 1
                    """,
            nativeQuery = true)
    Optional<Long> findPessoaIdByTelefoneNormalizado(@Param("digits") String digits);

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);
}
