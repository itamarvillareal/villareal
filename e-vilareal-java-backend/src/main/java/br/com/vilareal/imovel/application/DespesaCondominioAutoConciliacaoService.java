package br.com.vilareal.imovel.application;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.imovel.api.dto.ConciliarCondominioAutomaticoResponse;
import br.com.vilareal.imovel.api.dto.ConciliarCondominioAutomaticoResponse.AutoConciliadoItem;
import br.com.vilareal.imovel.api.dto.ConciliarCondominioAutomaticoResponse.ParaRevisaoItem;
import br.com.vilareal.imovel.api.dto.ConciliarCondominioAutomaticoResponse.SemDebitoItem;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse.GrupoDespesaCondominio;
import br.com.vilareal.pagamento.api.dto.PagamentoConciliacaoVincularRequest;
import br.com.vilareal.pagamento.application.PagamentoConciliacaoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoRecorrenciaConfigEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
public class DespesaCondominioAutoConciliacaoService {

    private static final Logger log = LoggerFactory.getLogger(DespesaCondominioAutoConciliacaoService.class);
    private static final Pattern MES_ANO = Pattern.compile("^(0[1-9]|1[0-2])/\\d{4}$");
    private static final DateTimeFormatter FMT_MES_ANO = DateTimeFormatter.ofPattern("MM/yyyy", Locale.ROOT);
    private static final BigDecimal TOLERANCIA_PCT = new BigDecimal("0.15");

    private final PagamentoRepository pagamentoRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final DespesaCondominioCandidatoService candidatoService;
    private final PagamentoConciliacaoApplicationService conciliacaoService;

    public DespesaCondominioAutoConciliacaoService(
            PagamentoRepository pagamentoRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            DespesaCondominioCandidatoService candidatoService,
            PagamentoConciliacaoApplicationService conciliacaoService) {
        this.pagamentoRepository = pagamentoRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.candidatoService = candidatoService;
        this.conciliacaoService = conciliacaoService;
    }

    @Transactional
    public ConciliarCondominioAutomaticoResponse conciliarCondominioAutomatico(String competenciaParam) {
        String mesAno = resolverMesAno(competenciaParam);
        YearMonth ym = parseMesAno(mesAno);
        LocalDate inicio = ym.atDay(1);
        LocalDate fim = ym.atEndOfMonth();

        List<LancamentoFinanceiroEntity> debitosMes =
                lancamentoRepository.findDebitosCondominioNaoVinculadosPagamento(inicio, fim);
        List<PagamentoEntity> pagamentos =
                pagamentoRepository.findCondominioRecorrenteAbertoParaConciliar(mesAno);

        ConciliarCondominioAutomaticoResponse resp = new ConciliarCondominioAutomaticoResponse();
        resp.setCompetencia(ym.toString());

        for (PagamentoEntity pagamento : pagamentos) {
            if (!PagamentoDominio.isTipoPagar(pagamento.getTipo())
                    || pagamento.getFinanceiroLancamento() != null
                    || pagamento.getRecorrenciaConfig() == null) {
                continue;
            }
            List<String> grafias = resolverGrafias(pagamento);
            if (grafias.isEmpty()) {
                resp.getParaRevisao()
                        .add(new ParaRevisaoItem(
                                pagamento.getId(),
                                imovelId(pagamento),
                                numeroPlanilha(pagamento),
                                pagamento.getMesReferencia(),
                                pagamento.getValor(),
                                "Sem grafias cadastradas para match no extrato.",
                                0));
                continue;
            }

            BigDecimal refValor = pagamento.getValor();
            if (refValor == null || refValor.compareTo(BigDecimal.ZERO) <= 0) {
                refValor = pagamento.getRecorrenciaConfig().getValorEstimado();
            }

            List<LancamentoFinanceiroEntity> candidatos = new ArrayList<>();
            for (LancamentoFinanceiroEntity debito : debitosMes) {
                if (!DespesaCondominioGrafiasUtil.debitoCasaAlgumaGrafia(debito, grafias)) {
                    continue;
                }
                if (!valorDentroTolerancia(refValor, debito.getValor())) {
                    continue;
                }
                candidatos.add(debito);
            }

            if (candidatos.isEmpty()) {
                resp.getSemDebito()
                        .add(new SemDebitoItem(
                                pagamento.getId(),
                                imovelId(pagamento),
                                numeroPlanilha(pagamento),
                                pagamento.getMesReferencia(),
                                pagamento.getValor()));
            } else if (candidatos.size() == 1) {
                LancamentoFinanceiroEntity debito = candidatos.get(0);
                PagamentoConciliacaoVincularRequest req = new PagamentoConciliacaoVincularRequest();
                req.setPagamentoId(pagamento.getId());
                req.setFinanceiroLancamentoId(debito.getId());
                conciliacaoService.vincularConciliacao(req);
                debitosMes.remove(debito);
                resp.setAutoConciliados(resp.getAutoConciliados() + 1);
                resp.getAutoConciliadosDetalhes()
                        .add(new AutoConciliadoItem(
                                pagamento.getId(),
                                debito.getId(),
                                imovelId(pagamento),
                                numeroPlanilha(pagamento),
                                pagamento.getValor(),
                                debito.getValor().abs(),
                                debito.getDataLancamento(),
                                pagamento.getMesReferencia()));
                log.info(
                        "[condominio-auto] pagamento={} lancamento={} mes={} valorDebito={}",
                        pagamento.getId(),
                        debito.getId(),
                        pagamento.getMesReferencia(),
                        debito.getValor());
            } else {
                resp.getParaRevisao()
                        .add(new ParaRevisaoItem(
                                pagamento.getId(),
                                imovelId(pagamento),
                                numeroPlanilha(pagamento),
                                pagamento.getMesReferencia(),
                                pagamento.getValor(),
                                "Múltiplos débitos candidatos no mês.",
                                candidatos.size()));
            }
        }

        return resp;
    }

    static boolean valorDentroTolerancia(BigDecimal referencia, BigDecimal valorDebito) {
        if (referencia == null || valorDebito == null || referencia.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal deb = valorDebito.abs();
        BigDecimal diff = deb.subtract(referencia).abs();
        BigDecimal pct = diff.divide(referencia, 4, RoundingMode.HALF_UP);
        return pct.compareTo(TOLERANCIA_PCT) <= 0;
    }

    private List<String> resolverGrafias(PagamentoEntity pagamento) {
        PagamentoRecorrenciaConfigEntity cfg = pagamento.getRecorrenciaConfig();
        List<String> grafias = DespesaCondominioGrafiasUtil.deserializarGrafias(cfg.getGrafiasExtratoJson());
        if (!grafias.isEmpty()) {
            return grafias;
        }
        Long imovelId = imovelId(pagamento);
        if (imovelId == null) {
            return List.of();
        }
        return candidatoService
                .buscarGrupoPorObrigacaoChave("imovel:" + imovelId)
                .map(GrupoDespesaCondominio::grafias)
                .orElse(List.of());
    }

    private static Long imovelId(PagamentoEntity p) {
        if (p.getImovel() != null) {
            return p.getImovel().getId();
        }
        if (p.getRecorrenciaConfig() != null && p.getRecorrenciaConfig().getImovel() != null) {
            return p.getRecorrenciaConfig().getImovel().getId();
        }
        return null;
    }

    private static Integer numeroPlanilha(PagamentoEntity p) {
        if (p.getImovel() != null) {
            return p.getImovel().getNumeroPlanilha();
        }
        if (p.getRecorrenciaConfig() != null && p.getRecorrenciaConfig().getImovel() != null) {
            return p.getRecorrenciaConfig().getImovel().getNumeroPlanilha();
        }
        return null;
    }

    private String resolverMesAno(String competenciaParam) {
        if (!StringUtils.hasText(competenciaParam)) {
            return YearMonth.now().format(FMT_MES_ANO);
        }
        String s = competenciaParam.trim();
        if (s.matches("\\d{4}-\\d{2}")) {
            YearMonth ym = YearMonth.parse(s);
            return ym.format(FMT_MES_ANO);
        }
        return s;
    }

    static YearMonth parseMesAno(String mesAno) {
        if (!MES_ANO.matcher(mesAno).matches()) {
            throw new IllegalArgumentException("Formato de mês/ano inválido. Use MM/yyyy ou yyyy-MM.");
        }
        try {
            return YearMonth.parse(mesAno, FMT_MES_ANO);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Formato de mês/ano inválido. Use MM/yyyy ou yyyy-MM.");
        }
    }
}
