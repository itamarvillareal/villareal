package br.com.vilareal.monitoramento.infrastructure.persistence.repository;

import br.com.vilareal.monitoramento.infrastructure.persistence.entity.VarreduraPessoaEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface VarreduraPessoaRepository extends JpaRepository<VarreduraPessoaEntity, Long> {

    Optional<VarreduraPessoaEntity> findFirstByPessoaIdOrderByInicioDesc(Long pessoaId);

    /** Histórico para a tela: JOIN FETCH da pessoa evita N+1 na montagem do DTO. */
    @Query("SELECT v FROM VarreduraPessoaEntity v JOIN FETCH v.pessoa ORDER BY v.inicio DESC, v.id DESC")
    List<VarreduraPessoaEntity> findHistorico(Pageable pageable);

    @Query(
            """
            SELECT v FROM VarreduraPessoaEntity v JOIN FETCH v.pessoa
            WHERE v.pessoa.id = :pessoaId
            ORDER BY v.inicio DESC, v.id DESC
            """)
    List<VarreduraPessoaEntity> findHistoricoDaPessoa(Long pessoaId, Pageable pageable);

    /**
     * Pessoas elegíveis à varredura (marcadas para monitoramento, ativas, com documento),
     * priorizando quem tem a última varredura mais antiga — quem NUNCA foi varrido vem
     * primeiro (NULLS FIRST). Usado pelo scheduler com página de tamanho 1 (uma por tick).
     */
    @Query(
            """
            SELECT p.id FROM PessoaEntity p
            WHERE p.marcadoMonitoramento = TRUE
              AND p.ativo = TRUE
              AND p.cpf IS NOT NULL AND TRIM(p.cpf) <> ''
            ORDER BY (SELECT MAX(v.inicio) FROM VarreduraPessoaEntity v WHERE v.pessoa.id = p.id)
                ASC NULLS FIRST,
                p.id ASC
            """)
    List<Long> findPessoaIdsPorPrioridadeDeVarredura(Pageable pageable);
}
