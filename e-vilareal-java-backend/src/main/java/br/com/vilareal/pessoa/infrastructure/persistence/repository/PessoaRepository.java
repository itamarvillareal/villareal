package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PessoaRepository extends JpaRepository<PessoaEntity, Long>, JpaSpecificationExecutor<PessoaEntity> {

    /**
     * Pessoas cujo telefone legado ({@code pessoa.telefone}) ou contato tipo telefone contém os dígitos informados.
     */
    @Query(
            value =
                    """
                    SELECT DISTINCT p.id FROM pessoa p
                    LEFT JOIN pessoa_contato pc ON pc.pessoa_id = p.id AND LOWER(pc.tipo) = 'telefone'
                    WHERE REGEXP_REPLACE(IFNULL(p.telefone, ''), '[^0-9]', '') LIKE CONCAT('%', :digits, '%')
                       OR REGEXP_REPLACE(IFNULL(pc.valor, ''), '[^0-9]', '') LIKE CONCAT('%', :digits, '%')
                    ORDER BY p.id
                    """,
            nativeQuery = true)
    List<Long> findIdsByTelefoneDigitosContendo(@Param("digits") String digits);

    @EntityGraph(attributePaths = "responsavel")
    @Query("SELECT p FROM PessoaEntity p WHERE p.id = :id")
    Optional<PessoaEntity> findDetailById(@Param("id") Long id);

    @Query("SELECT p.telefone FROM PessoaEntity p WHERE p.id = :id")
    Optional<String> findTelefoneById(@Param("id") Long id);

    boolean existsByCpfAndIdNot(String cpf, Long id);

    boolean existsByCpf(String cpf);

    Optional<PessoaEntity> findByCpf(String cpf);

    @Query("SELECT COALESCE(MAX(p.id), 0) + 1 FROM PessoaEntity p")
    long calcularProximoId();

    long countByImportacaoId(String importacaoId);

    long deleteByImportacaoId(String importacaoId);

    @Query(
            """
            SELECT p FROM PessoaEntity p
            WHERE p.dataNascimento IS NOT NULL
              AND p.ativo = TRUE
              AND DAY(p.dataNascimento) = :dia
              AND MONTH(p.dataNascimento) = :mes
            """)
    java.util.List<PessoaEntity> findAniversariantes(@Param("dia") int dia, @Param("mes") int mes);
}
