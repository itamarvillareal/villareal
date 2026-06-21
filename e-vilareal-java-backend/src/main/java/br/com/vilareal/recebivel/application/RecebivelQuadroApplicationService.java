package br.com.vilareal.recebivel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosParcelaRepository;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.iptu.application.IptuApplicationService;
import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuParcelaEntity;
import br.com.vilareal.iptu.infrastructure.persistence.repository.IptuParcelaRepository;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroItemResponse;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroResponse;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroResumoTipoResponse;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Quadro consolidado de recebíveis — leitura derivada de {@code pagamento}, parcelas de honorários,
 * {@code iptu_parcela} e expectativa de aluguel ({@code contrato_locacao}), sem materializar saldo.
 */
@Service
public class RecebivelQuadroApplicationService {

    private static final String PREFIXO_ORIGEM_HONORARIOS = "CONTRATO_HONORARIOS:";
    private static final String PREFIXO_ORIGEM_LOCACAO = "LOCACAO:";
    private static final int DIA_VENCIMENTO_ALUGUEL_DEFAULT = 10;

    private final PagamentoRepository pagamentoRepository;
    private final ContratoHonorariosParcelaRepository honorariosParcelaRepository;
    private final IptuParcelaRepository iptuParcelaRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoReconciliacaoService locacaoReconciliacaoService;
    private final Clock clock;

    public RecebivelQuadroApplicationService(
            PagamentoRepository pagamentoRepository,
            ContratoHonorariosParcelaRepository honorariosParcelaRepository,
            IptuParcelaRepository iptuParcelaRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoReconciliacaoService locacaoReconciliacaoService,
            Clock clock) {
        this.pagamentoRepository = pagamentoRepository;
        this.honorariosParcelaRepository = honorariosParcelaRepository;
        this.iptuParcelaRepository = iptuParcelaRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.locacaoReconciliacaoService = locacaoReconciliacaoService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public RecebivelQuadroResponse quadro(String periodo, LocalDate inicio, LocalDate fim) {
        Intervalo intervalo = resolverIntervalo(periodo, inicio, fim);
        LocalDate hoje = LocalDate.now(clock);

        List<RecebivelQuadroItemResponse> itens = new ArrayList<>();
        for (PagamentoEntity p : pagamentoRepository.findReceberAbertosNoPeriodo(intervalo.inicio(), intervalo.fim())) {
            itens.add(fromPagamento(p, hoje));
        }
        for (ContratoHonorariosParcelaEntity par :
                honorariosParcelaRepository.findAbertasSemPagamentoNoPeriodo(intervalo.inicio(), intervalo.fim())) {
            itens.add(fromHonorariosParcela(par, hoje));
        }
        for (IptuParcelaEntity par : iptuParcelaRepository.findAbertasNoPeriodo(intervalo.inicio(), intervalo.fim())) {
            itens.add(fromIptuParcela(par, hoje));
        }
        Set<String> aluguelRecebido = locacaoReconciliacaoService.chavesContratoCompetenciaComAluguelRecebido();
        for (ContratoLocacaoEntity contrato :
                contratoLocacaoRepository.findVigentesNoPeriodo(intervalo.inicio(), intervalo.fim())) {
            itens.addAll(fromLocacaoAluguelEsperado(contrato, intervalo, hoje, aluguelRecebido));
        }

        itens.sort(Comparator.comparing(RecebivelQuadroItemResponse::vencimento, Comparator.nullsLast(LocalDate::compareTo))
                .thenComparing(RecebivelQuadroItemResponse::refId, Comparator.nullsLast(Long::compareTo)));

        Map<RecebivelQuadroTipo, ResumoAcumulador> acum = new EnumMap<>(RecebivelQuadroTipo.class);
        for (RecebivelQuadroTipo tipo : RecebivelQuadroTipo.values()) {
            acum.put(tipo, new ResumoAcumulador());
        }
        BigDecimal totalGeral = BigDecimal.ZERO;
        BigDecimal totalVencido = BigDecimal.ZERO;
        for (RecebivelQuadroItemResponse item : itens) {
            ResumoAcumulador r = acum.get(item.tipo());
            r.quantidade++;
            if (item.status() != RecebivelQuadroStatus.RECEBIDO) {
                r.total = r.total.add(item.valor());
                totalGeral = totalGeral.add(item.valor());
            }
            if (item.status() == RecebivelQuadroStatus.VENCIDO) {
                r.totalVencido = r.totalVencido.add(item.valor());
                totalVencido = totalVencido.add(item.valor());
            }
        }

        List<RecebivelQuadroResumoTipoResponse> resumoPorTipo = new ArrayList<>();
        for (RecebivelQuadroTipo tipo : List.of(
                RecebivelQuadroTipo.MENSALIDADE,
                RecebivelQuadroTipo.HONORARIOS,
                RecebivelQuadroTipo.ALUGUEL,
                RecebivelQuadroTipo.IPTU,
                RecebivelQuadroTipo.OUTRO)) {
            ResumoAcumulador r = acum.get(tipo);
            resumoPorTipo.add(new RecebivelQuadroResumoTipoResponse(
                    tipo, r.quantidade, escala(r.total), escala(r.totalVencido)));
        }

        return new RecebivelQuadroResponse(
                intervalo.inicio(),
                intervalo.fim(),
                escala(totalGeral),
                escala(totalVencido),
                resumoPorTipo,
                itens);
    }

    private record Intervalo(LocalDate inicio, LocalDate fim) {}

    private static final class ResumoAcumulador {
        int quantidade;
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal totalVencido = BigDecimal.ZERO;
    }

    private Intervalo resolverIntervalo(String periodo, LocalDate inicio, LocalDate fim) {
        if (inicio != null || fim != null) {
            if (inicio == null || fim == null) {
                throw new BusinessRuleException("Informe inicio e fim juntos (AAAA-MM-DD) ou use periodo=ESTE_MES|PROXIMO_MES.");
            }
            if (fim.isBefore(inicio)) {
                throw new BusinessRuleException("Data fim anterior à data início.");
            }
            return new Intervalo(inicio, fim);
        }
        YearMonth ym = YearMonth.from(LocalDate.now(clock));
        if (StringUtils.hasText(periodo) && "PROXIMO_MES".equalsIgnoreCase(periodo.trim())) {
            ym = ym.plusMonths(1);
        }
        return new Intervalo(ym.atDay(1), ym.atEndOfMonth());
    }

    private RecebivelQuadroItemResponse fromPagamento(PagamentoEntity p, LocalDate hoje) {
        RecebivelQuadroTipo tipo = tipoDePagamento(p);
        RecebivelQuadroStatus status = statusItem(hoje, p.getDataVencimento(), statusPagamentoRecebido(p));
        return new RecebivelQuadroItemResponse(
                descricaoPagamento(p),
                tipo,
                p.getDataVencimento(),
                escala(p.getValor()),
                status,
                "PAGAMENTO",
                p.getId());
    }

    private RecebivelQuadroItemResponse fromHonorariosParcela(ContratoHonorariosParcelaEntity par, LocalDate hoje) {
        ContratoHonorariosEntity contrato = par.getContrato();
        int total = contrato != null && contrato.getQuantidadeParcelas() != null
                ? contrato.getQuantidadeParcelas()
                : 0;
        String descricao = nomePessoa(contrato != null ? contrato.getPessoa() : null);
        if (total > 0) {
            descricao = (descricao != null ? descricao : "Cliente") + " · parcela " + par.getNumeroParcela() + "/" + total;
        } else if (contrato != null) {
            descricao = (descricao != null ? descricao : "Cliente") + " · honorários contratuais";
        }
        RecebivelQuadroStatus status = statusItem(hoje, par.getDataVencimento(), false);
        return new RecebivelQuadroItemResponse(
                descricao,
                RecebivelQuadroTipo.HONORARIOS,
                par.getDataVencimento(),
                escala(par.getValor()),
                status,
                "CONTRATO_HONORARIOS_PARCELA",
                par.getId());
    }

    private RecebivelQuadroItemResponse fromIptuParcela(IptuParcelaEntity par, LocalDate hoje) {
        ImovelEntity imovel = par.getIptuAnual() != null ? par.getIptuAnual().getImovel() : null;
        String descricao = montarDescricaoImovel(imovel);
        if (StringUtils.hasText(par.getCompetenciaMes())) {
            descricao = descricao + " · IPTU " + par.getCompetenciaMes();
        }
        RecebivelQuadroStatus status = statusItem(hoje, par.getDataVencimento(), IptuApplicationService.ST_PAGO.equals(par.getStatus()));
        return new RecebivelQuadroItemResponse(
                descricao,
                RecebivelQuadroTipo.IPTU,
                par.getDataVencimento(),
                escala(par.getValorCalculado()),
                status,
                "IPTU_PARCELA",
                par.getId());
    }

    private List<RecebivelQuadroItemResponse> fromLocacaoAluguelEsperado(
            ContratoLocacaoEntity contrato,
            Intervalo intervalo,
            LocalDate hoje,
            Set<String> aluguelRecebido) {
        if (contrato == null
                || contrato.getId() == null
                || contrato.getValorAluguel() == null
                || contrato.getValorAluguel().signum() <= 0) {
            return List.of();
        }
        YearMonth inicio = YearMonth.from(intervalo.inicio());
        YearMonth fim = YearMonth.from(intervalo.fim());
        List<RecebivelQuadroItemResponse> out = new ArrayList<>();
        for (YearMonth ym = inicio; !ym.isAfter(fim); ym = ym.plusMonths(1)) {
            if (!contratoVigenteNoMes(contrato, ym)) {
                continue;
            }
            String competencia = ym.toString();
            String chave = contrato.getId() + "|" + competencia;
            boolean recebido = aluguelRecebido.contains(chave);
            LocalDate vencimento = calcularVencimentoAluguel(contrato.getDiaVencimentoAluguel(), ym);
            RecebivelQuadroStatus status = statusItem(hoje, vencimento, recebido);
            out.add(new RecebivelQuadroItemResponse(
                    descricaoAluguelLocacao(contrato),
                    RecebivelQuadroTipo.ALUGUEL,
                    vencimento,
                    escala(contrato.getValorAluguel()),
                    status,
                    PREFIXO_ORIGEM_LOCACAO + contrato.getId(),
                    refIdLocacaoCompetencia(contrato.getId(), competencia)));
        }
        return out;
    }

    static boolean contratoVigenteNoMes(ContratoLocacaoEntity contrato, YearMonth ym) {
        LocalDate inicioMes = ym.atDay(1);
        LocalDate fimMes = ym.atEndOfMonth();
        if (contrato.getDataInicio() != null && contrato.getDataInicio().isAfter(fimMes)) {
            return false;
        }
        if (contrato.getDataFim() != null && contrato.getDataFim().isBefore(inicioMes)) {
            return false;
        }
        return true;
    }

    public static LocalDate calcularVencimentoAluguel(Integer diaVencimentoAluguel, YearMonth ym) {
        int dia = diaVencimentoAluguel != null ? diaVencimentoAluguel : DIA_VENCIMENTO_ALUGUEL_DEFAULT;
        dia = Math.min(Math.max(dia, 1), 31);
        return ym.atDay(Math.min(dia, ym.lengthOfMonth()));
    }

    static long refIdLocacaoCompetencia(Long contratoId, String competencia) {
        int yyyymm = Integer.parseInt(competencia.replace("-", ""));
        return contratoId * 1_000_000L + yyyymm;
    }

    private static String descricaoAluguelLocacao(ContratoLocacaoEntity contrato) {
        String imovel = montarDescricaoImovel(contrato.getImovel());
        String locador = nomePessoa(contrato.getLocadorPessoa());
        if (StringUtils.hasText(locador)) {
            return imovel + " · " + locador;
        }
        return imovel;
    }

    static RecebivelQuadroTipo tipoDePagamento(PagamentoEntity p) {
        String origem = p.getOrigem() != null ? p.getOrigem().trim().toUpperCase() : "";
        if (origem.startsWith(PREFIXO_ORIGEM_HONORARIOS)) {
            return RecebivelQuadroTipo.HONORARIOS;
        }
        String cat = p.getCategoria() != null ? p.getCategoria().trim().toUpperCase() : "";
        return switch (cat) {
            case "MENSALIDADE" -> RecebivelQuadroTipo.MENSALIDADE;
            case "ALUGUEL" -> RecebivelQuadroTipo.ALUGUEL;
            case "IPTU", "IMPOSTO", "TRIBUTO" -> RecebivelQuadroTipo.IPTU;
            default -> RecebivelQuadroTipo.OUTRO;
        };
    }

    private static boolean statusPagamentoRecebido(PagamentoEntity p) {
        String st = p.getStatus() != null ? p.getStatus().trim().toUpperCase() : "";
        return PagamentoDominio.ST_RECEBIDO.equals(st) || PagamentoDominio.ST_CONCILIADO.equals(st);
    }

    static RecebivelQuadroStatus statusItem(LocalDate hoje, LocalDate vencimento, boolean recebido) {
        if (recebido) {
            return RecebivelQuadroStatus.RECEBIDO;
        }
        if (vencimento != null && vencimento.isBefore(hoje)) {
            return RecebivelQuadroStatus.VENCIDO;
        }
        return RecebivelQuadroStatus.A_VENCER;
    }

    private static String descricaoPagamento(PagamentoEntity p) {
        if (StringUtils.hasText(p.getDescricao())) {
            return p.getDescricao().trim();
        }
        String cliente = nomeCliente(p.getCliente());
        if (cliente != null) {
            return cliente;
        }
        if (p.getImovel() != null) {
            return montarDescricaoImovel(p.getImovel());
        }
        ProcessoEntity proc = p.getProcesso();
        if (proc != null && proc.getNumeroInterno() != null) {
            return "Processo " + proc.getNumeroInterno();
        }
        return "Recebível #" + p.getId();
    }

    private static String nomeCliente(ClienteEntity cliente) {
        if (cliente == null) {
            return null;
        }
        if (StringUtils.hasText(cliente.getNomeReferencia())) {
            return cliente.getNomeReferencia().trim();
        }
        return nomePessoa(cliente.getPessoa());
    }

    private static String montarDescricaoImovel(ImovelEntity imovel) {
        if (imovel == null) {
            return "Imóvel";
        }
        StringBuilder sb = new StringBuilder();
        if (imovel.getNumeroPlanilha() != null) {
            sb.append('#').append(imovel.getNumeroPlanilha());
        }
        if (StringUtils.hasText(imovel.getEnderecoCompleto())) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append(imovel.getEnderecoCompleto().trim());
        }
        return !sb.isEmpty() ? sb.toString() : "Imóvel " + imovel.getId();
    }

    private static String nomePessoa(PessoaEntity pessoa) {
        return pessoa != null && StringUtils.hasText(pessoa.getNome()) ? pessoa.getNome().trim() : null;
    }

    private static BigDecimal escala(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}
