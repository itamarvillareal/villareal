package br.com.vilareal.monitoramento.infrastructure.persistence.repository;

import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProcessoDescobertoRepository extends JpaRepository<ProcessoDescobertoEntity, Long> {

    Optional<ProcessoDescobertoEntity> findByPessoaIdAndNumeroReduzidoAndAnoDistribuicao(
            Long pessoaId, String numeroReduzido, Integer anoDistribuicao);

    List<ProcessoDescobertoEntity> findBySituacaoOrderByPrimeiroVistoEmDesc(SituacaoProcessoDescoberto situacao);

    List<ProcessoDescobertoEntity> findByIdProcessoSufixo(String idProcessoSufixo);

    /**
     * Caixa de entrada da tela de monitoramento: descobertos numa situação, de TODAS as
     * pessoas atualmente marcadas para monitoramento, mais recentes (por DISTRIBUIÇÃO) primeiro.
     */
    @Query(
            """
            SELECT d FROM ProcessoDescobertoEntity d JOIN FETCH d.pessoa p
            WHERE d.situacao = :situacao AND p.marcadoMonitoramento = TRUE
            ORDER BY d.dataDistribuicao DESC, d.id DESC
            """)
    List<ProcessoDescobertoEntity> findCaixaDeEntrada(@Param("situacao") SituacaoProcessoDescoberto situacao);

    @Query(
            """
            SELECT d FROM ProcessoDescobertoEntity d JOIN FETCH d.pessoa
            WHERE d.pessoa.id = :pessoaId
            ORDER BY d.dataDistribuicao DESC, d.id DESC
            """)
    List<ProcessoDescobertoEntity> findDaPessoaOrdenadoPorDistribuicao(@Param("pessoaId") Long pessoaId);

    /** Carrega com a pessoa inicializada — para uso fora de transação (ações de triagem). */
    @Query("SELECT d FROM ProcessoDescobertoEntity d JOIN FETCH d.pessoa WHERE d.id = :id")
    Optional<ProcessoDescobertoEntity> findByIdComPessoa(@Param("id") Long id);

    /** Agregados por pessoa para a listagem de pessoas monitoradas: [pessoaId, situacao, count]. */
    @Query("SELECT d.pessoa.id, d.situacao, COUNT(d) FROM ProcessoDescobertoEntity d GROUP BY d.pessoa.id, d.situacao")
    List<Object[]> contarPorPessoaESituacao();
}
