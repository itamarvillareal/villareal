package br.com.vilareal.documento;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pagamento.api.dto.PagamentoConciliacaoVincularRequest;
import br.com.vilareal.pagamento.api.dto.PagamentoMarcarRecebidoRequest;
import br.com.vilareal.pagamento.api.dto.PagamentoWriteRequest;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.application.PagamentoConciliacaoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Concilia automaticamente parcelas de honorários com recebíveis (Pagamentos) e créditos do financeiro
 * quando o pagamento já entrou na Conta Corrente mas o vínculo ainda não foi feito manualmente.
 */
@Service
public class ContratoHonorariosRecebiveisConciliacaoService {

    private static final Logger log = LoggerFactory.getLogger(ContratoHonorariosRecebiveisConciliacaoService.class);

    static final BigDecimal TOLERANCIA_VALOR = new BigDecimal("1.00");
    static final int MAX_DIAS_DATA = 30;

    private static final Set<String> STATUS_PAGAMENTO_ENCERRADO =
            Set.of(PagamentoDominio.ST_CANCELADO, PagamentoDominio.ST_SUBSTITUIDO);

    private static final Set<String> STATUS_RECEBER_RECEBIDO =
            Set.of(PagamentoDominio.ST_RECEBIDO, PagamentoDominio.ST_CONCILIADO);

    private final ContratoHonorariosRepository contratoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final LancamentoFinanceiroRepository lancamentoFinanceiroRepository;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final PagamentoConciliacaoApplicationService pagamentoConciliacaoApplicationService;

    public ContratoHonorariosRecebiveisConciliacaoService(
            ContratoHonorariosRepository contratoRepository,
            PagamentoRepository pagamentoRepository,
            LancamentoFinanceiroRepository lancamentoFinanceiroRepository,
            PagamentoApplicationService pagamentoApplicationService,
            PagamentoConciliacaoApplicationService pagamentoConciliacaoApplicationService) {
        this.contratoRepository = contratoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.lancamentoFinanceiroRepository = lancamentoFinanceiroRepository;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.pagamentoConciliacaoApplicationService = pagamentoConciliacaoApplicationService;
    }

    @Transactional
    public void sincronizarAutomaticamente(Long processoId, Long pessoaId, LocalDate de, LocalDate ate) {
        List<ContratoHonorariosEntity> contratos = contratoRepository.listarComFiltros(processoId, pessoaId, de, ate);
        Set<Long> processosSincronizados = new HashSet<>();
        for (ContratoHonorariosEntity c : contratos) {
            if (c.getProcesso() == null || c.getProcesso().getId() == null) {
                continue;
            }
            Long pid = c.getProcesso().getId();
            if (processosSincronizados.add(pid)) {
                sincronizarContratoProcesso(pid);
            }
        }
    }

    @Transactional
    public void sincronizarContratoProcesso(Long processoId) {
        if (processoId == null) {
            return;
        }
        ContratoHonorariosEntity contrato =
                contratoRepository.findByProcessoIdWithDetalhes(processoId).orElse(null);
        if (contrato == null) {
            return;
        }

        List<LancamentoFinanceiroEntity> todosCreditos = lancamentoFinanceiroRepository.findCreditosPorProcesso(processoId);
        if (materializarParcelasDeFinanceiro(contrato, todosCreditos)) {
            contratoRepository.save(contrato);
            contrato = contratoRepository.findByProcessoIdWithDetalhes(processoId).orElse(contrato);
        }
        if (contrato.getParcelas() == null || contrato.getParcelas().isEmpty()) {
            return;
        }

        List<PagamentoEntity> pagamentosProcesso = pagamentoRepository.findReceberPorProcesso(processoId);
        List<LancamentoFinanceiroEntity> creditosLivres =
                lancamentoFinanceiroRepository.findCreditosNaoVinculadosPorProcesso(processoId);

        Set<Long> pagamentosUsados = contrato.getParcelas().stream()
                .map(ContratoHonorariosParcelaEntity::getPagamento)
                .filter(Objects::nonNull)
                .map(PagamentoEntity::getId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        Set<Long> lancamentosUsados = new HashSet<>();
        boolean alterou = false;

        List<ContratoHonorariosParcelaEntity> parcelasOrdenadas = contrato.getParcelas().stream()
                .sorted(Comparator.comparing(
                        ContratoHonorariosParcelaEntity::getNumeroParcela, Comparator.nullsLast(Integer::compareTo)))
                .toList();

        for (ContratoHonorariosParcelaEntity parcela : parcelasOrdenadas) {
            PagamentoEntity pagamento = resolverPagamentoParcela(
                    contrato, parcela, pagamentosProcesso, pagamentosUsados);

            if (pagamento == null) {
                Optional<LancamentoFinanceiroEntity> lancDireto =
                        encontrarLancamentoParaParcela(parcela, creditosLivres, lancamentosUsados);
                if (lancDireto.isPresent()) {
                    pagamento = registrarRecebivelDeFinanceiro(contrato, parcela, lancDireto.get());
                    lancamentosUsados.add(lancDireto.get().getId());
                    alterou = true;
                }
            }

            if (pagamento == null) {
                continue;
            }

            if (parcela.getPagamento() == null || !Objects.equals(parcela.getPagamento().getId(), pagamento.getId())) {
                parcela.setPagamento(pagamento);
                pagamentosUsados.add(pagamento.getId());
                alterou = true;
                log.info(
                        "Recebíveis honorários: parcela {} do contrato {} vinculada ao pagamento {}",
                        parcela.getNumeroParcela(),
                        contrato.getId(),
                        pagamento.getId());
            }

            pagamento = recarregarPagamento(pagamento.getId());
            if (pagamento == null) {
                continue;
            }

            if (PagamentoDominio.ST_CONCILIADO.equals(pagamento.getStatus())
                    && pagamento.getFinanceiroLancamento() != null) {
                continue;
            }

            Optional<LancamentoFinanceiroEntity> lancamentoOpt =
                    encontrarLancamentoParaPagamento(pagamento, creditosLivres, lancamentosUsados);
            if (lancamentoOpt.isEmpty()) {
                lancamentoOpt = encontrarLancamentoParaParcela(parcela, creditosLivres, lancamentosUsados);
            }
            if (lancamentoOpt.isEmpty()) {
                continue;
            }
            LancamentoFinanceiroEntity lancamento = lancamentoOpt.get();

            if (precisaMarcarRecebido(pagamento)) {
                PagamentoMarcarRecebidoRequest req = new PagamentoMarcarRecebidoRequest();
                req.setDataRecebimento(lancamento.getDataLancamento());
                req.setValorRecebido(lancamento.getValor().abs());
                pagamentoApplicationService.marcarRecebido(pagamento.getId(), req);
                pagamento = recarregarPagamento(pagamento.getId());
                alterou = true;
                log.info(
                        "Recebíveis honorários: pagamento {} marcado RECEBIDO via financeiro (lanç. {})",
                        pagamento.getId(),
                        lancamento.getId());
            }

            if (pagamento != null && precisaConciliar(pagamento)) {
                PagamentoConciliacaoVincularRequest req = new PagamentoConciliacaoVincularRequest();
                req.setPagamentoId(pagamento.getId());
                req.setFinanceiroLancamentoId(lancamento.getId());
                pagamentoConciliacaoApplicationService.vincularConciliacao(req);
                lancamentosUsados.add(lancamento.getId());
                alterou = true;
                log.info(
                        "Recebíveis honorários: pagamento {} conciliado com lançamento financeiro {}",
                        pagamento.getId(),
                        lancamento.getId());
            }
        }

        if (alterou) {
            contratoRepository.save(contrato);
        }
    }

    static boolean materializarParcelasDeFinanceiro(
            ContratoHonorariosEntity contrato, List<LancamentoFinanceiroEntity> todosCreditos) {
        if (contrato.getParcelas() != null && !contrato.getParcelas().isEmpty()) {
            return false;
        }
        Integer qtd = contrato.getQuantidadeParcelas();
        if (qtd == null || qtd <= 0) {
            return false;
        }

        BigDecimal valorEsperado = valorParcelaEsperado(contrato, qtd);
        List<LancamentoFinanceiroEntity> candidatos = todosCreditos.stream()
                .filter(l -> l.getNatureza() == NaturezaLancamento.CREDITO)
                .filter(l -> valorCompativel(l.getValor() != null ? l.getValor().abs() : null, valorEsperado))
                .sorted(Comparator.comparing(LancamentoFinanceiroEntity::getDataLancamento, Comparator.nullsLast(LocalDate::compareTo))
                        .thenComparing(LancamentoFinanceiroEntity::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();

        if (candidatos.isEmpty()) {
            return false;
        }

        List<LancamentoFinanceiroEntity> usar =
                candidatos.size() >= qtd ? candidatos.subList(0, qtd) : candidatos;
        if (contrato.getParcelas() == null) {
            contrato.setParcelas(new ArrayList<>());
        }

        int numero = 1;
        for (LancamentoFinanceiroEntity lanc : usar) {
            ContratoHonorariosParcelaEntity pe = new ContratoHonorariosParcelaEntity();
            pe.setContrato(contrato);
            pe.setNumeroParcela(numero++);
            pe.setValor(lanc.getValor().abs());
            pe.setDataVencimento(lanc.getDataLancamento());
            contrato.getParcelas().add(pe);
        }
        return true;
    }

    static BigDecimal valorParcelaEsperado(ContratoHonorariosEntity contrato, int qtd) {
        BigDecimal total = contrato.getValorTotalParcelas();
        if (total == null) {
            total = contrato.getValorFixo();
        }
        if (total == null || qtd <= 0) {
            return null;
        }
        return total.divide(BigDecimal.valueOf(qtd), 2, RoundingMode.HALF_UP);
    }

    static boolean valorCompativel(BigDecimal valor, BigDecimal esperado) {
        if (valor == null || esperado == null) {
            return false;
        }
        return valor.subtract(esperado).abs().compareTo(TOLERANCIA_VALOR) <= 0;
    }

    private PagamentoEntity registrarRecebivelDeFinanceiro(
            ContratoHonorariosEntity contrato,
            ContratoHonorariosParcelaEntity parcela,
            LancamentoFinanceiroEntity lancamento) {
        ProcessoEntity processo = contrato.getProcesso();
        if (processo == null) {
            return null;
        }

        PagamentoWriteRequest req = new PagamentoWriteRequest();
        req.setTipo(PagamentoDominio.TIPO_RECEBER);
        req.setProcessoId(processo.getId());
        if (processo.getCliente() != null) {
            req.setClienteId(processo.getCliente().getId());
        }
        req.setValor(lancamento.getValor().abs());
        req.setDataVencimento(
                parcela.getDataVencimento() != null ? parcela.getDataVencimento() : lancamento.getDataLancamento());
        req.setDataCadastro(lancamento.getDataLancamento());
        req.setCategoria("CLIENTE");
        req.setFormaPagamento(
                StringUtils.hasText(contrato.getFormaPagamentoParcelas())
                        ? contrato.getFormaPagamentoParcelas().trim()
                        : "PIX");
        int total = contrato.getQuantidadeParcelas() != null ? contrato.getQuantidadeParcelas() : 1;
        int num = parcela.getNumeroParcela() != null ? parcela.getNumeroParcela() : 1;
        req.setDescricao(
                total <= 1
                        ? "Honorários contratuais — contrato #" + contrato.getId() + " (financeiro)"
                        : "Honorários contratuais — contrato #"
                                + contrato.getId()
                                + " — parcela "
                                + num
                                + "/"
                                + total
                                + " (financeiro)");
        req.setOrigem("CONTRATO_HONORARIOS:" + contrato.getId());

        var criado = pagamentoApplicationService.criar(req);
        PagamentoMarcarRecebidoRequest recebido = new PagamentoMarcarRecebidoRequest();
        recebido.setDataRecebimento(lancamento.getDataLancamento());
        recebido.setValorRecebido(lancamento.getValor().abs());
        pagamentoApplicationService.marcarRecebido(criado.getId(), recebido);

        PagamentoConciliacaoVincularRequest conc = new PagamentoConciliacaoVincularRequest();
        conc.setPagamentoId(criado.getId());
        conc.setFinanceiroLancamentoId(lancamento.getId());
        pagamentoConciliacaoApplicationService.vincularConciliacao(conc);

        parcela.setPagamento(recarregarPagamento(criado.getId()));
        log.info(
                "Recebíveis honorários: parcela {} registrada a partir do financeiro (lanç. {}, pag. {})",
                parcela.getNumeroParcela(),
                lancamento.getId(),
                criado.getId());
        return parcela.getPagamento();
    }

    private PagamentoEntity resolverPagamentoParcela(
            ContratoHonorariosEntity contrato,
            ContratoHonorariosParcelaEntity parcela,
            List<PagamentoEntity> pagamentosProcesso,
            Set<Long> pagamentosUsados) {
        if (parcela.getPagamento() != null && parcela.getPagamento().getId() != null) {
            return recarregarPagamento(parcela.getPagamento().getId());
        }

        return pagamentosProcesso.stream()
                .filter(p -> p.getId() != null && !pagamentosUsados.contains(p.getId()))
                .filter(p -> !STATUS_PAGAMENTO_ENCERRADO.contains(p.getStatus()))
                .map(p -> new Scored<>(p, scorePagamentoParcela(contrato, parcela, p)))
                .filter(s -> s.score() > 0)
                .max(Comparator.comparingInt(Scored<PagamentoEntity>::score))
                .map(Scored::value)
                .orElse(null);
    }

    static int scorePagamentoParcela(
            ContratoHonorariosEntity contrato, ContratoHonorariosParcelaEntity parcela, PagamentoEntity pag) {
        if (parcela.getValor() == null || pag.getValor() == null) {
            return 0;
        }
        BigDecimal diff = pag.getValor().subtract(parcela.getValor()).abs();
        if (diff.compareTo(TOLERANCIA_VALOR) > 0) {
            return 0;
        }

        int score = diff.compareTo(BigDecimal.ZERO) == 0 ? 3 : 2;

        LocalDate vencParcela = parcela.getDataVencimento();
        LocalDate vencPag = pag.getDataVencimento();
        if (vencParcela != null && vencPag != null) {
            long dias = Math.abs(ChronoUnit.DAYS.between(vencParcela, vencPag));
            if (dias == 0) {
                score += 3;
            } else if (dias <= MAX_DIAS_DATA) {
                score += 1;
            }
        }

        String origemEsperada = "CONTRATO_HONORARIOS:" + contrato.getId();
        if (origemEsperada.equals(pag.getOrigem())) {
            score += 4;
        } else if (StringUtils.hasText(pag.getOrigem()) && pag.getOrigem().startsWith("CONTRATO_HONORARIOS:")) {
            score += 1;
        }

        if (StringUtils.hasText(pag.getDescricao())
                && pag.getDescricao().toLowerCase().contains("honorários contratuais")) {
            score += 2;
        }

        Integer numParcela = parcela.getNumeroParcela();
        if (numParcela != null && Objects.equals(pag.getRecorrenciaParcelaAtual(), numParcela)) {
            score += 2;
        }

        if (STATUS_RECEBER_RECEBIDO.contains(pag.getStatus())) {
            score += 1;
        }

        return score;
    }

    static Optional<LancamentoFinanceiroEntity> encontrarLancamentoParaParcela(
            ContratoHonorariosParcelaEntity parcela,
            List<LancamentoFinanceiroEntity> creditos,
            Set<Long> lancamentosUsados) {
        return creditos.stream()
                .filter(l -> l.getId() != null && !lancamentosUsados.contains(l.getId()))
                .map(l -> new Scored<>(l, scoreLancamentoParcela(parcela, l)))
                .filter(s -> s.score() >= 3)
                .max(Comparator.comparingInt(Scored<LancamentoFinanceiroEntity>::score))
                .map(Scored::value);
    }

    static int scoreLancamentoParcela(ContratoHonorariosParcelaEntity parcela, LancamentoFinanceiroEntity lancamento) {
        if (lancamento.getNatureza() != NaturezaLancamento.CREDITO) {
            return 0;
        }
        if (parcela.getValor() == null || lancamento.getValor() == null) {
            return 0;
        }
        BigDecimal diff = lancamento.getValor().abs().subtract(parcela.getValor()).abs();
        if (diff.compareTo(TOLERANCIA_VALOR) > 0) {
            return 0;
        }

        int score = diff.compareTo(BigDecimal.ZERO) == 0 ? 4 : 2;

        LocalDate ref = parcela.getDataVencimento();
        if (ref != null && lancamento.getDataLancamento() != null) {
            long dias = Math.abs(ChronoUnit.DAYS.between(ref, lancamento.getDataLancamento()));
            if (dias == 0) {
                score += 2;
            } else if (dias <= MAX_DIAS_DATA) {
                score += 1;
            }
        }

        return score;
    }

    static Optional<LancamentoFinanceiroEntity> encontrarLancamentoParaPagamento(
            PagamentoEntity pagamento,
            List<LancamentoFinanceiroEntity> creditos,
            Set<Long> lancamentosUsados) {
        if (pagamento.getFinanceiroLancamento() != null && pagamento.getFinanceiroLancamento().getId() != null) {
            return Optional.empty();
        }
        return creditos.stream()
                .filter(l -> l.getId() != null && !lancamentosUsados.contains(l.getId()))
                .map(l -> new Scored<>(l, scoreLancamentoPagamento(pagamento, l)))
                .filter(s -> s.score() >= 3)
                .max(Comparator.comparingInt(Scored<LancamentoFinanceiroEntity>::score))
                .map(Scored::value);
    }

    static int scoreLancamentoPagamento(PagamentoEntity pagamento, LancamentoFinanceiroEntity lancamento) {
        if (lancamento.getNatureza() != NaturezaLancamento.CREDITO) {
            return 0;
        }
        if (pagamento.getValor() == null || lancamento.getValor() == null) {
            return 0;
        }
        BigDecimal diff = lancamento.getValor().abs().subtract(pagamento.getValor()).abs();
        if (diff.compareTo(TOLERANCIA_VALOR) > 0) {
            return 0;
        }

        int score = diff.compareTo(BigDecimal.ZERO) == 0 ? 4 : 2;

        LocalDate refPag = pagamento.getDataRecebimento() != null
                ? pagamento.getDataRecebimento()
                : pagamento.getDataVencimento();
        if (refPag != null && lancamento.getDataLancamento() != null) {
            long dias = Math.abs(ChronoUnit.DAYS.between(refPag, lancamento.getDataLancamento()));
            if (dias == 0) {
                score += 2;
            } else if (dias <= MAX_DIAS_DATA) {
                score += 1;
            }
        }

        return score;
    }

    private static boolean precisaMarcarRecebido(PagamentoEntity pagamento) {
        String st = pagamento.getStatus();
        return PagamentoDominio.ST_EMITIDO.equals(st) || PagamentoDominio.ST_VENCIDO.equals(st);
    }

    private static boolean precisaConciliar(PagamentoEntity pagamento) {
        return PagamentoDominio.ST_RECEBIDO.equals(pagamento.getStatus())
                && pagamento.getFinanceiroLancamento() == null;
    }

    private PagamentoEntity recarregarPagamento(Long id) {
        if (id == null) {
            return null;
        }
        return pagamentoRepository.findById(id).orElse(null);
    }

    private record Scored<T>(T value, int score) {}
}
