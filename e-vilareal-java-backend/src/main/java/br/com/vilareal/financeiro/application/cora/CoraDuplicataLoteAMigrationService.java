package br.com.vilareal.financeiro.application.cora;

import br.com.vilareal.financeiro.application.FinanceiroApplicationService;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.recebivel.application.RecebivelQuadroApplicationService;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CompensacaoParDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.SemelhanteEscritorioDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CompensacaoParDescarteRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SemelhanteEscritorioDescarteRepository;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Migração reversível do Lote A: reponta elos PLANILHA→OFX e aposenta duplicatas da planilha.
 */
@Service
public class CoraDuplicataLoteAMigrationService {

    private static final Logger log = LoggerFactory.getLogger(CoraDuplicataLoteAMigrationService.class);

    private static final int NUMERO_BANCO_CORA = 26;
    private static final String MOTIVO_APOSENTAR = "DUP_PLANILHA_OFX";
    private static final BigDecimal TOLERANCIA_GRUPO = new BigDecimal("0.01");

    private final CoraDuplicataParDiscoveryService discoveryService;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final LocacaoRepasseLancamentoRepository vinculoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final SemelhanteEscritorioDescarteRepository semelhanteDescarteRepository;
    private final CompensacaoParDescarteRepository compensacaoParDescarteRepository;
    private final FinanceiroApplicationService financeiroApplicationService;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoReconciliacaoService locacaoReconciliacaoService;
    private final CoraDuplicataMigracaoAuditoriaWriter auditoriaWriter;

    public CoraDuplicataLoteAMigrationService(
            CoraDuplicataParDiscoveryService discoveryService,
            LancamentoFinanceiroRepository lancamentoRepository,
            LocacaoRepasseLancamentoRepository vinculoRepository,
            PagamentoRepository pagamentoRepository,
            SemelhanteEscritorioDescarteRepository semelhanteDescarteRepository,
            CompensacaoParDescarteRepository compensacaoParDescarteRepository,
            FinanceiroApplicationService financeiroApplicationService,
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoReconciliacaoService locacaoReconciliacaoService,
            CoraDuplicataMigracaoAuditoriaWriter auditoriaWriter) {
        this.discoveryService = discoveryService;
        this.lancamentoRepository = lancamentoRepository;
        this.vinculoRepository = vinculoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.semelhanteDescarteRepository = semelhanteDescarteRepository;
        this.compensacaoParDescarteRepository = compensacaoParDescarteRepository;
        this.financeiroApplicationService = financeiroApplicationService;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.locacaoReconciliacaoService = locacaoReconciliacaoService;
        this.auditoriaWriter = auditoriaWriter;
    }

    @Transactional
    public CoraDuplicataLoteARelatorio migrarDuplicatasLoteA(boolean dryRun) {
        CoraDuplicataLoteARelatorio rel = new CoraDuplicataLoteARelatorio();
        rel.setDryRun(dryRun);

        List<CoraDuplicataPar> pares = discoveryService.descobrirLoteA();
        rel.setParesNoMapa(pares.size());
        rel.getExemplosPares().addAll(pares.stream().limit(10).toList());

        if (pares.isEmpty()) {
            abortar(rel, "Nenhum par descoberto para o Lote A.");
            finalizarTransacao(dryRun);
            return rel;
        }

        Set<Long> plIds = pares.stream().map(CoraDuplicataPar::planilhaId).collect(Collectors.toSet());
        Map<Long, Long> plToOx = pares.stream()
                .collect(Collectors.toMap(CoraDuplicataPar::planilhaId, CoraDuplicataPar::ofxId, (a, b) -> a));

        rel.setSaldoCoraAntes(lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(NUMERO_BANCO_CORA));
        rel.setExtratoCoraAtivosAntes(lancamentoRepository.countByNumeroBanco(NUMERO_BANCO_CORA));
        rel.setConciliarJunAntesDoisCandidatos(contarItensConciliarJunComNCandidatos(2));

        Set<Long> todosIds = Stream.concat(plIds.stream(), plToOx.values().stream()).collect(Collectors.toSet());
        Map<Long, LancamentoFinanceiroEntity> porId = lancamentoRepository.findAllByIdIn(todosIds).stream()
                .collect(Collectors.toMap(LancamentoFinanceiroEntity::getId, e -> e));

        if (!migrarVinculosRepasse(plToOx, porId, rel)) {
            finalizarTransacao(dryRun);
            return rel;
        }
        if (!migrarPagamentos(plIds, plToOx, porId, rel)) {
            finalizarTransacao(dryRun);
            return rel;
        }
        Map<Long, String> gruposAnterioresOx = herdarGruposCompensacaoDoPl(pares, porId, rel);
        migrarClassificacoes(pares, porId, rel, gruposAnterioresOx);
        lancamentoRepository.saveAll(pares.stream().map(p -> porId.get(p.ofxId())).toList());
        dissolverGruposAbandonados(gruposAnterioresOx, plIds, porId, rel);

        Set<String> gruposTocados = coletarGruposTocados(pares, porId);
        gruposTocados.addAll(gruposAnterioresOx.values());
        rel.setGruposCompensacaoTocados(gruposTocados.size());
        if (!validarGruposCompensacao(gruposTocados, plIds, gruposAnterioresOx, rel)) {
            finalizarTransacao(dryRun);
            return rel;
        }

        migrarDescartes(plIds, plToOx, rel);

        int aposentados = financeiroApplicationService.aposentarLancamentos(plIds, MOTIVO_APOSENTAR);
        rel.setPlanilhasAposentadas(aposentados);
        for (Long plId : plIds) {
            auditar(rel, plId, plToOx.get(plId), "financeiro_lancamento", "status", StatusLancamento.ATIVO, StatusLancamento.APOSENTADO);
        }

        for (String grupo : gruposTocados) {
            BigDecimal saldo = lancamentoRepository.sumSaldoAssinadoPorGrupoCompensacaoAtivo(grupo);
            if (saldo.abs().compareTo(TOLERANCIA_GRUPO) > 0) {
                abortar(rel, "Grupo " + grupo + " não soma-zero após aposentar: " + saldo);
                finalizarTransacao(dryRun);
                return rel;
            }
            rel.getGruposCompensacaoValidados().add(grupo + " → OK (" + saldo + ")");
        }

        rel.setSaldoCoraProjetado(lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(NUMERO_BANCO_CORA));
        rel.setExtratoCoraAtivosProjetado(lancamentoRepository.countByNumeroBanco(NUMERO_BANCO_CORA));
        rel.setConciliarJunDepoisUmCandidato(contarItensConciliarJunComNCandidatos(1));

        log.info(
                "Migração Lote A {} concluída: {} pares, {} vínculos, {} pagamentos, {} classificações, {} aposentados",
                dryRun ? "DRY-RUN" : "APLICADA",
                pares.size(),
                rel.getVinculosRepasseMigrados(),
                rel.getPagamentosMigrados(),
                rel.getClassificacoesCopiadas(),
                rel.getPlanilhasAposentadas());

        if (!dryRun && !rel.isAbortado()) {
            try {
                rel.setArquivoAuditoria(auditoriaWriter.persistir(rel));
            } catch (java.io.IOException ex) {
                abortar(rel, "Falha ao persistir auditoria: " + ex.getMessage());
                finalizarTransacao(true);
                return rel;
            }
        }

        finalizarTransacao(dryRun);
        return rel;
    }

    private boolean migrarVinculosRepasse(
            Map<Long, Long> plToOx,
            Map<Long, LancamentoFinanceiroEntity> porId,
            CoraDuplicataLoteARelatorio rel) {
        List<LocacaoRepasseLancamentoEntity> vinculos =
                vinculoRepository.findByLancamentoFinanceiro_IdIn(plToOx.keySet());
        for (LocacaoRepasseLancamentoEntity v : vinculos) {
            long plId = v.getLancamentoFinanceiro().getId();
            long oxId = plToOx.get(plId);
            Long contratoId = v.getContratoLocacao().getId();
            Optional<LocacaoRepasseLancamentoEntity> conflito =
                    vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                            contratoId, oxId, v.getPapel());
            if (conflito.isPresent() && !Objects.equals(conflito.get().getId(), v.getId())) {
                abortar(
                        rel,
                        "UK locacao_repasse_lancamento: contrato="
                                + contratoId
                                + " lancamento="
                                + oxId
                                + " papel="
                                + v.getPapel()
                                + " já existe (vinculo "
                                + conflito.get().getId()
                                + ")");
                return false;
            }
            auditar(
                    rel,
                    plId,
                    oxId,
                    "locacao_repasse_lancamento",
                    "lancamento_financeiro_id",
                    String.valueOf(plId),
                    String.valueOf(oxId));
            v.setLancamentoFinanceiro(porId.get(oxId));
            rel.setVinculosRepasseMigrados(rel.getVinculosRepasseMigrados() + 1);
        }
        if (!vinculos.isEmpty()) {
            vinculoRepository.saveAll(vinculos);
        }
        return true;
    }

    private boolean migrarPagamentos(
            Set<Long> plIds,
            Map<Long, Long> plToOx,
            Map<Long, LancamentoFinanceiroEntity> porId,
            CoraDuplicataLoteARelatorio rel) {
        List<PagamentoEntity> pagamentos = pagamentoRepository.findByFinanceiroLancamento_IdIn(plIds);
        for (PagamentoEntity p : pagamentos) {
            if (p.getFinanceiroLancamento() == null) {
                continue;
            }
            long plId = p.getFinanceiroLancamento().getId();
            long oxId = plToOx.get(plId);
            if (pagamentoRepository.existsByFinanceiroLancamento_Id(oxId)) {
                abortar(rel, "pagamento já vinculado ao OFX " + oxId + " (PL " + plId + ")");
                return false;
            }
            auditar(
                    rel,
                    plId,
                    oxId,
                    "pagamento",
                    "financeiro_lancamento_id",
                    String.valueOf(plId),
                    String.valueOf(oxId));
            p.setFinanceiroLancamento(porId.get(oxId));
            rel.setPagamentosMigrados(rel.getPagamentosMigrados() + 1);
        }
        if (!pagamentos.isEmpty()) {
            pagamentoRepository.saveAll(pagamentos);
        }
        return true;
    }

    private Map<Long, String> herdarGruposCompensacaoDoPl(
            List<CoraDuplicataPar> pares,
            Map<Long, LancamentoFinanceiroEntity> porId,
            CoraDuplicataLoteARelatorio rel) {
        Map<Long, String> gruposAnterioresOx = new LinkedHashMap<>();
        for (CoraDuplicataPar par : pares) {
            LancamentoFinanceiroEntity pl = porId.get(par.planilhaId());
            LancamentoFinanceiroEntity ox = porId.get(par.ofxId());
            if (!StringUtils.hasText(pl.getGrupoCompensacao())) {
                continue;
            }
            if (StringUtils.hasText(ox.getGrupoCompensacao())) {
                gruposAnterioresOx.put(ox.getId(), ox.getGrupoCompensacao().trim());
            }
            String grupoPl = pl.getGrupoCompensacao().trim();
            if (grupoPl.equals(StringUtils.hasText(ox.getGrupoCompensacao()) ? ox.getGrupoCompensacao().trim() : "")) {
                continue;
            }
            auditar(
                    rel,
                    par.planilhaId(),
                    par.ofxId(),
                    "financeiro_lancamento",
                    "grupo_compensacao",
                    ox.getGrupoCompensacao(),
                    grupoPl);
            ox.setGrupoCompensacao(grupoPl);
            ox.setEtapa(EtapaLancamento.calcular(
                    codigoConta(ox),
                    ox.getGrupoCompensacao(),
                    ox.getClienteEntidade() != null ? ox.getClienteEntidade().getId() : null));
        }
        return gruposAnterioresOx;
    }

    private void migrarClassificacoes(
            List<CoraDuplicataPar> pares,
            Map<Long, LancamentoFinanceiroEntity> porId,
            CoraDuplicataLoteARelatorio rel,
            Map<Long, String> gruposAnterioresOx) {
        for (CoraDuplicataPar par : pares) {
            LancamentoFinanceiroEntity pl = porId.get(par.planilhaId());
            LancamentoFinanceiroEntity ox = porId.get(par.ofxId());
            if (!oxPrecisaClassificacaoDoPl(pl, ox)) {
                continue;
            }
            if (pl.getContaContabil() != null
                    && (ox.getContaContabil() == null
                            || codigoConta(ox).equalsIgnoreCase("N"))) {
                auditar(
                        rel,
                        par.planilhaId(),
                        par.ofxId(),
                        "financeiro_lancamento",
                        "conta_contabil_id",
                        strId(ox.getContaContabil()),
                        strId(pl.getContaContabil()));
                ox.setContaContabil(pl.getContaContabil());
            }
            if (pl.getProcesso() != null && ox.getProcesso() == null) {
                auditar(
                        rel,
                        par.planilhaId(),
                        par.ofxId(),
                        "financeiro_lancamento",
                        "processo_id",
                        null,
                        String.valueOf(pl.getProcesso().getId()));
                ox.setProcesso(pl.getProcesso());
            }
            if (pl.getClienteEntidade() != null && ox.getClienteEntidade() == null) {
                auditar(
                        rel,
                        par.planilhaId(),
                        par.ofxId(),
                        "financeiro_lancamento",
                        "cliente_id",
                        null,
                        String.valueOf(pl.getClienteEntidade().getId()));
                ox.setClienteEntidade(pl.getClienteEntidade());
            }
            EtapaLancamento novaEtapa = EtapaLancamento.calcular(
                    codigoConta(ox),
                    ox.getGrupoCompensacao(),
                    ox.getClienteEntidade() != null ? ox.getClienteEntidade().getId() : null);
            if (ox.getEtapa() != novaEtapa) {
                auditar(
                        rel,
                        par.planilhaId(),
                        par.ofxId(),
                        "financeiro_lancamento",
                        "etapa",
                        String.valueOf(ox.getEtapa()),
                        String.valueOf(novaEtapa));
                ox.setEtapa(novaEtapa);
            }
            rel.setClassificacoesCopiadas(rel.getClassificacoesCopiadas() + 1);
        }
    }

    private Set<String> coletarGruposTocados(List<CoraDuplicataPar> pares, Map<Long, LancamentoFinanceiroEntity> porId) {
        Set<String> grupos = new HashSet<>();
        for (CoraDuplicataPar par : pares) {
            LancamentoFinanceiroEntity pl = porId.get(par.planilhaId());
            LancamentoFinanceiroEntity ox = porId.get(par.ofxId());
            if (StringUtils.hasText(pl.getGrupoCompensacao())) {
                grupos.add(pl.getGrupoCompensacao().trim());
            }
            if (StringUtils.hasText(ox.getGrupoCompensacao())) {
                grupos.add(ox.getGrupoCompensacao().trim());
            }
        }
        return grupos;
    }

    private void dissolverGruposAbandonados(
            Map<Long, String> gruposAnterioresOx,
            Set<Long> plIdsAposentar,
            Map<Long, LancamentoFinanceiroEntity> porId,
            CoraDuplicataLoteARelatorio rel) {
        Set<String> gruposOrigem = new HashSet<>(gruposAnterioresOx.values());
        List<LancamentoFinanceiroEntity> toSave = new ArrayList<>();
        for (String grupo : gruposOrigem) {
            BigDecimal saldo = saldoGrupoProjetado(grupo, plIdsAposentar, gruposAnterioresOx);
            if (saldo.abs().compareTo(TOLERANCIA_GRUPO) <= 0) {
                continue;
            }
            for (LancamentoFinanceiroEntity l : lancamentoRepository.findAtivosByGrupoCompensacao(grupo)) {
                if (plIdsAposentar.contains(l.getId())) {
                    continue;
                }
                if (gruposAnterioresOx.containsKey(l.getId())) {
                    continue;
                }
                auditar(
                        rel,
                        null,
                        l.getId(),
                        "financeiro_lancamento",
                        "grupo_compensacao",
                        l.getGrupoCompensacao(),
                        null);
                l.setGrupoCompensacao(null);
                l.setEtapa(EtapaLancamento.calcular(
                        codigoConta(l),
                        null,
                        l.getClienteEntidade() != null ? l.getClienteEntidade().getId() : null));
                toSave.add(l);
            }
        }
        if (!toSave.isEmpty()) {
            lancamentoRepository.saveAll(toSave);
        }
    }

    private boolean validarGruposCompensacao(
            Set<String> grupos,
            Set<Long> plIdsAposentar,
            Map<Long, String> gruposAnterioresOx,
            CoraDuplicataLoteARelatorio rel) {
        for (String grupo : grupos) {
            BigDecimal saldoProjetado = saldoGrupoProjetado(grupo, plIdsAposentar, gruposAnterioresOx);
            if (saldoProjetado.abs().compareTo(TOLERANCIA_GRUPO) > 0) {
                abortar(rel, "Grupo " + grupo + " não soma-zero projetado: " + saldoProjetado);
                return false;
            }
            rel.getGruposCompensacaoValidados().add(grupo + " → projetado OK (" + saldoProjetado + ")");
        }
        return true;
    }

    private BigDecimal saldoGrupoProjetado(
            String grupo, Set<Long> plIdsAposentar, Map<Long, String> gruposAnterioresOx) {
        BigDecimal saldo = BigDecimal.ZERO;
        for (LancamentoFinanceiroEntity l : lancamentoRepository.findAtivosByGrupoCompensacao(grupo)) {
            if (plIdsAposentar.contains(l.getId())) {
                continue;
            }
            if (gruposAnterioresOx.containsKey(l.getId())
                    && gruposAnterioresOx.get(l.getId()).equals(grupo)
                    && (l.getGrupoCompensacao() == null
                            || !grupo.equals(l.getGrupoCompensacao().trim()))) {
                continue;
            }
            saldo = saldo.add(valorAssinado(l));
        }
        return saldo;
    }

    private void migrarDescartes(Set<Long> plIds, Map<Long, Long> plToOx, CoraDuplicataLoteARelatorio rel) {
        for (SemelhanteEscritorioDescarteEntity d : semelhanteDescarteRepository.findByLancamentoIdIn(plIds)) {
            long plId = d.getLancamentoId();
            long oxId = plToOx.get(plId);
            if (semelhanteDescarteRepository.existsByLancamentoIdAndClienteIdAndProcessoId(
                    oxId, d.getClienteId(), d.getProcessoId())) {
                semelhanteDescarteRepository.delete(d);
                continue;
            }
            auditar(
                    rel,
                    plId,
                    oxId,
                    "financeiro_semelhante_escritorio_descarte",
                    "lancamento_id",
                    String.valueOf(plId),
                    String.valueOf(oxId));
            d.setLancamentoId(oxId);
            semelhanteDescarteRepository.save(d);
            rel.setDescartesSemelhanteRecriados(rel.getDescartesSemelhanteRecriados() + 1);
        }

        for (CompensacaoParDescarteEntity d : compensacaoParDescarteRepository.findByEnvolvendoLancamentos(plIds)) {
            long plId = plIds.contains(d.getLancamentoIdMenor()) ? d.getLancamentoIdMenor() : d.getLancamentoIdMaior();
            long oxId = plToOx.get(plId);
            long menor = d.getLancamentoIdMenor();
            long maior = d.getLancamentoIdMaior();
            if (menor == plId) {
                menor = oxId;
            } else {
                maior = oxId;
            }
            if (menor > maior) {
                long tmp = menor;
                menor = maior;
                maior = tmp;
            }
            if (compensacaoParDescarteRepository.existsByLancamentoIdMenorAndLancamentoIdMaior(menor, maior)) {
                compensacaoParDescarteRepository.delete(d);
                continue;
            }
            auditar(
                    rel,
                    plId,
                    oxId,
                    "financeiro_compensacao_par_descarte",
                    "lancamento_id",
                    String.valueOf(plId),
                    String.valueOf(oxId));
            d.setLancamentoIdMenor(menor);
            d.setLancamentoIdMaior(maior);
            compensacaoParDescarteRepository.save(d);
            rel.setDescartesCompensacaoRecriados(rel.getDescartesCompensacaoRecriados() + 1);
        }
    }

    private int contarItensConciliarJunComNCandidatos(int nCandidatos) {
        String competencia = "2026-06";
        YearMonth ym = YearMonth.parse(competencia);
        LocalDate inicio = ym.atDay(1);
        LocalDate fim = ym.atEndOfMonth();
        LocalDate hoje = LocalDate.now();
        int count = 0;
        for (ContratoLocacaoEntity contrato :
                contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(competencia, inicio, fim)) {
            LocalDate vencimento =
                    RecebivelQuadroApplicationService.calcularVencimentoAluguel(contrato.getDiaVencimentoAluguel(), ym);
            if (!vencimento.isBefore(hoje)) {
                continue;
            }
            int candidatos = locacaoReconciliacaoService
                    .creditosCandidatosAluguelSemClassificar(contrato.getId(), competencia)
                    .size();
            if (candidatos == nCandidatos) {
                count++;
            }
        }
        return count;
    }

    private static boolean oxPrecisaClassificacaoDoPl(LancamentoFinanceiroEntity pl, LancamentoFinanceiroEntity ox) {
        if (ox.getEtapa() == EtapaLancamento.IMPORTADO || codigoConta(ox).equalsIgnoreCase("N")) {
            return pl.getEtapa() != EtapaLancamento.IMPORTADO || pl.getProcesso() != null || pl.getClienteEntidade() != null;
        }
        return pl.getProcesso() != null && ox.getProcesso() == null
                || pl.getClienteEntidade() != null && ox.getClienteEntidade() == null
                || StringUtils.hasText(pl.getGrupoCompensacao()) && !StringUtils.hasText(ox.getGrupoCompensacao());
    }

    private static BigDecimal valorAssinado(LancamentoFinanceiroEntity l) {
        return l.getNatureza() == NaturezaLancamento.CREDITO ? l.getValor() : l.getValor().negate();
    }

    private static String codigoConta(LancamentoFinanceiroEntity l) {
        return l.getContaContabil() != null ? l.getContaContabil().getCodigo() : "N";
    }

    private static String strId(Object entity) {
        if (entity == null) {
            return null;
        }
        try {
            var m = entity.getClass().getMethod("getId");
            return String.valueOf(m.invoke(entity));
        } catch (ReflectiveOperationException e) {
            return String.valueOf(entity);
        }
    }

    private static void auditar(
            CoraDuplicataLoteARelatorio rel,
            Long plId,
            Long oxId,
            String tabela,
            String campo,
            String antes,
            String depois) {
        rel.getAuditoria()
                .add(new CoraDuplicataMigracaoAuditoriaLinha(plId, oxId, tabela, campo, antes, depois));
    }

    private static void abortar(CoraDuplicataLoteARelatorio rel, String motivo) {
        rel.setAbortado(true);
        rel.setMotivoAbort(motivo);
        rel.getConflitos().add(motivo);
        log.warn("Migração Lote A abortada: {}", motivo);
    }

    private static void finalizarTransacao(boolean dryRun) {
        if (dryRun) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        }
    }
}
