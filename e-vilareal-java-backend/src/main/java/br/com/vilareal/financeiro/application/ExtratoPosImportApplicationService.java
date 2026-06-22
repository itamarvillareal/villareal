package br.com.vilareal.financeiro.application;

import br.com.vilareal.documento.ContratoHonorariosRecebiveisConciliacaoService;
import br.com.vilareal.documento.HonorariosPosImportResult;
import br.com.vilareal.documento.HonorariosPosImportSimulacaoResult;
import br.com.vilareal.financeiro.api.dto.ExtratoPosImportRequest;
import br.com.vilareal.financeiro.api.dto.ExtratoPosImportResponse;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
public class ExtratoPosImportApplicationService {

    private static final Logger log = LoggerFactory.getLogger(ExtratoPosImportApplicationService.class);

    /** Cora: pós-import via GmailExtratoCoraService (aluguel + condomínio). */
    public static final int NUMERO_BANCO_CORA = 26;

    /** Extratos legados — sem pós-import de honorário. */
    public static final Set<Integer> BANCOS_CONGELADOS = Set.of(2, 3, 5);

    /** Upload manual ativo (honorários). */
    public static final Set<Integer> BANCOS_POS_IMPORT_HONORARIO = Set.of(1, 21, 24, 27, 28, 29);

    private static final int JANELA_REDE_SEGURANCA_DIAS = 45;

    private final ContratoHonorariosRecebiveisConciliacaoService honorariosConciliacaoService;
    private final LancamentoFinanceiroRepository lancamentoRepository;

    public ExtratoPosImportApplicationService(
            ContratoHonorariosRecebiveisConciliacaoService honorariosConciliacaoService,
            LancamentoFinanceiroRepository lancamentoRepository) {
        this.honorariosConciliacaoService = honorariosConciliacaoService;
        this.lancamentoRepository = lancamentoRepository;
    }

    @Transactional
    public ExtratoPosImportResponse rodar(ExtratoPosImportRequest req) {
        ExtratoPosImportResponse resp = new ExtratoPosImportResponse();
        if (req == null || req.numeroBanco() == null) {
            resp.setExecutado(false);
            resp.setMotivoIgnorado("numeroBanco ausente");
            return resp;
        }
        if (req.numeroBanco() == NUMERO_BANCO_CORA) {
            resp.setExecutado(false);
            resp.setMotivoIgnorado("Cora usa hook Gmail");
            return resp;
        }
        if (BANCOS_CONGELADOS.contains(req.numeroBanco())) {
            resp.setExecutado(false);
            resp.setMotivoIgnorado("banco congelado");
            return resp;
        }
        if (req.lancamentoIds() == null || req.lancamentoIds().isEmpty()) {
            resp.setExecutado(false);
            resp.setMotivoIgnorado("sem lancamentoIds");
            return resp;
        }

        HonorariosPosImportResult honor = honorariosConciliacaoService.conciliarHonorariosPosImport(req.lancamentoIds());
        resp.setExecutado(true);
        resp.setHonorariosAutoConciliados(honor.autoConciliados());
        resp.setHonorariosAmbiguos(honor.ambiguos());
        resp.setErros(honor.erros());
        log.info(
                "Pós-import extrato banco={} origem={}: honorários auto={}, ambíguos={}, erros={}",
                req.numeroBanco(),
                req.origem(),
                honor.autoConciliados(),
                honor.ambiguos(),
                honor.erros().size());
        return resp;
    }

    /** Rede de segurança idempotente — créditos órfãos recentes nos bancos de upload manual. */
    @Transactional
    public HonorariosPosImportResult conciliarHonorariosRedeSeguranca() {
        LocalDate desde = LocalDate.now().minusDays(JANELA_REDE_SEGURANCA_DIAS);
        List<Long> ids =
                lancamentoRepository.findCreditosOrfaosPosImportHonorarios(BANCOS_POS_IMPORT_HONORARIO, desde);
        if (ids.isEmpty()) {
            return HonorariosPosImportResult.vazio();
        }
        HonorariosPosImportResult r = honorariosConciliacaoService.conciliarHonorariosPosImport(ids);
        if (r.autoConciliados() > 0) {
            log.info(
                    "[pagamentos] Rede segurança honorários pós-import: {} auto-conciliado(s), {} ambíguo(s).",
                    r.autoConciliados(),
                    r.ambiguos());
        }
        return r;
    }

    /** Simulação read-only da rede de segurança (45 dias, bancos upload manual). */
    @Transactional(readOnly = true)
    public HonorariosPosImportSimulacaoResult simularRedeSegurancaHonorarios() {
        LocalDate desde = LocalDate.now().minusDays(JANELA_REDE_SEGURANCA_DIAS);
        List<Integer> bancos = BANCOS_POS_IMPORT_HONORARIO.stream().sorted().toList();
        List<Long> ids =
                lancamentoRepository.findCreditosOrfaosPosImportHonorarios(BANCOS_POS_IMPORT_HONORARIO, desde);
        if (ids.isEmpty()) {
            return HonorariosPosImportSimulacaoResult.vazio(desde, bancos);
        }
        return honorariosConciliacaoService.simularHonorariosPosImport(ids, desde, bancos);
    }
}
