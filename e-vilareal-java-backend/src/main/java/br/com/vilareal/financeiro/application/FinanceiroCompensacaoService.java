package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.*;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FinanceiroCompensacaoService {

    private static final BigDecimal TOLERANCIA_GRUPO = new BigDecimal("0.01");

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;

    public FinanceiroCompensacaoService(
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository) {
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
    }

    @Transactional
    public ParearCompensacaoResponse parear(ParearCompensacaoRequest request) {
        ContaContabilEntity contaE = contaPorCodigo("E");
        ParearCompensacaoResponse response = new ParearCompensacaoResponse();
        for (ParearCompensacaoItemRequest par : request.getPares()) {
            processarPar(par, contaE, response);
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
            Long clienteId = e.getCliente() != null ? e.getCliente().getId() : null;
            e.setEtapa(EtapaLancamento.calcular(contaN.getCodigo(), null, clienteId));
        }
        lancamentoRepository.saveAll(lista);
        DesparearCompensacaoResponse r = new DesparearCompensacaoResponse();
        r.setDesvinculados(lista.size());
        return r;
    }

    /** Pré-filtro SQL: cobre sexta→segunda (3 dias corridos no pior caso). */
    private static final int DIAS_TOLERANCIA_SQL = 3;

    @Transactional(readOnly = true)
    public ParesSugeridosCompensacaoResponse listarParesSugeridos(
            Integer numeroBanco, Integer ano, Integer mes, int page, int size) {
        return listarParesSugeridos(numeroBanco, ano, mes, page, size, false);
    }

    @Transactional(readOnly = true)
    public ParesSugeridosCompensacaoResponse listarParesSugeridos(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            int page,
            int size,
            boolean apenasInterbancario) {
        int limit = Math.max(1, Math.min(size, 200));
        int skip = Math.max(0, page) * limit;
        List<ParCompensacaoSugeridoResponse> todosFiltrados =
                coletarParesFiltradosPorDiaUtil(numeroBanco, ano, mes, apenasInterbancario, 0, Integer.MAX_VALUE);
        long totalFiltrado = todosFiltrados.size();
        List<ParCompensacaoSugeridoResponse> pares = todosFiltrados.stream()
                .skip(skip)
                .limit(limit)
                .toList();

        ParesSugeridosCompensacaoResponse response = new ParesSugeridosCompensacaoResponse();
        response.setPares(pares);
        response.setTotalPares(totalFiltrado);
        response.setPage(page);
        response.setTotalPages(totalFiltrado == 0 ? 0 : (int) Math.ceil((double) totalFiltrado / limit));
        return response;
    }

    private List<ParCompensacaoSugeridoResponse> coletarParesFiltradosPorDiaUtil(
            Integer numeroBanco,
            Integer ano,
            Integer mes,
            boolean apenasInterbancario,
            int skip,
            int limit) {
        long totalSql = lancamentoRepository.countParesCompensacaoSugeridos(
                numeroBanco, ano, mes, DIAS_TOLERANCIA_SQL, apenasInterbancario);
        List<ParCompensacaoSugeridoResponse> resultado = new ArrayList<>();
        int ignorados = 0;
        int sqlOffset = 0;
        int batchSize = 500;
        while (resultado.size() < limit && sqlOffset < totalSql) {
            List<Object[]> rows = lancamentoRepository.findParesCompensacaoSugeridosIds(
                    numeroBanco, ano, mes, DIAS_TOLERANCIA_SQL, apenasInterbancario, batchSize, sqlOffset);
            if (rows.isEmpty()) {
                break;
            }
            sqlOffset += rows.size();
            for (ParCompensacaoSugeridoResponse par : mapearParesFiltradosPorDiaUtil(rows, rows.size())) {
                if (ignorados < skip) {
                    ignorados++;
                    continue;
                }
                resultado.add(par);
                if (resultado.size() >= limit) {
                    break;
                }
            }
        }
        return resultado;
    }

    private List<ParCompensacaoSugeridoResponse> mapearParesFiltradosPorDiaUtil(List<Object[]> rows, int maxPares) {
        Set<Long> ids = new LinkedHashSet<>();
        List<long[]> paresMeta = new ArrayList<>();
        for (Object[] row : rows) {
            long idA = ((Number) row[0]).longValue();
            long idB = ((Number) row[1]).longValue();
            ids.add(idA);
            ids.add(idB);
            Integer nbA = row[2] != null ? ((Number) row[2]).intValue() : null;
            Integer nbB = row[3] != null ? ((Number) row[3]).intValue() : null;
            paresMeta.add(new long[] {idA, idB, nbA != null ? nbA.longValue() : -1L, nbB != null ? nbB.longValue() : -1L});
        }

        Map<Long, LancamentoFinanceiroEntity> porId = carregarPorIds(ids);
        List<ParCompensacaoSugeridoResponse> pares = new ArrayList<>();
        for (long[] meta : paresMeta) {
            if (pares.size() >= maxPares) {
                break;
            }
            LancamentoFinanceiroEntity a = porId.get(meta[0]);
            LancamentoFinanceiroEntity b = porId.get(meta[1]);
            if (a == null || b == null) {
                continue;
            }
            if (!mesmoDiaUtilParaCompensacao(a.getDataLancamento(), b.getDataLancamento())) {
                continue;
            }
            ParCompensacaoSugeridoResponse par = new ParCompensacaoSugeridoResponse();
            par.setLancamentoA(toLancamentoResponse(a));
            par.setLancamentoB(toLancamentoResponse(b));
            par.setTipo(classificarTipoPar(meta[2], meta[3], a, b));
            par.setConfianca(ConfiancaSugestao.ALTA);
            pares.add(par);
        }
        return pares;
    }

    private static boolean mesmoDiaUtilParaCompensacao(LocalDate dataA, LocalDate dataB) {
        return CompensacaoDateUtils.mesmoDiaUtilBancario(dataA, dataB);
    }

    @Transactional(readOnly = true)
    public GruposCompensacaoInconsistentesResponse listarGruposInconsistentes(int page, int size) {
        int limit = Math.max(1, Math.min(size, 100));
        int offset = Math.max(0, page) * limit;
        long total = lancamentoRepository.countGruposCompensacaoInconsistentes();
        List<Object[]> resumos = lancamentoRepository.findGruposCompensacaoInconsistentesResumo(limit, offset);

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
        List<ParCompensacaoSugeridoResponse> candidatos = coletarParesFiltradosPorDiaUtil(
                request.getNumeroBanco(), ano, mes, apenasInterbancarioSql, 0, Integer.MAX_VALUE);
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
            Long clienteId = e.getCliente() != null ? e.getCliente().getId() : null;
            e.setEtapa(EtapaLancamento.calcular(contaE.getCodigo(), grupo, clienteId));
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
        d.setLancamentoA(resumoPar(par.getLancamentoA()));
        d.setLancamentoB(resumoPar(par.getLancamentoB()));
        d.setTipo(par.getTipo());
        return d;
    }

    private ResumoLancamentoParResponse resumoPar(LancamentoFinanceiroResponse l) {
        ResumoLancamentoParResponse r = new ResumoLancamentoParResponse();
        r.setId(l.getId());
        r.setBanco(l.getBancoNome());
        r.setDescricao(l.getDescricao());
        r.setValor(l.getValor());
        r.setNatureza(l.getNatureza());
        return r;
    }

    private LancamentoFinanceiroResponse toLancamentoResponse(LancamentoFinanceiroEntity e) {
        LancamentoFinanceiroResponse r = new LancamentoFinanceiroResponse();
        r.setId(e.getId());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        r.setClienteId(e.getCliente() != null ? e.getCliente().getId() : null);
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        if (e.getCliente() != null) {
            r.setCodigoCliente(CodigoClienteUtil.formatar(e.getCliente().getId()));
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
