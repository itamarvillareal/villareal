package br.com.vilareal.acoes.application;

import br.com.vilareal.acoes.api.dto.AcoesDoDiaResponse;
import br.com.vilareal.acoes.api.dto.AcoesDoDiaResponse.*;
import br.com.vilareal.calculo.api.dto.CalculoParcelamentoConsolidadoItem;
import br.com.vilareal.calculo.application.CalculoParcelamentosConsolidadoApplicationService;
import br.com.vilareal.documento.api.dto.CandidatoAlvaraCreditoResponse;
import br.com.vilareal.documento.api.dto.CandidatoAlvaraProcessoResponse;
import br.com.vilareal.documento.api.dto.RepassePendenteHonorarioCarteiraResponse;
import br.com.vilareal.documento.api.dto.RepassePendenteHonorarioItemResponse;
import br.com.vilareal.documento.application.HonorarioRepasseService;
import br.com.vilareal.imovel.api.dto.CreditoCandidatoAluguelItem;
import br.com.vilareal.imovel.api.dto.RepassePendenteCarteiraResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteItemResponse;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroItemResponse;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroResponse;
import br.com.vilareal.recebivel.application.RecebivelQuadroApplicationService;
import br.com.vilareal.recebivel.domain.RecebivelQuadroStatus;
import br.com.vilareal.recebivel.domain.RecebivelQuadroTipo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Painel derivado “Ações do Dia”: consolida A Receber, A Repassar e contratos a vencer — sem materializar.
 */
@Service
public class AcoesDoDiaApplicationService {

    private final RecebivelQuadroApplicationService quadroService;
    private final LocacaoReconciliacaoService locacaoReconciliacaoService;
    private final HonorarioRepasseService honorarioRepasseService;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final CalculoParcelamentosConsolidadoApplicationService parcelamentosConsolidadoService;
    private final Clock clock;

    public AcoesDoDiaApplicationService(
            RecebivelQuadroApplicationService quadroService,
            LocacaoReconciliacaoService locacaoReconciliacaoService,
            HonorarioRepasseService honorarioRepasseService,
            ContratoLocacaoRepository contratoLocacaoRepository,
            PagamentoRepository pagamentoRepository,
            CalculoParcelamentosConsolidadoApplicationService parcelamentosConsolidadoService,
            Clock clock) {
        this.quadroService = quadroService;
        this.locacaoReconciliacaoService = locacaoReconciliacaoService;
        this.honorarioRepasseService = honorarioRepasseService;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.parcelamentosConsolidadoService = parcelamentosConsolidadoService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AcoesDoDiaResponse obter(String competenciaParam) {
        YearMonth ym = StringUtils.hasText(competenciaParam)
                ? YearMonth.parse(competenciaParam.trim())
                : YearMonth.now(clock);
        String competencia = ym.toString();
        LocalDate hoje = LocalDate.now(clock);
        LocalDate inicio = ym.atDay(1);
        LocalDate fim = ym.atEndOfMonth();

        List<ItemConciliar> conciliar = montarConciliar(competencia, ym, hoje, inicio, fim);
        List<ItemCobrar> cobrar = montarCobrar(competencia, ym, hoje, inicio, fim);
        List<ItemRepassar> repassar = montarRepassar(competencia);
        List<ItemRenegociar> renegociar = montarRenegociar(hoje);
        List<ItemPagar> pagar = montarPagar(fim, hoje);

        return new AcoesDoDiaResponse(
                competencia,
                grupoConciliar(conciliar),
                grupoCobrar(cobrar),
                grupoRepassar(repassar),
                grupoRenegociar(renegociar),
                grupoPagar(pagar));
    }

    private List<ItemConciliar> montarConciliar(
            String competencia, YearMonth ym, LocalDate hoje, LocalDate inicio, LocalDate fim) {
        List<ItemConciliar> itens = new ArrayList<>();
        for (ContratoLocacaoEntity contrato :
                contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(competencia, inicio, fim)) {
            LocalDate vencimento =
                    RecebivelQuadroApplicationService.calcularVencimentoAluguel(contrato.getDiaVencimentoAluguel(), ym);
            if (!vencimento.isBefore(hoje)) {
                continue;
            }
            List<CreditoCandidatoAluguelItem> candidatos =
                    locacaoReconciliacaoService.creditosCandidatosAluguelSemClassificar(contrato.getId(), competencia);
            if (candidatos.isEmpty()) {
                continue;
            }
            int diasAtraso = diasEntre(vencimento, hoje);
            ImovelEntity imovel = contrato.getImovel();
            itens.add(new ItemConciliar(
                    "IMOVEL",
                    contrato.getId(),
                    imovel != null ? imovel.getNumeroPlanilha() : null,
                    imovel != null ? imovel.getEnderecoCompleto() : null,
                    nomePessoa(contrato.getLocadorPessoa()),
                    escala(contrato.getValorAluguel()),
                    vencimento,
                    diasAtraso,
                    null,
                    null,
                    null,
                    null,
                    null,
                    candidatos.stream()
                            .map(c -> new CandidatoCredito(
                                    c.lancamentoId(), c.data(), c.valor(), c.descricao(), null, null))
                            .toList()));
        }

        for (CandidatoAlvaraProcessoResponse grupo : honorarioRepasseService.candidatosAlvara()) {
            if (grupo.candidatos() == null || grupo.candidatos().isEmpty()) {
                continue;
            }
            LocalDate dataRef = grupo.candidatos().stream()
                    .map(CandidatoAlvaraCreditoResponse::data)
                    .filter(Objects::nonNull)
                    .min(LocalDate::compareTo)
                    .orElse(null);
            int dias = dataRef != null ? diasEntre(dataRef, hoje) : 0;
            BigDecimal valorRef = grupo.candidatos().stream()
                    .map(CandidatoAlvaraCreditoResponse::valor)
                    .filter(Objects::nonNull)
                    .max(BigDecimal::compareTo)
                    .orElse(BigDecimal.ZERO);
            itens.add(new ItemConciliar(
                    "ALVARA",
                    grupo.contratoHonorariosId(),
                    null,
                    null,
                    null,
                    escala(valorRef),
                    dataRef,
                    dias,
                    grupo.processoId(),
                    grupo.numeroInterno(),
                    grupo.codigoCliente(),
                    grupo.contratanteNome(),
                    grupo.percentualProveito(),
                    grupo.candidatos().stream()
                            .map(c -> new CandidatoCredito(
                                    c.lancamentoId(),
                                    c.data(),
                                    c.valor(),
                                    c.descricao(),
                                    c.retencao(),
                                    c.repasseEsperado()))
                            .toList()));
        }

        itens.sort(Comparator.comparingInt(ItemConciliar::diasEmAtraso).reversed()
                .thenComparing(ItemConciliar::origem)
                .thenComparing(ItemConciliar::imovelNumeroPlanilha, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(ItemConciliar::numeroInterno, Comparator.nullsLast(Integer::compareTo)));
        return itens;
    }

    private List<ItemCobrar> montarCobrar(
            String competencia, YearMonth ym, LocalDate hoje, LocalDate inicio, LocalDate fim) {
        List<ItemCobrar> itens = new ArrayList<>();

        for (ContratoLocacaoEntity contrato :
                contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(competencia, inicio, fim)) {
            LocalDate vencimento =
                    RecebivelQuadroApplicationService.calcularVencimentoAluguel(contrato.getDiaVencimentoAluguel(), ym);
            if (!vencimento.isBefore(hoje)) {
                continue;
            }
            List<CreditoCandidatoAluguelItem> candidatos =
                    locacaoReconciliacaoService.creditosCandidatosAluguelSemClassificar(contrato.getId(), competencia);
            if (!candidatos.isEmpty()) {
                continue;
            }
            ImovelEntity imovel = contrato.getImovel();
            String descricao = montarRotuloImovel(imovel, nomePessoa(contrato.getLocadorPessoa()));
            itens.add(new ItemCobrar(
                    descricao,
                    "ALUGUEL",
                    escala(contrato.getValorAluguel()),
                    vencimento,
                    diasEntre(vencimento, hoje),
                    contrato.getId(),
                    imovel != null ? imovel.getNumeroPlanilha() : null,
                    null,
                    null));
        }

        RecebivelQuadroResponse quadro = quadroService.quadro(null, inicio, fim);
        for (RecebivelQuadroItemResponse item : quadro.itens()) {
            if (item.status() != RecebivelQuadroStatus.VENCIDO) {
                continue;
            }
            int diasAtraso = item.vencimento() != null ? diasEntre(item.vencimento(), hoje) : 0;
            if (item.tipo() == RecebivelQuadroTipo.MENSALIDADE) {
                itens.add(new ItemCobrar(
                        item.descricao(),
                        "MENSALIDADE",
                        item.valor(),
                        item.vencimento(),
                        diasAtraso,
                        null,
                        null,
                        null,
                        null));
            } else if (item.tipo() == RecebivelQuadroTipo.HONORARIOS) {
                itens.add(new ItemCobrar(
                        item.descricao(),
                        "HONORARIOS",
                        item.valor(),
                        item.vencimento(),
                        diasAtraso,
                        item.refId(),
                        null,
                        null,
                        null));
            }
        }

        var acordosResp = parcelamentosConsolidadoService.listarConsolidado(
                null, List.of(), "vencidas", null, null, "diasAtraso", false, 0, 50);
        for (CalculoParcelamentoConsolidadoItem ap : acordosResp.itens()) {
            BigDecimal valor = escala(
                    BigDecimal.valueOf(ap.valorCentavos() + ap.honorariosCentavos()).movePointLeft(2));
            String desc = String.format(
                    "Acordo proc. %d dim. %d — parc. %d — %s",
                    ap.numeroProcesso(),
                    ap.dimensao(),
                    ap.parcelaNumero(),
                    ap.parteOposta() != null ? ap.parteOposta() : "—");
            itens.add(new ItemCobrar(
                    desc,
                    "ACORDO_PARCELA",
                    valor,
                    ap.dataVencimento(),
                    ap.diasAtraso(),
                    null,
                    null,
                    ap.codigoCliente(),
                    ap.numeroProcesso()));
        }

        itens.sort(Comparator.comparingInt(ItemCobrar::diasEmAtraso).reversed()
                .thenComparing(ItemCobrar::descricao, Comparator.nullsLast(String::compareToIgnoreCase)));
        return itens;
    }

    private List<ItemRepassar> montarRepassar(String competencia) {
        List<ItemRepassar> itens = new ArrayList<>();

        RepassePendenteCarteiraResponse carteiraImovel = locacaoReconciliacaoService.repassesPendentes(null);
        for (RepassePendenteItemResponse item : carteiraImovel.itens()) {
            itens.add(new ItemRepassar(
                    "IMOVEL",
                    item.contratoId(),
                    item.imovelNumeroPlanilha(),
                    item.imovelEndereco(),
                    item.locadorNome(),
                    item.competencia(),
                    escala(item.valorEmAberto()),
                    item.dadosBancariosRepasse(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null));
        }

        RepassePendenteHonorarioCarteiraResponse carteiraHonorario =
                honorarioRepasseService.repassesPendentesHonorario();
        for (RepassePendenteHonorarioItemResponse item : carteiraHonorario.itens()) {
            String comp = item.dataReferencia() != null
                    ? YearMonth.from(item.dataReferencia()).toString()
                    : null;
            itens.add(new ItemRepassar(
                    "PROCESSO",
                    item.contratoHonorariosId(),
                    null,
                    null,
                    null,
                    comp,
                    escala(item.valorEmAberto()),
                    null,
                    item.processoId(),
                    item.numeroInterno(),
                    item.codigoCliente(),
                    item.contratanteNome(),
                    item.alvaraLancamentoId(),
                    escala(item.valorAlvara()),
                    escala(item.retencao()),
                    escala(item.repasseEsperado())));
        }

        itens.sort(Comparator.comparing(ItemRepassar::competencia, Comparator.nullsLast(String::compareTo))
                .thenComparing(ItemRepassar::origem)
                .thenComparing(ItemRepassar::imovelNumeroPlanilha, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(ItemRepassar::numeroInterno, Comparator.nullsLast(Integer::compareTo)));
        return itens;
    }

    private List<ItemRenegociar> montarRenegociar(LocalDate hoje) {
        LocalDate limite = hoje.plusDays(60);
        List<ItemRenegociar> itens = new ArrayList<>();
        for (ContratoLocacaoEntity contrato :
                contratoLocacaoRepository.findVigentesComDataFimEntre(hoje, limite)) {
            ImovelEntity imovel = contrato.getImovel();
            int diasRestantes = diasEntre(hoje, contrato.getDataFim());
            itens.add(new ItemRenegociar(
                    contrato.getId(),
                    imovel != null ? imovel.getNumeroPlanilha() : null,
                    imovel != null ? imovel.getEnderecoCompleto() : null,
                    nomePessoa(contrato.getLocadorPessoa()),
                    contrato.getDataFim(),
                    diasRestantes,
                    escala(contrato.getValorAluguel())));
        }
        itens.sort(Comparator.comparingInt(ItemRenegociar::diasRestantes)
                .thenComparing(ItemRenegociar::imovelNumeroPlanilha, Comparator.nullsLast(Integer::compareTo)));
        return itens;
    }

    private List<ItemPagar> montarPagar(LocalDate fimCompetencia, LocalDate hoje) {
        List<ItemPagar> itens = new ArrayList<>();
        for (PagamentoEntity p : pagamentoRepository.findPagarAbertosAteVencimento(fimCompetencia)) {
            if (!PagamentoDominio.isTipoPagar(p.getTipo())) {
                continue;
            }
            String status = p.getStatus();
            if (!List.of(
                            PagamentoDominio.ST_PENDENTE,
                            PagamentoDominio.ST_AGENDADO,
                            PagamentoDominio.ST_VENCIDO)
                    .contains(status)) {
                continue;
            }
            LocalDate vencimento = p.getDataVencimento();
            if (vencimento == null || vencimento.isAfter(fimCompetencia)) {
                continue;
            }
            boolean vencido = vencimento.isBefore(hoje);
            ImovelEntity imovel = p.getImovel();
            ProcessoEntity processo = p.getProcesso();
            itens.add(new ItemPagar(
                    p.getId(),
                    p.getDescricao(),
                    p.getCategoria(),
                    escala(p.getValor()),
                    vencimento,
                    vencido,
                    imovel != null ? imovel.getId() : null,
                    imovel != null ? imovel.getNumeroPlanilha() : null,
                    p.getCliente() != null ? p.getCliente().getId() : null,
                    processo != null ? processo.getId() : null,
                    processo != null ? processo.getNumeroInterno() : null));
        }
        itens.sort(Comparator.comparing(ItemPagar::vencido).reversed()
                .thenComparing(ItemPagar::vencimento)
                .thenComparing(ItemPagar::pagamentoId));
        return itens;
    }

    private static GrupoConciliar grupoConciliar(List<ItemConciliar> itens) {
        BigDecimal total = itens.stream()
                .map(i -> {
                    if ("ALVARA".equals(i.origem())) {
                        return i.candidatos().stream()
                                .map(CandidatoCredito::valor)
                                .filter(Objects::nonNull)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                    }
                    return i.valorAluguel() != null ? i.valorAluguel() : BigDecimal.ZERO;
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new GrupoConciliar(itens.size(), escala(total), itens);
    }

    private static GrupoCobrar grupoCobrar(List<ItemCobrar> itens) {
        BigDecimal total = itens.stream().map(ItemCobrar::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new GrupoCobrar(itens.size(), escala(total), itens);
    }

    private static GrupoRepassar grupoRepassar(List<ItemRepassar> itens) {
        BigDecimal total = itens.stream().map(ItemRepassar::valorEmAberto).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new GrupoRepassar(itens.size(), escala(total), itens);
    }

    private static GrupoRenegociar grupoRenegociar(List<ItemRenegociar> itens) {
        BigDecimal total = itens.stream()
                .map(ItemRenegociar::valorAluguel)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new GrupoRenegociar(itens.size(), escala(total), itens);
    }

    private static GrupoPagar grupoPagar(List<ItemPagar> itens) {
        BigDecimal total = itens.stream().map(ItemPagar::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new GrupoPagar(itens.size(), escala(total), itens);
    }

    private static int diasEntre(LocalDate inicio, LocalDate fim) {
        if (inicio == null || fim == null) {
            return 0;
        }
        return (int) ChronoUnit.DAYS.between(inicio, fim);
    }

    private static String montarRotuloImovel(ImovelEntity imovel, String locador) {
        StringBuilder sb = new StringBuilder();
        if (imovel != null && imovel.getNumeroPlanilha() != null) {
            sb.append('#').append(imovel.getNumeroPlanilha());
        }
        if (imovel != null && StringUtils.hasText(imovel.getEnderecoCompleto())) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append(imovel.getEnderecoCompleto().trim());
        }
        if (StringUtils.hasText(locador)) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append(locador);
        }
        return !sb.isEmpty() ? sb.toString() : "Aluguel";
    }

    private static String nomePessoa(PessoaEntity pessoa) {
        if (pessoa == null || !StringUtils.hasText(pessoa.getNome())) {
            return null;
        }
        return pessoa.getNome().trim();
    }

    private static BigDecimal escala(BigDecimal v) {
        if (v == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return v.setScale(2, RoundingMode.HALF_UP);
    }
}
