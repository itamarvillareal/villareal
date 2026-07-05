package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.*;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CompensacaoParDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CompensacaoParDescarteRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.application.TitularPessoaRefHelper;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class FinanceiroCompensacaoService {

    private static final BigDecimal TOLERANCIA_GRUPO = new BigDecimal("0.01");
    /** Mantido na assinatura do repositório; o filtro efetivo é dia útil bancário no SQL. */
    private static final int DIAS_TOLERANCIA_SQL = 3;
    private static final int SQL_BATCH_SIZE = 1000;
    /** Limite de linhas SQL de candidatos por execução greedy (evita OOM com explosão de pares). */
    private static final long MAX_CANDIDATE_SQL_ROWS = 50_000;
    /** Alinhado a spring.data.web.pageable.max-page-size e PAGE_SIZE_OPTIONS do frontend. */
    private static final int MAX_PARES_POR_PAGINA = 1000;
    private static final int DESCRICAO_RESUMO_MAX = 120;
    private static final long CACHE_GREEDY_TTL_SECONDS = 45;

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final CompensacaoParDescarteRepository compensacaoParDescarteRepository;
    private final FinanceiroSaudeService financeiroSaudeService;
    private final ConcurrentHashMap<String, CacheGreedyPares> cacheGreedyPares = new ConcurrentHashMap<>();

    public FinanceiroCompensacaoService(
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            CompensacaoParDescarteRepository compensacaoParDescarteRepository,
            @Lazy FinanceiroSaudeService financeiroSaudeService) {
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.compensacaoParDescarteRepository = compensacaoParDescarteRepository;
        this.financeiroSaudeService = financeiroSaudeService;
    }

    @Transactional
    public ParearCompensacaoResponse parear(ParearCompensacaoRequest request) {
        ContaContabilEntity contaE = contaPorCodigo("E");
        ParearCompensacaoResponse response = new ParearCompensacaoResponse();
        for (ParearCompensacaoItemRequest par : request.getPares()) {
            processarPar(par, contaE, response);
        }
        if (response.getPareados() > 0) {
            cacheGreedyPares.clear();
            financeiroSaudeService.invalidarCacheSaude();
        }
        return response;
    }

    @Transactional
    public DesparearCompensacaoResponse desparear(String grupoCompensacao) {
        if (!StringUtils.hasText(grupoCompensacao)) {
            throw new IllegalArgumentException("grupoCompensacao é obrigatório.");
        }
        ContaContabilEntity contaN = contaPorCodigo("N");
        List<LancamentoFinanceiroEntity> lista =
                lancamentoRepository.findAllByGrupoCompensacao(grupoCompensacao.trim());
        for (LancamentoFinanceiroEntity e : lista) {
            e.setGrupoCompensacao(null);
            e.setContaContabil(contaN);
            Long clienteId = e.getClienteEntidade() != null ? e.getClienteEntidade().getId() : null;
            e.setEtapa(EtapaLancamento.calcular(contaN.getCodigo(), null, clienteId));
        }
        lancamentoRepository.saveAll(lista);
        if (!lista.isEmpty()) {
            cacheGreedyPares.clear();
            financeiroSaudeService.invalidarCacheSaude();
        }
        DesparearCompensacaoResponse r = new DesparearCompensacaoResponse();
        r.setDesvinculados(lista.size());
        return r;
    }

    @Transactional
    public DescartarParesCompensacaoResponse descartarPares(ParearCompensacaoRequest request) {
        DescartarParesCompensacaoResponse response = new DescartarParesCompensacaoResponse();
        if (request == null || request.getPares() == null) {
            return response;
        }
        for (ParearCompensacaoItemRequest par : request.getPares()) {
            if (par.getLancamentoIdA() == null || par.getLancamentoIdB() == null) {
                continue;
            }
            long menor = Math.min(par.getLancamentoIdA(), par.getLancamentoIdB());
            long maior = Math.max(par.getLancamentoIdA(), par.getLancamentoIdB());
            if (menor == maior) {
                continue;
            }
            if (compensacaoParDescarteRepository.existsByLancamentoIdMenorAndLancamentoIdMaior(menor, maior)) {
                response.setJaDescartados(response.getJaDescartados() + 1);
                continue;
            }
            CompensacaoParDescarteEntity e = new CompensacaoParDescarteEntity();
            e.setLancamentoIdMenor(menor);
            e.setLancamentoIdMaior(maior);
            compensacaoParDescarteRepository.save(e);
            response.setDescartados(response.getDescartados() + 1);
        }
        if (response.getDescartados() > 0) {
            cacheGreedyPares.clear();
            financeiroSaudeService.invalidarCacheSaude();
        }
        return response;
    }

    @Transactional(readOnly = true)
    public ParesSugeridosCompensacaoResponse listarParesSugeridos(
            Integer numeroBanco, Integer ano, Integer mes, int page, int size) {
        return listarParesSugeridos(numeroBanco, ano, mes, page, size, false, false, false, false);
    }

    @Transactional(readOnly = true)
    public ParesSugeridosCompensacaoResponse listarParesSugeridos(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            int page,
            int size,
            boolean apenasInterbancario) {
        return listarParesSugeridos(numeroBanco, ano, mes, page, size, apenasInterbancario, false, false, false);
    }

    @Transactional(readOnly = true)
    public ParesSugeridosCompensacaoResponse listarParesSugeridos(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            int page,
            int size,
            boolean apenasInterbancario,
            boolean apenasMesmoBanco) {
        return listarParesSugeridos(
                numeroBanco, ano, mes, page, size, apenasInterbancario, apenasMesmoBanco, false, false);
    }

    @Transactional(readOnly = true)
    public ParesSugeridosCompensacaoResponse listarParesSugeridos(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            int page,
            int size,
            boolean apenasInterbancario,
            boolean apenasMesmoBanco,
            boolean apenasMesmoDiaCalendario,
            boolean apenasDiaDivergente) {
        int limit = Math.max(1, Math.min(size, MAX_PARES_POR_PAGINA));
        int skip = Math.max(0, page) * limit;
        List<ParCompensacaoSugeridoResponse> todosFiltrados = filtrarParesPorDiaCalendario(
                obterParesGreedyComCache(
                        numeroBanco,
                        ano,
                        mes,
                        apenasInterbancario,
                        apenasMesmoBanco,
                        apenasMesmoDiaCalendario,
                        apenasDiaDivergente),
                apenasMesmoDiaCalendario,
                apenasDiaDivergente);
        long totalFiltrado = todosFiltrados.size();
        List<ParCompensacaoSugeridoResponse> pares =
                todosFiltrados.stream().skip(skip).limit(limit).toList();

        ParesSugeridosCompensacaoResponse response = new ParesSugeridosCompensacaoResponse();
        response.setPares(pares);
        response.setTotalPares(totalFiltrado);
        response.setPage(page);
        response.setTotalPages(totalFiltrado == 0 ? 0 : (int) Math.ceil((double) totalFiltrado / limit));
        return response;
    }

    private record CacheGreedyPares(List<ParCompensacaoSugeridoResponse> pares, Instant expiraEm) {}

    private record CandidatosCompensacao(
            List<ParCompensacaoSugeridoResponse> pares, Map<Long, LancamentoFinanceiroEntity> porId) {}

    private List<ParCompensacaoSugeridoResponse> obterParesGreedyComCache(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            boolean apenasInterbancario,
            boolean apenasMesmoBanco,
            boolean apenasMesmoDiaCalendario,
            boolean apenasDiaDivergente) {
        String chave = chaveCacheGreedy(
                numeroBanco,
                ano,
                mes,
                apenasInterbancario,
                apenasMesmoBanco,
                apenasMesmoDiaCalendario,
                apenasDiaDivergente);
        Instant agora = Instant.now();
        CacheGreedyPares hit = cacheGreedyPares.get(chave);
        if (hit != null && hit.expiraEm().isAfter(agora)) {
            return hit.pares();
        }
        List<ParCompensacaoSugeridoResponse> calculado = coletarMelhoresParesGreedy(
                numeroBanco,
                ano,
                mes,
                apenasInterbancario,
                apenasMesmoBanco,
                apenasMesmoDiaCalendario,
                apenasDiaDivergente);
        cacheGreedyPares.put(
                chave,
                new CacheGreedyPares(
                        calculado, agora.plusSeconds(CACHE_GREEDY_TTL_SECONDS)));
        return calculado;
    }

    private static String chaveCacheGreedy(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            boolean apenasInterbancario,
            boolean apenasMesmoBanco,
            boolean apenasMesmoDiaCalendario,
            boolean apenasDiaDivergente) {
        return numeroBanco
                + "|"
                + ano
                + "|"
                + mes
                + "|"
                + apenasInterbancario
                + "|"
                + apenasMesmoBanco
                + "|"
                + apenasMesmoDiaCalendario
                + "|"
                + apenasDiaDivergente;
    }

    /** Carrega pares SQL (dia útil no banco), uma carga de entidades e seleção greedy. */
    private List<ParCompensacaoSugeridoResponse> coletarMelhoresParesGreedy(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            boolean apenasInterbancario,
            boolean apenasMesmoBanco,
            boolean apenasMesmoDiaCalendario,
            boolean apenasDiaDivergente) {
        CandidatosCompensacao dados = carregarCandidatosCompensacao(
                numeroBanco,
                ano,
                mes,
                apenasInterbancario,
                apenasMesmoBanco,
                apenasMesmoDiaCalendario,
                apenasDiaDivergente);
        Set<String> paresDescartados = carregarChavesParesDescartados();
        List<ParCompensacaoSugeridoResponse> candidatos = dados.pares().stream()
                .filter(p -> !paresDescartados.contains(chavePar(p.getLancamentoA().getId(), p.getLancamentoB().getId())))
                .toList();
        return selecionarMelhoresParesGreedy(candidatos, dados.porId());
    }

    private Set<String> carregarChavesParesDescartados() {
        Set<String> out = new HashSet<>();
        for (CompensacaoParDescarteEntity d : compensacaoParDescarteRepository.findAll()) {
            out.add(chavePar(d.getLancamentoIdMenor(), d.getLancamentoIdMaior()));
        }
        return out;
    }

    private static String chavePar(long idA, long idB) {
        long menor = Math.min(idA, idB);
        long maior = Math.max(idA, idB);
        return menor + "-" + maior;
    }

    private CandidatosCompensacao carregarCandidatosCompensacao(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            boolean apenasInterbancario,
            boolean apenasMesmoBanco,
            boolean apenasMesmoDiaCalendario,
            boolean apenasDiaDivergente) {
        long totalSql = lancamentoRepository.countParesCompensacaoSugeridos(
                numeroBanco,
                ano,
                mes,
                DIAS_TOLERANCIA_SQL,
                apenasInterbancario,
                apenasMesmoBanco,
                apenasMesmoDiaCalendario,
                apenasDiaDivergente);
        if (totalSql == 0) {
            return new CandidatosCompensacao(List.of(), Map.of());
        }
        long limiteLinhas = Math.min(totalSql, MAX_CANDIDATE_SQL_ROWS);
        List<Object[]> todasLinhas = new ArrayList<>((int) Math.min(limiteLinhas, Integer.MAX_VALUE));
        int sqlOffset = 0;
        while (sqlOffset < limiteLinhas) {
            int batch = (int) Math.min(SQL_BATCH_SIZE, limiteLinhas - sqlOffset);
            List<Object[]> rows = lancamentoRepository.findParesCompensacaoSugeridosIds(
                    numeroBanco,
                    ano,
                    mes,
                    DIAS_TOLERANCIA_SQL,
                    apenasInterbancario,
                    apenasMesmoBanco,
                    apenasMesmoDiaCalendario,
                    apenasDiaDivergente,
                    batch,
                    sqlOffset);
            if (rows.isEmpty()) {
                break;
            }
            todasLinhas.addAll(rows);
            sqlOffset += rows.size();
            if (rows.size() < batch) {
                break;
            }
        }
        return mapearCandidatosCompensacao(todasLinhas);
    }

    private CandidatosCompensacao mapearCandidatosCompensacao(List<Object[]> rows) {
        if (rows.isEmpty()) {
            return new CandidatosCompensacao(List.of(), Map.of());
        }
        Set<Long> ids = new LinkedHashSet<>();
        List<long[]> paresMeta = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            long idA = ((Number) row[0]).longValue();
            long idB = ((Number) row[1]).longValue();
            ids.add(idA);
            ids.add(idB);
            Integer nbA = row[2] != null ? ((Number) row[2]).intValue() : null;
            Integer nbB = row[3] != null ? ((Number) row[3]).intValue() : null;
            paresMeta.add(
                    new long[] {idA, idB, nbA != null ? nbA.longValue() : -1L, nbB != null ? nbB.longValue() : -1L});
        }

        Map<Long, LancamentoFinanceiroEntity> porId = carregarPorIds(ids);
        List<ParCompensacaoSugeridoResponse> pares = new ArrayList<>(paresMeta.size());
        for (long[] meta : paresMeta) {
            LancamentoFinanceiroEntity a = porId.get(meta[0]);
            LancamentoFinanceiroEntity b = porId.get(meta[1]);
            if (a == null || b == null) {
                continue;
            }
            if (!contaCompensacao(a) || !contaCompensacao(b)) {
                continue;
            }
            if (!mesmoDiaUtilParaCompensacao(a.getDataLancamento(), b.getDataLancamento())) {
                continue;
            }
            ParCompensacaoSugeridoResponse par = new ParCompensacaoSugeridoResponse();
            par.setLancamentoA(resumoParFromEntity(a));
            par.setLancamentoB(resumoParFromEntity(b));
            par.setTipo(classificarTipoPar(meta[2], meta[3], a, b));
            pares.add(par);
        }
        return new CandidatosCompensacao(pares, porId);
    }

    /**
     * Um lançamento entra em no máximo um par sugerido. Ordem: PIX↔PIX / transf↔transf, depois entre bancos,
     * por último mesmo banco (só valor + data).
     */
    private List<ParCompensacaoSugeridoResponse> selecionarMelhoresParesGreedy(
            List<ParCompensacaoSugeridoResponse> candidatos, Map<Long, LancamentoFinanceiroEntity> porId) {
        if (candidatos.isEmpty()) {
            return List.of();
        }

        List<ParCompensacaoSugeridoResponse> ordenados = candidatos.stream()
                .sorted((p1, p2) -> {
                    LancamentoFinanceiroEntity a1 = porId.get(p1.getLancamentoA().getId());
                    LancamentoFinanceiroEntity b1 = porId.get(p1.getLancamentoB().getId());
                    LancamentoFinanceiroEntity a2 = porId.get(p2.getLancamentoA().getId());
                    LancamentoFinanceiroEntity b2 = porId.get(p2.getLancamentoB().getId());
                    int s = Integer.compare(
                            CompensacaoParPrioridade.pontuar(a2, b2), CompensacaoParPrioridade.pontuar(a1, b1));
                    if (s != 0) {
                        return s;
                    }
                    if (p1.getTipo() != p2.getTipo()) {
                        return p1.getTipo() == TipoParCompensacao.INTERBANCARIO ? -1 : 1;
                    }
                    return Long.compare(
                            p1.getLancamentoA().getId(),
                            p2.getLancamentoA().getId());
                })
                .toList();

        Set<Long> usados = new HashSet<>();
        List<ParCompensacaoSugeridoResponse> resultado = new ArrayList<>();
        for (ParCompensacaoSugeridoResponse par : ordenados) {
            long idA = par.getLancamentoA().getId();
            long idB = par.getLancamentoB().getId();
            if (usados.contains(idA) || usados.contains(idB)) {
                continue;
            }
            usados.add(idA);
            usados.add(idB);
            par.setConfianca(confiancaPorPontuacao(porId.get(idA), porId.get(idB)));
            resultado.add(par);
        }
        return resultado;
    }

    private static ConfiancaSugestao confiancaPorPontuacao(
            LancamentoFinanceiroEntity a, LancamentoFinanceiroEntity b) {
        int pontos = CompensacaoParPrioridade.pontuar(a, b);
        if (pontos >= CompensacaoParPrioridade.PESO_MESMA_FAMILIA_MOVIMENTO
                + CompensacaoParPrioridade.PESO_BANCOS_DIFERENTES) {
            return ConfiancaSugestao.ALTA;
        }
        if (pontos >= CompensacaoParPrioridade.PESO_MESMA_FAMILIA_MOVIMENTO
                || pontos >= CompensacaoParPrioridade.PESO_BANCOS_DIFERENTES) {
            return ConfiancaSugestao.MEDIA;
        }
        return ConfiancaSugestao.BAIXA;
    }

    private List<ParCompensacaoSugeridoResponse> coletarParesFiltradosPorDiaUtil(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            boolean apenasInterbancario,
            boolean apenasMesmoBanco,
            boolean apenasMesmoDiaCalendario,
            boolean apenasDiaDivergente,
            int skip,
            int limit) {
        return obterParesGreedyComCache(
                        numeroBanco,
                        ano,
                        mes,
                        apenasInterbancario,
                        apenasMesmoBanco,
                        apenasMesmoDiaCalendario,
                        apenasDiaDivergente)
                .stream()
                .skip(skip)
                .limit(limit)
                .toList();
    }

    private static boolean mesmoDiaUtilParaCompensacao(LocalDate dataA, LocalDate dataB) {
        return CompensacaoDateUtils.mesmoDiaUtilBancario(dataA, dataB);
    }

    private static boolean contaCompensacao(LancamentoFinanceiroEntity e) {
        if (e.getContaContabil() == null || e.getContaContabil().getCodigo() == null) {
            return false;
        }
        return "E".equalsIgnoreCase(e.getContaContabil().getCodigo().trim());
    }

    /** Reforço pós-greedy: mesmo dia = data de calendário igual; divergente = datas diferentes. */
    private static List<ParCompensacaoSugeridoResponse> filtrarParesPorDiaCalendario(
            List<ParCompensacaoSugeridoResponse> pares,
            boolean apenasMesmoDiaCalendario,
            boolean apenasDiaDivergente) {
        if (!apenasMesmoDiaCalendario && !apenasDiaDivergente) {
            return pares;
        }
        return pares.stream()
                .filter(par -> {
                    LocalDate da = par.getLancamentoA() != null ? par.getLancamentoA().getDataLancamento() : null;
                    LocalDate db = par.getLancamentoB() != null ? par.getLancamentoB().getDataLancamento() : null;
                    if (da == null || db == null) {
                        return false;
                    }
                    boolean mesmoDia = da.equals(db);
                    if (apenasMesmoDiaCalendario) {
                        return mesmoDia;
                    }
                    return !mesmoDia;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public GruposCompensacaoInconsistentesResponse listarGruposInconsistentes(
            Integer numeroBanco, Integer ano, Integer mes, int page, int size) {
        int limit = Math.max(1, Math.min(size, 100));
        int offset = Math.max(0, page) * limit;
        long total = lancamentoRepository.countGruposCompensacaoInconsistentes(ano, mes, numeroBanco);
        List<Object[]> resumos =
                lancamentoRepository.findGruposCompensacaoInconsistentesResumo(ano, mes, numeroBanco, limit, offset);

        List<GrupoCompensacaoInconsistenteResponse> grupos = new ArrayList<>();
        for (Object[] row : resumos) {
            String grupo = String.valueOf(row[0]);
            BigDecimal soma = row[1] instanceof BigDecimal bd
                    ? bd
                    : new BigDecimal(row[1].toString());
            long qtd = ((Number) row[2]).longValue();

            List<LancamentoFinanceiroEntity> lancamentos = lancamentoRepository.findAllByGrupoCompensacao(grupo);
            GrupoCompensacaoInconsistenteResponse g = new GrupoCompensacaoInconsistenteResponse();
            g.setGrupoCompensacao(grupo);
            g.setSoma(soma);
            g.setLancamentos(lancamentos.stream().map(this::toLancamentoResponse).collect(Collectors.toList()));
            SugestaoGrupoInconsistente sugestao = inferirSugestaoGrupo(soma, qtd, lancamentos);
            g.setSugestao(sugestao);
            g.setDescricaoSugestao(descricaoSugestao(sugestao, soma));
            grupos.add(g);
        }

        GruposCompensacaoInconsistentesResponse response = new GruposCompensacaoInconsistentesResponse();
        response.setTotal(total);
        response.setGrupos(grupos);
        response.setPage(page);
        response.setTotalPages(total == 0 ? 0 : (int) Math.ceil((double) total / limit));
        return response;
    }

    @Transactional
    public AutoParearResponse autoParear(AutoParearRequest request) {
        Integer ano = null;
        Integer mes = null;
        if (StringUtils.hasText(request.getMes())) {
            YearMonth ym = YearMonth.parse(request.getMes().trim());
            ano = ym.getYear();
            mes = ym.getMonthValue();
        }

        String tipoFiltro = request.getTipo() != null ? request.getTipo().trim().toUpperCase(Locale.ROOT) : "TODOS";
        boolean apenasInterbancarioSql = "INTERBANCARIO".equals(tipoFiltro);
        boolean apenasMesmoBancoSql = "MESMO_BANCO".equals(tipoFiltro);
        List<ParCompensacaoSugeridoResponse> candidatos = coletarParesFiltradosPorDiaUtil(
                request.getNumeroBanco(),
                ano,
                mes,
                apenasInterbancarioSql,
                apenasMesmoBancoSql,
                false,
                false,
                0,
                Integer.MAX_VALUE);
        List<ParCompensacaoSugeridoResponse> todosPares = new ArrayList<>();
        for (ParCompensacaoSugeridoResponse par : candidatos) {
            if ("TODOS".equals(tipoFiltro) || par.getTipo().name().equals(tipoFiltro)) {
                todosPares.add(par);
            }
        }

        AutoParearResponse response = new AutoParearResponse();
        response.setSimulacao(request.isDryRun());
        response.setParesEncontrados(todosPares.size());
        int inter = 0;
        int mesmo = 0;
        List<AutoParearDetalheResponse> detalhes = new ArrayList<>();
        for (ParCompensacaoSugeridoResponse par : todosPares) {
            if (par.getTipo() == TipoParCompensacao.INTERBANCARIO) {
                inter++;
            } else {
                mesmo++;
            }
            detalhes.add(toAutoParearDetalhe(par));
            if (!request.isDryRun()) {
                ParearCompensacaoItemRequest item = new ParearCompensacaoItemRequest();
                item.setLancamentoIdA(par.getLancamentoA().getId());
                item.setLancamentoIdB(par.getLancamentoB().getId());
                item.setGrupoCompensacao(null);
                ParearCompensacaoRequest req = new ParearCompensacaoRequest();
                req.setPares(List.of(item));
                parear(req);
            }
        }
        response.setInterbancarios(inter);
        response.setMesmoBanco(mesmo);
        response.setDetalhes(detalhes);
        return response;
    }

    private void processarPar(
            ParearCompensacaoItemRequest par, ContaContabilEntity contaE, ParearCompensacaoResponse response) {
        try {
            LancamentoFinanceiroEntity a = lancamentoRepository
                    .findById(par.getLancamentoIdA())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Lançamento não encontrado: " + par.getLancamentoIdA()));
            LancamentoFinanceiroEntity b = lancamentoRepository
                    .findById(par.getLancamentoIdB())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Lançamento não encontrado: " + par.getLancamentoIdB()));

            BigDecimal soma = valorAssinado(a).add(valorAssinado(b));
            BigDecimal tol = maxAbsValor(a, b).multiply(new BigDecimal("0.05"));
            if (soma.abs().compareTo(tol) > 0) {
                ParearCompensacaoErroResponse erro = new ParearCompensacaoErroResponse();
                erro.setLancamentoIdA(par.getLancamentoIdA());
                erro.setLancamentoIdB(par.getLancamentoIdB());
                erro.setMotivo("Soma fora da tolerância de 5%: " + soma);
                response.getErros().add(erro);
                return;
            }

            boolean comDiferenca = soma.compareTo(BigDecimal.ZERO) != 0;
            String grupo = StringUtils.hasText(par.getGrupoCompensacao())
                    ? par.getGrupoCompensacao().trim()
                    : gerarGrupoCompensacao();

            aplicarCompensacaoEmPar(a, b, contaE, grupo);
            lancamentoRepository.saveAll(List.of(a, b));

            response.setPareados(response.getPareados() + 1);
            if (comDiferenca) {
                response.setComDiferenca(response.getComDiferenca() + 1);
            }
            response.getGruposGerados().add(grupo);
        } catch (ResourceNotFoundException ex) {
            ParearCompensacaoErroResponse erro = new ParearCompensacaoErroResponse();
            erro.setLancamentoIdA(par.getLancamentoIdA());
            erro.setLancamentoIdB(par.getLancamentoIdB());
            erro.setMotivo(ex.getMessage());
            response.getErros().add(erro);
        }
    }

    private void aplicarCompensacaoEmPar(
            LancamentoFinanceiroEntity a,
            LancamentoFinanceiroEntity b,
            ContaContabilEntity contaE,
            String grupo) {
        for (LancamentoFinanceiroEntity e : List.of(a, b)) {
            e.setContaContabil(contaE);
            e.setGrupoCompensacao(grupo);
            e.setEtapa(EtapaLancamento.COMPENSADO);
        }
    }

    private static String gerarGrupoCompensacao() {
        return "COMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private static BigDecimal valorAssinado(LancamentoFinanceiroEntity e) {
        BigDecimal v = e.getValor() != null ? e.getValor() : BigDecimal.ZERO;
        return e.getNatureza() == NaturezaLancamento.CREDITO ? v : v.negate();
    }

    private static BigDecimal maxAbsValor(LancamentoFinanceiroEntity a, LancamentoFinanceiroEntity b) {
        return valorAssinado(a).abs().max(valorAssinado(b).abs());
    }

    private ContaContabilEntity contaPorCodigo(String codigo) {
        return contaContabilRepository
                .findFirstByCodigoIgnoreCase(codigo)
                .orElseThrow(() -> new ResourceNotFoundException("Conta contábil não encontrada: " + codigo));
    }

    private Map<Long, LancamentoFinanceiroEntity> carregarPorIds(Set<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return lancamentoRepository.findAllByIdIn(ids).stream()
                .collect(Collectors.toMap(LancamentoFinanceiroEntity::getId, e -> e, (x, y) -> x));
    }

    private TipoParCompensacao classificarTipoPar(
            long numeroBancoA, long numeroBancoB, LancamentoFinanceiroEntity a, LancamentoFinanceiroEntity b) {
        Integer nbA = a.getNumeroBanco();
        Integer nbB = b.getNumeroBanco();
        if (nbA != null && nbB != null && nbA.equals(nbB)) {
            return TipoParCompensacao.MESMO_BANCO;
        }
        if (numeroBancoA >= 0 && numeroBancoB >= 0 && numeroBancoA == numeroBancoB) {
            return TipoParCompensacao.MESMO_BANCO;
        }
        return TipoParCompensacao.INTERBANCARIO;
    }

    private SugestaoGrupoInconsistente inferirSugestaoGrupo(
            BigDecimal soma, long qtd, List<LancamentoFinanceiroEntity> lancamentos) {
        if (qtd <= 1) {
            return SugestaoGrupoInconsistente.INCOMPLETO;
        }
        boolean mesmoSinal = lancamentos.stream()
                .map(FinanceiroCompensacaoService::valorAssinado)
                .allMatch(v -> v.signum() == valorAssinado(lancamentos.get(0)).signum());
        if (mesmoSinal) {
            return SugestaoGrupoInconsistente.DUPLICADO;
        }
        if (soma.abs().compareTo(new BigDecimal("10")) < 0 && mesmaDataNoGrupo(lancamentos)) {
            return SugestaoGrupoInconsistente.DIFERENCA_TAXA;
        }
        return SugestaoGrupoInconsistente.REVISAR_MANUAL;
    }

    private static boolean mesmaDataNoGrupo(List<LancamentoFinanceiroEntity> lancamentos) {
        if (lancamentos.isEmpty()) {
            return false;
        }
        var d0 = lancamentos.get(0).getDataLancamento();
        return lancamentos.stream().allMatch(l -> Objects.equals(l.getDataLancamento(), d0));
    }

    private static String descricaoSugestao(SugestaoGrupoInconsistente sugestao, BigDecimal soma) {
        return switch (sugestao) {
            case DIFERENCA_TAXA -> "Possível taxa bancária de R$ "
                    + soma.abs().setScale(2, RoundingMode.HALF_UP).toPlainString();
            case DUPLICADO -> "Todos os lançamentos têm o mesmo sinal — verificar duplicata";
            case INCOMPLETO -> "Grupo com apenas um lançamento — buscar par";
            case REVISAR_MANUAL -> "Revisão manual necessária";
        };
    }

    private AutoParearDetalheResponse toAutoParearDetalhe(ParCompensacaoSugeridoResponse par) {
        AutoParearDetalheResponse d = new AutoParearDetalheResponse();
        d.setLancamentoA(par.getLancamentoA());
        d.setLancamentoB(par.getLancamentoB());
        d.setTipo(par.getTipo());
        return d;
    }

    private ResumoLancamentoParResponse resumoPar(LancamentoFinanceiroResponse l) {
        ResumoLancamentoParResponse r = new ResumoLancamentoParResponse();
        r.setId(l.getId());
        r.setBanco(l.getBancoNome());
        r.setNumeroBanco(l.getNumeroBanco());
        r.setDataLancamento(l.getDataLancamento());
        r.setDescricao(truncarDescricaoResumo(l.getDescricao()));
        r.setValor(l.getValor());
        r.setNatureza(l.getNatureza());
        return r;
    }

    private ResumoLancamentoParResponse resumoParFromEntity(LancamentoFinanceiroEntity e) {
        ResumoLancamentoParResponse r = new ResumoLancamentoParResponse();
        r.setId(e.getId());
        r.setBanco(Utf8MojibakeUtil.corrigir(e.getBancoNome()));
        r.setNumeroBanco(e.getNumeroBanco());
        r.setDataLancamento(e.getDataLancamento());
        r.setDescricao(truncarDescricaoResumo(Utf8MojibakeUtil.corrigir(e.getDescricao())));
        r.setValor(e.getValor());
        r.setNatureza(e.getNatureza());
        return r;
    }

    private static String truncarDescricaoResumo(String descricao) {
        if (descricao == null) {
            return "";
        }
        String s = descricao.trim();
        if (s.length() <= DESCRICAO_RESUMO_MAX) {
            return s;
        }
        return s.substring(0, DESCRICAO_RESUMO_MAX) + "…";
    }

    private LancamentoFinanceiroResponse toLancamentoResponse(LancamentoFinanceiroEntity e) {
        LancamentoFinanceiroResponse r = new LancamentoFinanceiroResponse();
        r.setId(e.getId());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        if (e.getClienteEntidade() != null) {
            r.setClienteId(e.getClienteEntidade().getId());
        }
        Long titularId =
                TitularPessoaRefHelper.titularPessoaId(e.getProcesso(), e.getPessoaRef(), e.getClienteEntidade());
        if (titularId != null) {
            r.setPessoaRefId(titularId);
        }
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        if (e.getClienteEntidade() != null) {
            r.setCodigoCliente(e.getClienteEntidade().getCodigoCliente());
        }
        if (e.getProcesso() != null && e.getProcesso().getNumeroInterno() != null) {
            r.setNumeroInternoProcesso(e.getProcesso().getNumeroInterno());
        }
        r.setBancoNome(Utf8MojibakeUtil.corrigir(e.getBancoNome()));
        r.setNumeroBanco(e.getNumeroBanco());
        r.setNumeroLancamento(Utf8MojibakeUtil.corrigir(e.getNumeroLancamento()));
        r.setDataLancamento(e.getDataLancamento());
        r.setDataCompetencia(e.getDataCompetencia());
        r.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao()));
        r.setDescricaoDetalhada(Utf8MojibakeUtil.corrigir(e.getDescricaoDetalhada()));
        r.setValor(e.getValor());
        r.setNatureza(e.getNatureza());
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setEtapa(e.getEtapa() != null ? e.getEtapa().name() : EtapaLancamento.IMPORTADO.name());
        r.setGrupoCompensacao(Utf8MojibakeUtil.corrigir(e.getGrupoCompensacao()));
        return r;
    }
}
