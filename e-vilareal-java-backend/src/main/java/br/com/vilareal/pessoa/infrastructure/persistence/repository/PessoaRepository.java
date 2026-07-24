package br.com.vilareal.pessoa.infrastructure.persistence.repository;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.projection.PessoaTelefoneIndiceBatchRow;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PessoaRepository extends JpaRepository<PessoaEntity, Long>, JpaSpecificationExecutor<PessoaEntity> {

    /** Pessoas atualmente marcadas para o monitoramento PROJUDI (tela de monitoramento). */
    List<PessoaEntity> findByMarcadoMonitoramentoTrueOrderByNomeAsc();

    /**
     * Pessoas por índice de telefone ({@code telefone_digitos} / {@code telefone_sufixo_8} e contatos).
     */
    @Query(
            value =
                    """
                    SELECT DISTINCT p.id FROM pessoa p
                    LEFT JOIN pessoa_contato pc ON pc.pessoa_id = p.id AND LOWER(pc.tipo) = 'telefone'
                    WHERE p.telefone_digitos IN (:digitosList)
                       OR pc.valor_digitos IN (:digitosList)
                       OR (
                         :sufixoLocal <> ''
                         AND (
                           p.telefone_sufixo_8 = :sufixoLocal
                           OR pc.valor_sufixo_8 = :sufixoLocal
                         )
                       )
                       OR (
                         :buscaParcial <> ''
                         AND (
                           p.telefone_digitos LIKE CONCAT('%', :buscaParcial, '%')
                           OR pc.valor_digitos LIKE CONCAT('%', :buscaParcial, '%')
                         )
                       )
                    ORDER BY p.id
                    """,
            nativeQuery = true)
    List<Long> findIdsByTelefoneIndice(
            @Param("digitosList") List<String> digitosList,
            @Param("sufixoLocal") String sufixoLocal,
            @Param("buscaParcial") String buscaParcial);

    /**
     * Candidatos para casamento em lote (mesmos índices de {@link #findIdsByTelefoneIndice}).
     * Retorna {@code pessoa.nome} diretamente — não exige cliente vinculado.
     * Usa {@code idx_pessoa_contato_valor_digitos}, {@code idx_pessoa_telefone_digitos} (V174).
     */
    @Query(
            value =
                    """
                    SELECT p.id AS pessoaId,
                           p.nome AS nome,
                           p.telefone_digitos AS telefoneDigitos,
                           p.telefone_sufixo_8 AS telefoneSufixo8,
                           pc.valor_digitos AS contatoDigitos,
                           pc.valor_sufixo_8 AS contatoSufixo8
                    FROM pessoa p
                    LEFT JOIN pessoa_contato pc ON pc.pessoa_id = p.id AND LOWER(pc.tipo) = 'telefone'
                    WHERE (p.ativo IS NULL OR p.ativo = TRUE)
                      AND (
                        p.telefone_digitos IN (:digitosList)
                        OR pc.valor_digitos IN (:digitosList)
                        OR p.telefone_sufixo_8 IN (:sufixosList)
                        OR pc.valor_sufixo_8 IN (:sufixosList)
                      )
                    ORDER BY p.id
                    """,
            nativeQuery = true)
    List<PessoaTelefoneIndiceBatchRow> findTelefoneIndiceBatch(
            @Param("digitosList") List<String> digitosList, @Param("sufixosList") List<String> sufixosList);

    @EntityGraph(attributePaths = "responsavel")
    @Query("SELECT p FROM PessoaEntity p WHERE p.id = :id")
    Optional<PessoaEntity> findDetailById(@Param("id") Long id);

    @Query("SELECT p.telefone FROM PessoaEntity p WHERE p.id = :id")
    Optional<String> findTelefoneById(@Param("id") Long id);

    boolean existsByCpfAndIdNot(String cpf, Long id);

    boolean existsByCpf(String cpf);

    Optional<PessoaEntity> findByCpf(String cpf);

    /**
     * Menor id ≥ 1 ainda não usado (preenche buracos: se faltar 1, devolve 1).
     * Candidatos = {1} ∪ {id+1 de cada pessoa existente}.
     */
    @Query(
            value =
                    """
                    SELECT COALESCE(MIN(c.candidato), 1)
                    FROM (
                        SELECT 1 AS candidato
                        UNION
                        SELECT p.id + 1 FROM pessoa p
                    ) c
                    WHERE NOT EXISTS (SELECT 1 FROM pessoa x WHERE x.id = c.candidato)
                    """,
            nativeQuery = true)
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
