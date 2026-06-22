package br.com.vilareal.documento;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.api.dto.AplicarSugestaoRequest;
import br.com.vilareal.financeiro.application.FinanceiroSugestaoService;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pagamento.api.dto.PagamentoConciliacaoVincularRequest;
import br.com.vilareal.pagamento.api.dto.PagamentoMarcarRecebidoRequest;
import br.com.vilareal.pagamento.api.dto.PagamentoWriteRequest;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.application.PagamentoConciliacaoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.processo.application.ProcessoPartesVinculoTextoResolver;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
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
    static final int MIN_SCORE_SUGESTAO = 3;
    static final int JANELA_DIAS_ORFAO = 45;
    static final int GAP_MINIMO_SCORE_AUTO = 2;
    static final String CONTA_ESCRITORIO_CODIGO = "A";

    private static final Set<String> STATUS_PAGAMENTO_ENCERRADO =
            Set.of(PagamentoDominio.ST_CANCELADO, PagamentoDominio.ST_SUBSTITUIDO);

    private static final Set<String> STATUS_RECEBER_RECEBIDO =
            Set.of(PagamentoDominio.ST_RECEBIDO, PagamentoDominio.ST_CONCILIADO);

    private final ContratoHonorariosRepository contratoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final LancamentoFinanceiroRepository lancamentoFinanceiroRepository;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final PagamentoConciliacaoApplicationService pagamentoConciliacaoApplicationService;
    private final ProcessoParteRepository processoParteRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final FinanceiroSugestaoService financeiroSugestaoService;

    public ContratoHonorariosRecebiveisConciliacaoService(
            ContratoHonorariosRepository contratoRepository,
            PagamentoRepository pagamentoRepository,
            LancamentoFinanceiroRepository lancamentoFinanceiroRepository,
            PagamentoApplicationService pagamentoApplicationService,
            PagamentoConciliacaoApplicationService pagamentoConciliacaoApplicationService,
            ProcessoParteRepository processoParteRepository,
            ContaContabilRepository contaContabilRepository,
            FinanceiroSugestaoService financeiroSugestaoService) {
        this.contratoRepository = contratoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.lancamentoFinanceiroRepository = lancamentoFinanceiroRepository;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.pagamentoConciliacaoApplicationService = pagamentoConciliacaoApplicationService;
        this.processoParteRepository = processoParteRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.financeiroSugestaoService = financeiroSugestaoService;
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

    @Transactional(readOnly = true)
    public List<ContratoHonorariosSugestaoFinanceiroResponse> listarSugestoesFinanceiro(
            Long processoId, Long pessoaId, LocalDate de, LocalDate ate) {
        List<ContratoHonorariosEntity> contratos = contratoRepository.listarComFiltros(processoId, pessoaId, de, ate);
        Set<Long> lancamentosUsados = new HashSet<>();
        List<ContratoHonorariosSugestaoFinanceiroResponse> sugestoes = new ArrayList<>();

        for (ContratoHonorariosEntity contrato : contratos) {
            if (contrato.getProcesso() == null || contrato.getProcesso().getId() == null) {
                continue;
            }
            Long pid = contrato.getProcesso().getId();
            List<ProcessoParteEntity> partes =
                    processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(pid);
            List<LancamentoFinanceiroEntity> creditosProcesso =
                    lancamentoFinanceiroRepository.findCreditosNaoVinculadosPorProcesso(pid);

            for (ParcelaConciliacao parcela : resolverParcelasConciliacao(contrato)) {
                if (parcelaJaQuitada(parcela)) {
                    continue;
                }
                LocalDate ref = parcela.dataVencimento() != null ? parcela.dataVencimento() : contrato.getDataContrato();
                LocalDate inicio = ref != null ? ref.minusDays(JANELA_DIAS_ORFAO) : LocalDate.now().minusMonths(3);
                LocalDate fim = ref != null ? ref.plusDays(JANELA_DIAS_ORFAO) : LocalDate.now().plusDays(JANELA_DIAS_ORFAO);
                BigDecimal valorMin = parcela.valor().subtract(TOLERANCIA_VALOR);
                BigDecimal valorMax = parcela.valor().add(TOLERANCIA_VALOR);

                List<LancamentoFinanceiroEntity> candidatos = new ArrayList<>(creditosProcesso);
                candidatos.addAll(lancamentoFinanceiroRepository.findCreditosOrfaosCandidatosHonorarios(
                        valorMin.max(BigDecimal.ZERO), valorMax, inicio, fim));

                Optional<Scored<LancamentoFinanceiroEntity>> melhor = candidatos.stream()
                        .filter(l -> l.getId() != null && !lancamentosUsados.contains(l.getId()))
                        .map(l -> new Scored<>(
                                l,
                                scoreLancamentoSugestao(contrato, parcela, l, partes)))
                        .filter(s -> s.score() >= MIN_SCORE_SUGESTAO)
                        .max(Comparator.comparingInt(Scored<LancamentoFinanceiroEntity>::score));

                if (melhor.isEmpty()) {
                    continue;
                }

                LancamentoFinanceiroEntity lanc = melhor.get().value();
                lancamentosUsados.add(lanc.getId());
                ProcessoEntity processo = contrato.getProcesso();
                String nome = resolverNomeExibicao(contrato, partes);
                sugestoes.add(new ContratoHonorariosSugestaoFinanceiroResponse(
                        contrato.getId(),
                        pid,
                        processo.getCliente() != null ? processo.getCliente().getCodigoCliente() : null,
                        processo.getNumeroInterno(),
                        nome,
                        parcela.parcelaId(),
                        parcela.numeroParcela(),
                        parcela.valor(),
                        parcela.dataVencimento(),
                        lanc.getId(),
                        lanc.getValor() != null ? lanc.getValor().abs() : null,
                        lanc.getDataLancamento(),
                        lanc.getDescricao(),
                        lanc.getNumeroBanco(),
                        lanc.getBancoNome(),
                        lanc.getProcesso() == null,
                        melhor.get().score(),
                        montarMotivoSugestao(parcela, lanc, melhor.get().score())));
            }
        }

        sugestoes.sort(Comparator.comparingInt(ContratoHonorariosSugestaoFinanceiroResponse::score).reversed());
        return sugestoes;
    }

    @Transactional
    public ContratoHonorariosAprovarSugestaoResponse aprovarSugestaoFinanceiro(
            ContratoHonorariosAprovarSugestaoRequest req) {
        ContratoHonorariosEntity contrato = contratoRepository
                .findById(req.contratoId())
                .orElseThrow(() -> new ResourceNotFoundException("Contrato não encontrado: " + req.contratoId()));
        if (contrato.getProcesso() == null || contrato.getProcesso().getId() == null) {
            throw new BusinessRuleException("Contrato sem processo vinculado.");
        }
        contrato = contratoRepository
                .findByProcessoIdWithDetalhes(contrato.getProcesso().getId())
                .orElse(contrato);

        ContratoHonorariosParcelaEntity parcela = ensureParcelaContrato(contrato, req.numeroParcela());
        LancamentoFinanceiroEntity lancamento = lancamentoFinanceiroRepository
                .findById(req.financeiroLancamentoId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Lançamento financeiro não encontrado: " + req.financeiroLancamentoId()));

        validarLancamentoCandidato(contrato, parcela, lancamento);

        ProcessoEntity processo = contrato.getProcesso();
        if (lancamento.getProcesso() == null) {
            classificarLancamentoNoProcesso(lancamento, processo);
            lancamento = lancamentoFinanceiroRepository.findById(lancamento.getId()).orElse(lancamento);
        } else if (!Objects.equals(lancamento.getProcesso().getId(), processo.getId())) {
            throw new BusinessRuleException("Lançamento já classificado em outro processo.");
        }

        PagamentoEntity pagamento;
        if (parcela.getPagamento() == null || parcela.getPagamento().getId() == null) {
            pagamento = registrarRecebivelDeFinanceiro(contrato, parcela, lancamento);
        } else {
            pagamento = recarregarPagamento(parcela.getPagamento().getId());
            if (pagamento == null) {
                throw new BusinessRuleException("Pagamento da parcela não encontrado.");
            }
            if (precisaMarcarRecebido(pagamento)) {
                PagamentoMarcarRecebidoRequest recebido = new PagamentoMarcarRecebidoRequest();
                recebido.setDataRecebimento(lancamento.getDataLancamento());
                recebido.setValorRecebido(lancamento.getValor().abs());
                pagamentoApplicationService.marcarRecebido(pagamento.getId(), recebido);
                pagamento = recarregarPagamento(pagamento.getId());
            }
            if (pagamento != null && precisaConciliar(pagamento)) {
                PagamentoConciliacaoVincularRequest conc = new PagamentoConciliacaoVincularRequest();
                conc.setPagamentoId(pagamento.getId());
                conc.setFinanceiroLancamentoId(lancamento.getId());
                pagamentoConciliacaoApplicationService.vincularConciliacao(conc);
                pagamento = recarregarPagamento(pagamento.getId());
            }
        }

        contratoRepository.save(contrato);
        return new ContratoHonorariosAprovarSugestaoResponse(
                pagamento != null ? pagamento.getId() : null,
                pagamento != null ? pagamento.getStatus() : null,
                lancamento.getId(),
                "Recebível vinculado ao financeiro com sucesso.");
    }

    /**
     * Pós-import manual (upload OFX/PDF): auto-concilia honorários inequívocos entre créditos recém-criados.
     * Ambíguos permanecem para {@link #listarSugestoesFinanceiro}. Idempotente e reversível.
     */
    @Transactional
    public HonorariosPosImportResult conciliarHonorariosPosImport(List<Long> lancamentoIds) {
        if (lancamentoIds == null || lancamentoIds.isEmpty()) {
            return HonorariosPosImportResult.vazio();
        }

        Set<Long> idsSolicitados = new HashSet<>(lancamentoIds);
        List<LancamentoFinanceiroEntity> creditosNovos = lancamentoFinanceiroRepository.findAllByIdIn(idsSolicitados).stream()
                .filter(l -> l.getId() != null && idsSolicitados.contains(l.getId()))
                .filter(l -> "ATIVO".equals(l.getStatus()))
                .filter(l -> l.getNatureza() == NaturezaLancamento.CREDITO)
                .toList();
        if (creditosNovos.isEmpty()) {
            return HonorariosPosImportResult.vazio();
        }

        int autoConciliados = 0;
        int ambiguos = 0;
        List<String> erros = new ArrayList<>();
        Set<Long> lancamentosUsados = new HashSet<>();

        List<ContratoHonorariosEntity> contratos = contratoRepository.listarComFiltros(null, null, null, null);
        for (ContratoHonorariosEntity contrato : contratos) {
            if (contrato.getProcesso() == null || contrato.getProcesso().getId() == null) {
                continue;
            }
            Long pid = contrato.getProcesso().getId();
            List<ProcessoParteEntity> partes =
                    processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(pid);

            for (ParcelaConciliacao parcela : resolverParcelasConciliacao(contrato)) {
                if (parcelaJaQuitada(parcela)) {
                    continue;
                }

                List<Scored<LancamentoFinanceiroEntity>> rankeados =
                        rankearCandidatosHonorariosPosImport(contrato, parcela, partes, creditosNovos, lancamentosUsados);
                if (rankeados.isEmpty()) {
                    continue;
                }

                Scored<LancamentoFinanceiroEntity> melhor = rankeados.get(0);
                int segundoScore = rankeados.size() > 1 ? rankeados.get(1).score() : 0;
                if (!inequivocoParaAutoPosImport(melhor.score(), segundoScore, rankeados.size())) {
                    ambiguos++;
                    continue;
                }

                try {
                    aprovarSugestaoFinanceiro(new ContratoHonorariosAprovarSugestaoRequest(
                            contrato.getId(), parcela.numeroParcela(), melhor.value().getId()));
                    lancamentosUsados.add(melhor.value().getId());
                    autoConciliados++;
                    log.info(
                            "Honorários pós-import AUTO contrato={} parcela={} lancamento={} score={}",
                            contrato.getId(),
                            parcela.numeroParcela(),
                            melhor.value().getId(),
                            melhor.score());
                } catch (Exception ex) {
                    String msg = "contrato "
                            + contrato.getId()
                            + " parcela "
                            + parcela.numeroParcela()
                            + ": "
                            + mensagemRaiz(ex);
                    log.warn("Honorários pós-import falhou ({}): {}", melhor.value().getId(), msg);
                    erros.add(msg);
                }
            }
        }

        return HonorariosPosImportResult.of(autoConciliados, ambiguos, erros);
    }

    static List<Scored<LancamentoFinanceiroEntity>> rankearCandidatosHonorariosPosImport(
            ContratoHonorariosEntity contrato,
            ParcelaConciliacao parcela,
            List<ProcessoParteEntity> partes,
            List<LancamentoFinanceiroEntity> creditosNovos,
            Set<Long> lancamentosUsados) {
        Long processoId = contrato.getProcesso() != null ? contrato.getProcesso().getId() : null;
        return creditosNovos.stream()
                .filter(l -> l.getId() != null && !lancamentosUsados.contains(l.getId()))
                .filter(l -> creditoNovoCompativelParcela(contrato, parcela, l, processoId))
                .map(l -> new Scored<>(l, scoreLancamentoSugestao(contrato, parcela, l, partes)))
                .filter(s -> s.score() >= MIN_SCORE_SUGESTAO)
                .sorted(Comparator.comparingInt(Scored<LancamentoFinanceiroEntity>::score).reversed())
                .toList();
    }

    static boolean inequivocoParaAutoPosImport(int melhorScore, int segundoScore, int totalCandidatos) {
        if (melhorScore < MIN_SCORE_SUGESTAO || totalCandidatos < 1) {
            return false;
        }
        return totalCandidatos == 1 || melhorScore - segundoScore >= GAP_MINIMO_SCORE_AUTO;
    }

    static boolean creditoNovoCompativelParcela(
            ContratoHonorariosEntity contrato,
            ParcelaConciliacao parcela,
            LancamentoFinanceiroEntity lancamento,
            Long processoId) {
        if (parcela.valor() == null || lancamento.getValor() == null) {
            return false;
        }
        BigDecimal diff = lancamento.getValor().abs().subtract(parcela.valor()).abs();
        if (diff.compareTo(TOLERANCIA_VALOR) > 0) {
            return false;
        }
        LocalDate ref = parcela.dataVencimento() != null ? parcela.dataVencimento() : contrato.getDataContrato();
        if (ref != null && lancamento.getDataLancamento() != null) {
            LocalDate inicio = ref.minusDays(JANELA_DIAS_ORFAO);
            LocalDate fim = ref.plusDays(JANELA_DIAS_ORFAO);
            if (lancamento.getDataLancamento().isBefore(inicio) || lancamento.getDataLancamento().isAfter(fim)) {
                return false;
            }
        }
        if (lancamento.getProcesso() != null && processoId != null) {
            return Objects.equals(lancamento.getProcesso().getId(), processoId);
        }
        return lancamento.getProcesso() == null;
    }

    private static String mensagemRaiz(Throwable ex) {
        Throwable t = ex;
        String last = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
            if (t.getMessage() != null && !t.getMessage().isBlank()) {
                last = t.getMessage();
            }
        }
        return last;
    }

    static boolean parcelaJaQuitada(ParcelaConciliacao parcela) {
        if (parcela.pagamentoFinanceiroLancamentoId() != null) {
            return true;
        }
        String st = parcela.pagamentoStatus();
        return st != null && STATUS_RECEBER_RECEBIDO.contains(st);
    }

    static List<ParcelaConciliacao> resolverParcelasConciliacao(ContratoHonorariosEntity contrato) {
        if (contrato.getParcelas() != null && !contrato.getParcelas().isEmpty()) {
            return contrato.getParcelas().stream()
                    .sorted(Comparator.comparing(
                            ContratoHonorariosParcelaEntity::getNumeroParcela, Comparator.nullsLast(Integer::compareTo)))
                    .map(p -> {
                        PagamentoEntity pag = p.getPagamento();
                        Long finId = null;
                        String status = null;
                        if (pag != null) {
                            status = pag.getStatus();
                            if (pag.getFinanceiroLancamento() != null) {
                                finId = pag.getFinanceiroLancamento().getId();
                            }
                        }
                        return new ParcelaConciliacao(
                                p.getId(),
                                p.getNumeroParcela(),
                                p.getValor(),
                                p.getDataVencimento(),
                                pag != null ? pag.getId() : null,
                                status,
                                finId);
                    })
                    .toList();
        }
        if (!parcelamentoAtivoContrato(contrato)
                && contrato.getValorFixo() != null
                && contrato.getValorFixo().compareTo(BigDecimal.ZERO) > 0) {
            LocalDate venc = contrato.getDataContrato() != null ? contrato.getDataContrato() : LocalDate.now();
            return List.of(new ParcelaConciliacao(null, 1, contrato.getValorFixo(), venc, null, null, null));
        }
        if (parcelamentoAtivoContrato(contrato)) {
            ContratoHonorariosClausula3Dados dados = ContratoHonorariosPersistenciaService.montarClausula3Dados(contrato);
            return ContratoHonorariosClausula3TextoBuilder.calcularParcelas(dados).stream()
                    .map(p -> new ParcelaConciliacao(
                            null, p.numero(), p.valor(), p.dataVencimento(), null, null, null))
                    .toList();
        }
        return List.of();
    }

    static boolean parcelamentoAtivoContrato(ContratoHonorariosEntity contrato) {
        if (Boolean.TRUE.equals(contrato.getGerarRecebiveis())) {
            return true;
        }
        return contrato.getValorTotalParcelas() != null
                && contrato.getQuantidadeParcelas() != null
                && contrato.getQuantidadeParcelas() > 0;
    }

    private ContratoHonorariosParcelaEntity ensureParcelaContrato(
            ContratoHonorariosEntity contrato, Integer numeroParcela) {
        if (contrato.getParcelas() == null) {
            contrato.setParcelas(new ArrayList<>());
        }
        for (ContratoHonorariosParcelaEntity p : contrato.getParcelas()) {
            if (Objects.equals(p.getNumeroParcela(), numeroParcela)) {
                return p;
            }
        }
        ParcelaConciliacao ref = resolverParcelasConciliacao(contrato).stream()
                .filter(p -> Objects.equals(p.numeroParcela(), numeroParcela))
                .findFirst()
                .orElseThrow(() -> new BusinessRuleException("Parcela " + numeroParcela + " não encontrada no contrato."));

        ContratoHonorariosParcelaEntity pe = new ContratoHonorariosParcelaEntity();
        pe.setContrato(contrato);
        pe.setNumeroParcela(numeroParcela);
        pe.setValor(ref.valor());
        pe.setDataVencimento(ref.dataVencimento());
        contrato.getParcelas().add(pe);
        return contratoRepository.save(contrato).getParcelas().stream()
                .filter(p -> Objects.equals(p.getNumeroParcela(), numeroParcela))
                .findFirst()
                .orElse(pe);
    }

    private void validarLancamentoCandidato(
            ContratoHonorariosEntity contrato,
            ContratoHonorariosParcelaEntity parcela,
            LancamentoFinanceiroEntity lancamento) {
        if (lancamento.getNatureza() != NaturezaLancamento.CREDITO) {
            throw new BusinessRuleException("Somente créditos podem ser vinculados a honorários.");
        }
        ParcelaConciliacao ref = new ParcelaConciliacao(
                parcela.getId(),
                parcela.getNumeroParcela(),
                parcela.getValor(),
                parcela.getDataVencimento(),
                parcela.getPagamento() != null ? parcela.getPagamento().getId() : null,
                parcela.getPagamento() != null ? parcela.getPagamento().getStatus() : null,
                null);
        List<ProcessoParteEntity> partes = processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(
                contrato.getProcesso().getId());
        int score = scoreLancamentoSugestao(contrato, ref, lancamento, partes);
        if (score < MIN_SCORE_SUGESTAO) {
            throw new BusinessRuleException("Lançamento não é compatível com a parcela (score " + score + ").");
        }
        if (pagamentoRepository.existsByFinanceiroLancamento_Id(lancamento.getId())) {
            Long pagParcelaId = parcela.getPagamento() != null ? parcela.getPagamento().getId() : null;
            if (pagParcelaId == null
                    || pagamentoRepository.existsByFinanceiroLancamento_IdAndIdNot(lancamento.getId(), pagParcelaId)) {
                throw new BusinessRuleException("Lançamento já vinculado a outro recebível.");
            }
        }
    }

    private void classificarLancamentoNoProcesso(LancamentoFinanceiroEntity lancamento, ProcessoEntity processo) {
        ContaContabilEntity contaA = contaContabilRepository
                .findFirstByCodigoIgnoreCase(CONTA_ESCRITORIO_CODIGO)
                .orElseThrow(() -> new BusinessRuleException(
                        "Conta contábil «" + CONTA_ESCRITORIO_CODIGO + "» (Escritório) não cadastrada."));
        AplicarSugestaoRequest req = new AplicarSugestaoRequest();
        req.setLancamentoId(lancamento.getId());
        req.setContaContabilId(contaA.getId());
        req.setProcessoId(processo.getId());
        if (processo.getCliente() != null) {
            req.setClienteId(processo.getCliente().getId());
        }
        financeiroSugestaoService.aplicarSugestao(req);
    }

    static int scoreLancamentoSugestao(
            ContratoHonorariosEntity contrato,
            ParcelaConciliacao parcela,
            LancamentoFinanceiroEntity lancamento,
            List<ProcessoParteEntity> partes) {
        ContratoHonorariosParcelaEntity pe = new ContratoHonorariosParcelaEntity();
        pe.setNumeroParcela(parcela.numeroParcela());
        pe.setValor(parcela.valor());
        pe.setDataVencimento(parcela.dataVencimento());
        int score = scoreLancamentoParcela(pe, lancamento);
        score += bonusNomeNaDescricao(contrato, partes, lancamento);
        if (lancamento.getProcesso() != null
                && contrato.getProcesso() != null
                && Objects.equals(lancamento.getProcesso().getId(), contrato.getProcesso().getId())) {
            score += 2;
        }
        return score;
    }

    static int bonusNomeNaDescricao(
            ContratoHonorariosEntity contrato,
            List<ProcessoParteEntity> partes,
            LancamentoFinanceiroEntity lancamento) {
        String desc = normalizarTextoBusca(lancamento.getDescricao());
        if (!StringUtils.hasText(desc)) {
            return 0;
        }
        int bonus = 0;
        if (contrato.getPessoa() != null && nomeAparece(desc, contrato.getPessoa().getNome())) {
            bonus += 2;
        }
        if (contrato.getProcesso() != null && partes != null) {
            String parteCliente = ProcessoPartesVinculoTextoResolver.parteCliente(contrato.getProcesso(), partes);
            if (nomeAparece(desc, parteCliente)) {
                bonus += 3;
            }
            if (contrato.getProcesso().getPessoa() != null
                    && nomeAparece(desc, contrato.getProcesso().getPessoa().getNome())) {
                bonus += 2;
            }
        }
        return bonus;
    }

    static boolean nomeAparece(String descNorm, String nome) {
        if (!StringUtils.hasText(nome) || !StringUtils.hasText(descNorm)) {
            return false;
        }
        String n = normalizarTextoBusca(nome);
        if (n.length() < 4) {
            return false;
        }
        if (descNorm.contains(n)) {
            return true;
        }
        String[] tokens = n.split(" ");
        if (tokens.length >= 2) {
            String primeiroUltimo = tokens[0] + " " + tokens[tokens.length - 1];
            return descNorm.contains(primeiroUltimo);
        }
        return false;
    }

    static String normalizarTextoBusca(String s) {
        if (!StringUtils.hasText(s)) {
            return "";
        }
        return java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("\\s+", " ")
                .trim();
    }

    static String montarMotivoSugestao(ParcelaConciliacao parcela, LancamentoFinanceiroEntity lanc, int score) {
        String valor = parcela.valor() != null ? parcela.valor().toPlainString() : "?";
        String data = lanc.getDataLancamento() != null ? lanc.getDataLancamento().toString() : "?";
        String banco = StringUtils.hasText(lanc.getBancoNome()) ? lanc.getBancoNome().trim() : "banco";
        String base = "Crédito de R$ " + valor + " em " + data + " (" + banco + ")";
        if (lanc.getProcesso() == null) {
            return base + " — ainda na Conta N; ao aprovar, classifica no processo e concilia.";
        }
        return base + " — compatível com a parcela (score " + score + ").";
    }

    private String resolverNomeExibicao(ContratoHonorariosEntity contrato, List<ProcessoParteEntity> partes) {
        if (contrato.getProcesso() != null && partes != null && !partes.isEmpty()) {
            String parte = ProcessoPartesVinculoTextoResolver.parteCliente(contrato.getProcesso(), partes);
            if (StringUtils.hasText(parte)) {
                return parte;
            }
        }
        return contrato.getPessoa() != null ? contrato.getPessoa().getNome() : "";
    }

    record ParcelaConciliacao(
            Long parcelaId,
            Integer numeroParcela,
            BigDecimal valor,
            LocalDate dataVencimento,
            Long pagamentoId,
            String pagamentoStatus,
            Long pagamentoFinanceiroLancamentoId) {}

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
