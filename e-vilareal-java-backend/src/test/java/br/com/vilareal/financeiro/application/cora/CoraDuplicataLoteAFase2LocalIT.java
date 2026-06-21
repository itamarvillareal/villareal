package br.com.vilareal.financeiro.application.cora;

import br.com.vilareal.acoes.api.dto.AcoesDoDiaResponse;
import br.com.vilareal.acoes.application.AcoesDoDiaApplicationService;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.imovel.api.dto.ConciliarAlugueisAutomaticoResponse;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroResponse;
import br.com.vilareal.recebivel.application.RecebivelQuadroApplicationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fase 2 — migração Lote A real (124 pares com elo + 10 já aposentados na Fase 1).
 * Ativar: {@code -Dcora.migration.fase2=true -Dtest=CoraDuplicataLoteAFase2LocalIT}
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "cora.migration.fase2", matches = "true")
class CoraDuplicataLoteAFase2LocalIT {

    private static final BigDecimal SALDO_FINAL_ESPERADO = new BigDecimal("11509.45");
    private static final long ATIVOS_FINAL_ESPERADO = 1788L;
    private static final long APOSENTADOS_FINAL_ESPERADO = 134L;

    @Autowired
    private CoraDuplicataLoteAMigrationService migrationService;

    @Autowired
    private LancamentoFinanceiroRepository lancamentoRepository;

    @Autowired
    private LocacaoRepasseLancamentoRepository vinculoRepository;

    @Autowired
    private LocacaoReconciliacaoService locacaoReconciliacaoService;

    @Autowired
    private RecebivelQuadroApplicationService recebivelQuadroService;

    @Autowired
    private AcoesDoDiaApplicationService acoesDoDiaService;

    @Autowired
    private CoraDuplicataMigracaoAuditoriaWriter auditoriaWriter;

    @Test
    void fase2_migracaoLoteAReal_comVerificacaoAoVivo() throws Exception {
        BigDecimal saldoAntesFase2 = lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(26);
        long ativosAntesFase2 = lancamentoRepository.countByNumeroBanco(26);
        long aposentadosAntesFase2 =
                lancamentoRepository.countByNumeroBancoAndStatus(26, StatusLancamento.APOSENTADO);

        String recebiveisAntes = fingerprintRecebiveis(recebivelQuadroService.quadro(null, null, null));
        String acoesAntes = fingerprintAcoes(acoesDoDiaService.obter(null));

        System.out.println("=== PRÉ-FASE-2 ===");
        System.out.println("ATIVO=" + ativosAntesFase2 + " APOSENTADO=" + aposentadosAntesFase2 + " saldo=" + saldoAntesFase2);

        CoraDuplicataLoteARelatorio rel = migrationService.migrarDuplicatasLoteA(false);

        System.out.println("=== MIGRAÇÃO FASE 2 ===");
        System.out.println("Abortado: " + rel.isAbortado() + " " + rel.getMotivoAbort());
        System.out.println("Pares: " + rel.getParesNoMapa());
        System.out.println("Vínculos: " + rel.getVinculosRepasseMigrados());
        System.out.println("Classificações: " + rel.getClassificacoesCopiadas());
        System.out.println("Grupos tocados: " + rel.getGruposCompensacaoTocados());
        System.out.println("PL aposentados (tx): " + rel.getPlanilhasAposentadas());
        System.out.println("Auditoria: " + rel.getArquivoAuditoria());

        assertThat(rel.isAbortado()).isFalse();
        assertThat(rel.getArquivoAuditoria()).isNotNull();
        assertThat(Files.exists(rel.getArquivoAuditoria())).isTrue();
        assertThat(auditoriaWriter.ler(rel.getArquivoAuditoria())).isNotEmpty();

        // --- verificação AO VIVO pós-commit ---
        long ativosDepois = lancamentoRepository.countByNumeroBanco(26);
        long aposentadosDepois =
                lancamentoRepository.countByNumeroBancoAndStatus(26, StatusLancamento.APOSENTADO);
        BigDecimal saldoDepois = lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(26);

        System.out.println("=== PÓS-COMMIT EXTRATO ===");
        System.out.println("ATIVO: " + ativosAntesFase2 + " -> " + ativosDepois + " (esperado " + ATIVOS_FINAL_ESPERADO + ")");
        System.out.println("APOSENTADO: " + aposentadosAntesFase2 + " -> " + aposentadosDepois + " (esperado " + APOSENTADOS_FINAL_ESPERADO + ")");
        System.out.println("Saldo: " + saldoAntesFase2 + " -> " + saldoDepois + " (esperado " + SALDO_FINAL_ESPERADO + ")");

        assertThat(ativosDepois).isEqualTo(ATIVOS_FINAL_ESPERADO);
        assertThat(aposentadosDepois).isEqualTo(APOSENTADOS_FINAL_ESPERADO);
        assertThat(saldoDepois).isEqualByComparingTo(SALDO_FINAL_ESPERADO);

        var v1 = vinculoRepository.findById(1L).orElseThrow();
        var v2 = vinculoRepository.findById(2L).orElseThrow();
        System.out.println("=== CONTRATO 43 ===");
        System.out.println("Vínculo #1 ALUGUEL lancamento=" + v1.getLancamentoFinanceiro().getId() + " (esperado 219551)");
        System.out.println("Vínculo #2 REPASSE lancamento=" + v2.getLancamentoFinanceiro().getId() + " (esperado 219486)");
        assertThat(v1.getContratoLocacao().getId()).isEqualTo(43L);
        assertThat(v1.getLancamentoFinanceiro().getId()).isEqualTo(219551L);
        assertThat(v2.getLancamentoFinanceiro().getId()).isEqualTo(219486L);

        Set<String> gruposInvalidos = new HashSet<>();
        for (String linha : rel.getGruposCompensacaoValidados()) {
            String grupo = linha.split(" →")[0].trim();
            if (grupo.startsWith("COMP-") || grupo.matches("\\d+")) {
                BigDecimal s = lancamentoRepository.sumSaldoAssinadoPorGrupoCompensacaoAtivo(grupo);
                if (s.abs().compareTo(new BigDecimal("0.01")) > 0) {
                    gruposInvalidos.add(grupo + "=" + s);
                }
            }
        }
        System.out.println("=== GRUPOS COMPENSAÇÃO (pós-commit) ===");
        System.out.println("Inválidos: " + gruposInvalidos);
        assertThat(gruposInvalidos).isEmpty();

        String recebiveisDepois = fingerprintRecebiveis(recebivelQuadroService.quadro(null, null, null));
        String acoesDepois = fingerprintAcoes(acoesDoDiaService.obter(null));
        System.out.println("=== QUADROS ===");
        System.out.println("Recebíveis antes/depois iguais? " + recebiveisAntes.equals(recebiveisDepois));
        System.out.println("Ações-do-dia antes/depois iguais? " + acoesAntes.equals(acoesDepois));
        assertThat(recebiveisDepois).isEqualTo(recebiveisAntes);
        assertThat(acoesDepois).isEqualTo(acoesAntes);

        int conciliar2Antes = rel.getConciliarJunAntesDoisCandidatos();
        int conciliar1Depois = rel.getConciliarJunDepoisUmCandidato();
        System.out.println("=== CONCILIAR JUN ===");
        System.out.println("2 candidatos (antes): " + conciliar2Antes);
        System.out.println("1 candidato (depois): " + conciliar1Depois);
        assertThat(conciliar2Antes).isEqualTo(6);
        assertThat(conciliar1Depois).isEqualTo(5);

        ConciliarAlugueisAutomaticoResponse auto = locacaoReconciliacaoService.conciliarAlugueisAutomatico("2026-06");
        System.out.println("=== conciliarAlugueisAutomatico(2026-06) ===");
        System.out.println("Auto-vinculados: " + auto.getAutoVinculados());
        auto.getAutoVinculadosDetalhes().forEach(d -> System.out.println("  contrato=" + d.contratoId()
                + " lancamento=" + d.lancamentoFinanceiroId() + " vinculo=" + d.vinculoId()));
        assertThat(auto.getAutoVinculados()).isGreaterThanOrEqualTo(1);

        System.out.println("=== REVERSÃO ===");
        System.out.println("Log TSV: " + rel.getArquivoAuditoria());
        System.out.println("Serviço: CoraDuplicataLoteAReversaoService.reverterPeloLog(arquivo) + reativar 10 PL Fase 1 manualmente se necessário");
    }

    private static String fingerprintRecebiveis(RecebivelQuadroResponse r) {
        return r.totalGeral()
                + "|"
                + r.totalVencido()
                + "|"
                + r.itens().size()
                + "|"
                + r.resumoPorTipo().stream()
                        .map(t -> t.tipo() + ":" + t.total())
                        .sorted()
                        .collect(Collectors.joining(","));
    }

    private static String fingerprintAcoes(AcoesDoDiaResponse r) {
        return r.competencia()
                + "|c="
                + r.conciliar().quantidade()
                + "|b="
                + r.cobrar().quantidade()
                + "|r="
                + r.repassar().quantidade()
                + "|n="
                + r.renegociar().quantidade();
    }
}
