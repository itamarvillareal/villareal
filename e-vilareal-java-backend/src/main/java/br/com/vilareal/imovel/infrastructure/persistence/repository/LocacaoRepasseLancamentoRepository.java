package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LocacaoRepasseLancamentoRepository extends JpaRepository<LocacaoRepasseLancamentoEntity, Long> {

    @EntityGraph(attributePaths = {"lancamentoFinanceiro"})
    List<LocacaoRepasseLancamentoEntity> findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(Long contratoLocacaoId);

    @EntityGraph(attributePaths = {"lancamentoFinanceiro"})
    List<LocacaoRepasseLancamentoEntity> findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(
            Long contratoLocacaoId, String competenciaMes);

    List<LocacaoRepasseLancamentoEntity> findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(
            Long contratoLocacaoId, List<Long> lancamentoFinanceiroIds);

    Optional<LocacaoRepasseLancamentoEntity> findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
            Long contratoLocacaoId, Long lancamentoFinanceiroId, PapelReconciliacao papel);

    /** Vínculo REPASSE (débito interno) ligado por FK real ao vínculo de ALUGUEL de origem (V115). */
    @EntityGraph(attributePaths = {"lancamentoFinanceiro"})
    Optional<LocacaoRepasseLancamentoEntity> findByOrigemAluguelVinculo_IdAndPapel(
            Long origemAluguelVinculoId, PapelReconciliacao papel);

    /** Todos os vínculos para montar a carteira de repasses pendentes (leitura derivada). */
    @EntityGraph(
            attributePaths = {
                "contratoLocacao",
                "contratoLocacao.imovel",
                "contratoLocacao.locadorPessoa",
                "lancamentoFinanceiro"
            })
    @Query(
            """
            SELECT v FROM LocacaoRepasseLancamentoEntity v
            ORDER BY v.contratoLocacao.id ASC, v.competenciaMes ASC, v.id ASC
            """)
    List<LocacaoRepasseLancamentoEntity> findAllParaCarteiraRepasses();

    List<LocacaoRepasseLancamentoEntity> findByLancamentoFinanceiro_IdIn(Collection<Long> lancamentoFinanceiroIds);

    @Query(
            """
            SELECT DISTINCT v.lancamentoFinanceiro.id FROM LocacaoRepasseLancamentoEntity v
            WHERE v.contratoLocacao.imovel.numeroPlanilha = :numeroPlanilha
            """)
    List<Long> findLancamentoFinanceiroIdsByImovelNumeroPlanilha(
            @org.springframework.data.repository.query.Param("numeroPlanilha") Integer numeroPlanilha);

    boolean existsByLancamentoFinanceiro_IdAndPapel(Long lancamentoFinanceiroId, PapelReconciliacao papel);

    @EntityGraph(attributePaths = {"lancamentoFinanceiro", "contratoLocacao", "contratoLocacao.imovel"})
    @Query(
            """
            SELECT v FROM LocacaoRepasseLancamentoEntity v
            WHERE v.papel = 'DESPESA'
            """)
    List<LocacaoRepasseLancamentoEntity> findHistoricoDespesa();
}
