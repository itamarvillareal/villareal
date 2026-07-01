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
                        pc.valor_digitos = :digits
                        OR (:sufixo8 <> '' AND pc.valor_sufixo_8 = :sufixo8)
                        OR RIGHT(IFNULL(pc.valor_digitos, ''), 11) = RIGHT(:digits, 11)
                        OR RIGHT(IFNULL(pc.valor_digitos, ''), 10) = RIGHT(:digits, 10)
                      )
                    LIMIT 1
                    """,
            nativeQuery = true)
    Optional<Long> findPessoaIdByTelefoneIndice(@Param("digits") String digits, @Param("sufixo8") String sufixo8);

    default Optional<Long> findPessoaIdByTelefoneNormalizado(String digitsRaw) {
        if (digitsRaw == null || digitsRaw.isBlank()) {
            return Optional.empty();
        }
        String digits = digitsRaw.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return Optional.empty();
        }
        String sufixo8 = digits.length() >= 8 ? digits.substring(digits.length() - 8) : "";
        return findPessoaIdByTelefoneIndice(digits, sufixo8);
    }

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);
}
