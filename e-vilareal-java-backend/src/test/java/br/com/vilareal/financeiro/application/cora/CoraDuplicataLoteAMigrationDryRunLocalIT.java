package br.com.vilareal.financeiro.application.cora;

import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dry-run transacional contra o MySQL local ({@code vilareal-db}, profile dev).
 * Ativar: {@code -Dcora.migration.dryrun=true -Dtest=CoraDuplicataLoteAMigrationDryRunLocalIT}
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "cora.migration.dryrun", matches = "true")
class CoraDuplicataLoteAMigrationDryRunLocalIT {

    @Autowired
    private CoraDuplicataParDiscoveryService discoveryService;

    @Autowired
    private CoraDuplicataLoteAMigrationService migrationService;

    @Autowired
    private LancamentoFinanceiroRepository lancamentoRepository;

    @Autowired
    private LocacaoRepasseLancamentoRepository vinculoRepository;

    @Test
    void dryRunMigracaoLoteA_comRollback() {
        long aposentadosAntes =
                lancamentoRepository.countByNumeroBancoAndStatus(26, StatusLancamento.APOSENTADO);
        BigDecimal saldoAntes = lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(26);
        long ativosAntes = lancamentoRepository.countByNumeroBanco(26);

        var mapa = discoveryService.descobrirLoteA();
        assertThat(mapa).isNotEmpty();

        CoraDuplicataLoteARelatorio rel = migrationService.migrarDuplicatasLoteA(true);

        System.out.println("=== MAPA LOTE A ===");
        System.out.println("Pares: " + mapa.size());
        mapa.stream().limit(10).forEach(p -> System.out.println("  PL#" + p.planilhaId() + " -> OFX#" + p.ofxId()));

        System.out.println("=== DRY-RUN RELATÓRIO ===");
        System.out.println("Abortado: " + rel.isAbortado() + " " + rel.getMotivoAbort());
        System.out.println("Vínculos repasse: " + rel.getVinculosRepasseMigrados());
        System.out.println("Pagamentos: " + rel.getPagamentosMigrados());
        System.out.println("Classificações: " + rel.getClassificacoesCopiadas());
        System.out.println("Grupos compensação: " + rel.getGruposCompensacaoTocados());
        System.out.println("Descartes semelhante: " + rel.getDescartesSemelhanteRecriados());
        System.out.println("Descartes compensação: " + rel.getDescartesCompensacaoRecriados());
        System.out.println("PL aposentados (na tx): " + rel.getPlanilhasAposentadas());
        System.out.println("CONCILIAR jun 2 cand (antes): " + rel.getConciliarJunAntesDoisCandidatos());
        System.out.println("CONCILIAR jun 1 cand (depois): " + rel.getConciliarJunDepoisUmCandidato());
        System.out.println("Saldo Cora antes/projetado: " + rel.getSaldoCoraAntes() + " / " + rel.getSaldoCoraProjetado());
        System.out.println("Ativos Cora antes/projetado: " + rel.getExtratoCoraAtivosAntes() + " / " + rel.getExtratoCoraAtivosProjetado());
        System.out.println("Grupos validados: " + rel.getGruposCompensacaoValidados());
        System.out.println("Conflitos: " + rel.getConflitos());
        System.out.println("Auditoria (primeiras 15):");
        rel.getAuditoria().stream().limit(15).forEach(a -> System.out.println("  " + a));

        if (rel.isAbortado()) {
            System.out.println("*** MIGRAÇÃO ABORTADA: " + rel.getMotivoAbort() + " ***");
        } else {
            assertThat(rel.getMotivoAbort()).isNull();
        }

        long aposentadosDepois =
                lancamentoRepository.countByNumeroBancoAndStatus(26, StatusLancamento.APOSENTADO);
        assertThat(aposentadosDepois).isEqualTo(aposentadosAntes);
        assertThat(lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(26)).isEqualByComparingTo(saldoAntes);
        assertThat(lancamentoRepository.countByNumeroBanco(26)).isEqualTo(ativosAntes);

        var vinculo1 = vinculoRepository.findById(1L);
        assertThat(vinculo1).isPresent();
        assertThat(vinculo1.get().getLancamentoFinanceiro().getId()).isEqualTo(180616L);
    }
}
