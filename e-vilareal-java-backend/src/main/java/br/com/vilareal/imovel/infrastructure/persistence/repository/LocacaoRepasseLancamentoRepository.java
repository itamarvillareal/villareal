package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
