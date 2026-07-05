package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.api.dto.CalculoParcelamentoConsolidadoItem;
import br.com.vilareal.calculo.api.dto.CalculoParcelamentosConsolidadoResumo;
import br.com.vilareal.calculo.api.dto.CalculoParcelamentosConsolidadoResponse;
import br.com.vilareal.calculo.infrastructure.persistence.CalculoParcelamentosConsolidadoQueryDao;
import br.com.vilareal.calculo.infrastructure.persistence.CalculoParcelamentosConsolidadoQueryDao.ParcelaRow;
import br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import java.math.RoundingMode;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CalculoParcelamentosConsolidadoApplicationService {

    private static final ZoneId ZONE_BR = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ROOT);

    private final CalculoParcelamentosConsolidadoQueryDao queryDao;
    private final CalculoRodadaRepository rodadaRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final LancamentoFinanceiroRepository lancamentoRepository;

    public CalculoParcelamentosConsolidadoApplicationService(
            CalculoParcelamentosConsolidadoQueryDao queryDao,
            CalculoRodadaRepository rodadaRepository,
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService,
            LancamentoFinanceiroRepository lancamentoRepository) {
        this.queryDao = queryDao;
        this.rodadaRepository = rodadaRepository;
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
        this.lancamentoRepository = lancamentoRepository;
    }

    @Transactional(readOnly = true)
    public CalculoParcelamentosConsolidadoResponse listarConsolidado(
            String codigoCliente,
            List<Integer> processos,
            String situacao,
            LocalDate vencimentoDe,
            LocalDate vencimentoAte,
            String ordenarPor,
            boolean ordemAsc,
            int page,
            int size) {
        LocalDate hoje = LocalDate.now(ZONE_BR);
        String cod8 = StringUtils.hasText(codigoCliente)
                ? CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente)
                : null;

        List<ParcelaRow> raw = queryDao.listarParcelasRaw(cod8, processos, vencimentoDe, vencimentoAte, situacao, hoje);

        Map<String, DimensaoMeta> dimMetaCache = new HashMap<>();
        Map<Long, List<LancamentoFinanceiroEntity>> lancPorProcesso = new HashMap<>();

        List<CalculoParcelamentoConsolidadoItem> itens = new ArrayList<>();
        for (ParcelaRow row : raw) {
            if (!parcelaDentroLimite(row)) {
                continue;
            }
            LocalDate venc = parseDataBr(row.dataVencimentoBr());
            LocalDate pag = parseDataBr(row.dataPagamentoBr());
            long valorCent = CalculoApplicationService.parseValorInicialParaCentavos(row.valorParcela());
            long honCent = CalculoApplicationService.parseValorInicialParaCentavos(row.honorariosParcela());
            if (valorCent <= 0 && honCent <= 0) {
                continue;
            }

            String situ = classificarSituacao(pag, venc, hoje);
            int diasAtraso = calcularDiasAtraso(venc, pag, hoje);

            ExtratoMatch extrato = buscarExtrato(row, valorCent + honCent, lancPorProcesso);

            String procKey = row.codigoCliente() + "|" + row.numeroProcesso();
            DimensaoMeta meta = dimMetaCache.computeIfAbsent(procKey, k -> carregarDimensaoMeta(row.codigoCliente(), row.numeroProcesso()));

            String parteOposta = resolverParteOposta(row);

            itens.add(new CalculoParcelamentoConsolidadoItem(
                    chaveRodada(row.codigoCliente(), row.numeroProcesso(), row.dimensao()),
                    row.codigoCliente(),
                    row.numeroProcesso(),
                    row.dimensao(),
                    row.processoId(),
                    parteOposta,
                    nullToEmpty(row.unidade()),
                    row.indiceParcela() + 1,
                    totalParcelas(row),
                    venc,
                    pag,
                    valorCent,
                    honCent,
                    situ,
                    diasAtraso,
                    extrato.vinculado(),
                    extrato.lancamentoId(),
                    extrato.bancoNumero(),
                    extrato.bancoNome(),
                    meta.proximaDimensaoLivre(),
                    meta.descumpridoJaExiste()));
        }

        ordenar(itens, ordenarPor, ordemAsc);

        CalculoParcelamentosConsolidadoResumo resumo = montarResumo(itens);

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 500);
        int from = safePage * safeSize;
        int to = Math.min(from + safeSize, itens.size());
        List<CalculoParcelamentoConsolidadoItem> pagina = from >= itens.size() ? List.of() : itens.subList(from, to);

        return new CalculoParcelamentosConsolidadoResponse(pagina, itens.size(), resumo);
    }

    @Transactional(readOnly = true)
    public CalculoParcelamentosConsolidadoResumo resumoKpi(String codigoCliente, List<Integer> processos) {
        CalculoParcelamentosConsolidadoResponse full =
                listarConsolidado(codigoCliente, processos, "todas", null, null, "vencimento", true, 0, 10000);
        return full.resumo();
    }

    private record ExtratoMatch(boolean vinculado, Long lancamentoId, Integer bancoNumero, String bancoNome) {}

    private record DimensaoMeta(int proximaDimensaoLivre, boolean descumpridoJaExiste) {}

    private static boolean parcelaDentroLimite(ParcelaRow row) {
        int qtd = row.totalParcelasInformada();
        if (qtd <= 0) {
            return true;
        }
        return row.indiceParcela() < qtd;
    }

    private static int totalParcelas(ParcelaRow row) {
        return row.totalParcelasInformada() > 0 ? row.totalParcelasInformada() : row.indiceParcela() + 1;
    }

    private DimensaoMeta carregarDimensaoMeta(String cod8, int proc) {
        List<CalculoRodadaResumoProjection> dims =
                rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(cod8, proc);
        if (dims.isEmpty()) {
            return new DimensaoMeta(0, false);
        }
        int maxDim = dims.stream().mapToInt(d -> d.dimensao() != null ? d.dimensao() : 0).max().orElse(0);
        int maxAceito = dims.stream()
                .filter(CalculoRodadaResumoProjection::parcelamentoAceito)
                .mapToInt(d -> d.dimensao() != null ? d.dimensao() : 0)
                .max()
                .orElse(-1);
        boolean descumprido = false;
        Integer alvo = null;
        for (CalculoRodadaResumoProjection d : dims) {
            int dim = d.dimensao() != null ? d.dimensao() : 0;
            if (dim > maxAceito && !d.parcelamentoAceito()) {
                descumprido = true;
                if (alvo == null) {
                    alvo = dim;
                }
            }
        }
        int proximaLivre = alvo != null ? alvo : maxDim + 1;
        return new DimensaoMeta(proximaLivre, descumprido);
    }

    private ExtratoMatch buscarExtrato(
            ParcelaRow row, long valorTotalCentavos, Map<Long, List<LancamentoFinanceiroEntity>> cache) {
        if (row.processoId() == null) {
            return new ExtratoMatch(false, null, null, null);
        }
        LocalDate venc = parseDataBr(row.dataVencimentoBr());
        if (venc == null) {
            return new ExtratoMatch(false, null, null, null);
        }
        List<LancamentoFinanceiroEntity> lancs =
                cache.computeIfAbsent(row.processoId(), id -> lancamentoRepository.findByProcessoId(id));
        for (LancamentoFinanceiroEntity l : lancs) {
            if (l.getDataLancamento() == null || l.getValor() == null) {
                continue;
            }
            long cent = l.getValor().setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValue();
            if (cent != valorTotalCentavos) {
                continue;
            }
            LocalDate data = l.getDataLancamento();
            if (data.equals(venc) || data.equals(venc.plusDays(1))) {
                return new ExtratoMatch(true, l.getId(), l.getNumeroBanco(), l.getBancoNome());
            }
        }
        return new ExtratoMatch(false, null, null, null);
    }

    private String resolverParteOposta(ParcelaRow row) {
        if (StringUtils.hasText(row.reuCabecalho())) {
            return row.reuCabecalho().trim();
        }
        if (row.processoId() == null) {
            return "";
        }
        return processoRepository
                .findById(row.processoId())
                .map(this::parteOpostaProcesso)
                .orElse("");
    }

    private String parteOpostaProcesso(ProcessoEntity p) {
        Map<Long, ProcessoPartesVinculoTexto> map =
                processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(p.getId()));
        ProcessoPartesVinculoTexto partes = map.get(p.getId());
        if (partes != null && StringUtils.hasText(partes.getParteOposta())) {
            return partes.getParteOposta().trim();
        }
        return "";
    }

    private static String classificarSituacao(LocalDate pag, LocalDate venc, LocalDate hoje) {
        if (pag != null) {
            return "PAGA";
        }
        if (venc == null) {
            return "EM_ABERTO";
        }
        if (venc.isBefore(hoje)) {
            return "VENCIDA";
        }
        return "A_VENCER";
    }

    private static int calcularDiasAtraso(LocalDate venc, LocalDate pag, LocalDate hoje) {
        if (pag != null || venc == null || !venc.isBefore(hoje)) {
            return 0;
        }
        return (int) java.time.temporal.ChronoUnit.DAYS.between(venc, hoje);
    }

    private static LocalDate parseDataBr(String br) {
        if (!StringUtils.hasText(br)) {
            return null;
        }
        String norm = CalculoApplicationService.normalizaDataVencimento(br.trim());
        try {
            return LocalDate.parse(norm, BR);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static CalculoParcelamentosConsolidadoResumo montarResumo(List<CalculoParcelamentoConsolidadoItem> itens) {
        int vencidas = 0;
        int aVencer = 0;
        int pagas = 0;
        int emAberto = 0;
        int semExtrato = 0;
        long valorVencido = 0;
        long valorAberto = 0;
        for (CalculoParcelamentoConsolidadoItem i : itens) {
            long total = i.valorCentavos() + i.honorariosCentavos();
            switch (i.situacao()) {
                case "VENCIDA" -> {
                    vencidas++;
                    valorVencido += total;
                    valorAberto += total;
                }
                case "A_VENCER" -> {
                    aVencer++;
                    valorAberto += total;
                }
                case "PAGA" -> pagas++;
                default -> emAberto++;
            }
            if (!i.extratoVinculado() && !"PAGA".equals(i.situacao())) {
                semExtrato++;
            }
        }
        return new CalculoParcelamentosConsolidadoResumo(
                itens.size(), vencidas, aVencer, pagas, emAberto, semExtrato, valorVencido, valorAberto);
    }

    private static void ordenar(List<CalculoParcelamentoConsolidadoItem> itens, String ordenarPor, boolean asc) {
        Comparator<CalculoParcelamentoConsolidadoItem> cmp =
                switch (ordenarPor != null ? ordenarPor.toLowerCase(Locale.ROOT) : "vencimento") {
                    case "diasatraso" -> Comparator.comparingInt(CalculoParcelamentoConsolidadoItem::diasAtraso);
                    case "valor" -> Comparator.comparingLong(i -> i.valorCentavos() + i.honorariosCentavos());
                    case "cliente" -> Comparator.comparing(CalculoParcelamentoConsolidadoItem::codigoCliente)
                            .thenComparingInt(CalculoParcelamentoConsolidadoItem::numeroProcesso);
                    default -> Comparator.comparing(
                            CalculoParcelamentoConsolidadoItem::dataVencimento,
                            Comparator.nullsLast(Comparator.naturalOrder()));
                };
        if (!asc) {
            cmp = cmp.reversed();
        }
        itens.sort(cmp.thenComparing(CalculoParcelamentoConsolidadoItem::chaveRodada)
                .thenComparingInt(CalculoParcelamentoConsolidadoItem::parcelaNumero));
    }

    private static String chaveRodada(String cod, int proc, int dim) {
        return cod + ":" + proc + ":" + dim;
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
