package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Mescla débitos novos nas rodadas de cálculo por dimensão (cascata parcelamento aceito),
 * sem duplicar por chave {@code vencimentoNormalizado|valorCentavos}.
 */
@Service
public class CalculoCobrancaMergeService {

    private final CalculoRodadaRepository rodadaRepository;
    private final CalculoApplicationService calculoApplicationService;
    private final ObjectMapper objectMapper;

    public CalculoCobrancaMergeService(
            CalculoRodadaRepository rodadaRepository,
            CalculoApplicationService calculoApplicationService,
            ObjectMapper objectMapper) {
        this.rodadaRepository = rodadaRepository;
        this.calculoApplicationService = calculoApplicationService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ResultadoMerge mesclarDebitos(
            String codigoCliente8, int numeroProcesso, List<DebitoNovo> novos, String importacaoId) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente8);
        if (numeroProcesso < 1) {
            throw new BusinessRuleException("Número interno do processo inválido.");
        }
        List<DebitoNovo> entrada = novos == null ? List.of() : List.copyOf(novos);

        List<DimResumo> dims = carregarDimensoes(cod8, numeroProcesso);
        List<ResultadoMerge.DebitoIgnorado> ignorados = new ArrayList<>();
        Map<Integer, List<DebitoNovo>> filaPorDim = new LinkedHashMap<>();
        Map<String, Long> vencimentosCadastrados = carregarVencimentosCadastrados(cod8, numeroProcesso, dims);

        if (dims.isEmpty()) {
            if (!entrada.isEmpty()) {
                List<DebitoNovo> fila0 = new ArrayList<>();
                for (DebitoNovo debito : entrada) {
                    validarSemConflitoValor(vencimentosCadastrados, debito);
                    registrarVencimentoValor(vencimentosCadastrados, debito);
                    fila0.add(debito);
                }
                filaPorDim.put(0, fila0);
            }
        } else {
            Map<Integer, Set<String>> chavesPorDim = new HashMap<>();
            for (DimResumo d : dims) {
                chavesPorDim.put(d.dimensao(), extrairChavesTitulos(cod8, numeroProcesso, d.dimensao()));
            }
            for (DebitoNovo debito : entrada) {
                String chave = chaveDedup(debito);
                boolean resolvido = false;
                Integer alvo = null;
                for (DimResumo dim : dims) {
                    Set<String> chaves = chavesPorDim.get(dim.dimensao());
                    if (chaves.contains(chave)) {
                        ignorados.add(ResultadoMerge.DebitoIgnorado.of(debito, dim.dimensao()));
                        resolvido = true;
                        break;
                    }
                    if (!dim.parcelamentoAceito()) {
                        alvo = dim.dimensao();
                        break;
                    }
                }
                if (!resolvido) {
                    validarSemConflitoValor(vencimentosCadastrados, debito);
                    if (alvo == null) {
                        int novaDim = dims.stream().mapToInt(DimResumo::dimensao).max().orElse(-1) + 1;
                        alvo = novaDim;
                        dims = new ArrayList<>(dims);
                        dims.add(new DimResumo(novaDim, false));
                        chavesPorDim.put(novaDim, new HashSet<>());
                    }
                    filaPorDim.computeIfAbsent(alvo, k -> new ArrayList<>()).add(debito);
                    chavesPorDim.get(alvo).add(chave);
                    registrarVencimentoValor(vencimentosCadastrados, debito);
                }
            }
        }

        List<ResultadoMerge.DimensaoTocada> tocadas = new ArrayList<>();
        for (Map.Entry<Integer, List<DebitoNovo>> e : filaPorDim.entrySet()) {
            if (e.getValue().isEmpty()) {
                continue;
            }
            int dim = e.getKey();
            boolean criada = rodadaRepository
                    .findByCodigoClienteAndNumeroProcessoAndDimensao(cod8, numeroProcesso, dim)
                    .isEmpty();
            List<ResultadoMerge.InsercaoDebito> insercoes = persistirInsercoes(cod8, numeroProcesso, dim, e.getValue(), criada, importacaoId);
            tocadas.add(new ResultadoMerge.DimensaoTocada(dim, criada, insercoes));
        }

        return new ResultadoMerge(List.copyOf(tocadas), List.copyOf(ignorados));
    }

    private List<DimResumo> carregarDimensoes(String cod8, int numeroProcesso) {
        List<DimResumo> out = new ArrayList<>();
        for (CalculoRodadaResumoProjection row :
                rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(cod8, numeroProcesso)) {
            if (row.dimensao() == null) {
                continue;
            }
            out.add(new DimResumo(row.dimensao(), row.parcelamentoAceito()));
        }
        return out;
    }

    private Set<String> extrairChavesTitulos(String cod8, int numeroProcesso, int dimensao) {
        Set<String> chaves = new HashSet<>();
        Optional<JsonNode> opt = calculoApplicationService.obterRodada(cod8, numeroProcesso, dimensao);
        if (opt.isEmpty() || !opt.get().isObject()) {
            return chaves;
        }
        JsonNode titulos = opt.get().get("titulos");
        if (titulos == null || !titulos.isArray()) {
            return chaves;
        }
        for (JsonNode t : titulos) {
            if (t == null || !t.isObject()) {
                continue;
            }
            String data = CalculoApplicationService.normalizaDataVencimento(textOrEmpty(t.get("dataVencimento")));
            long centavos = CalculoApplicationService.parseValorInicialParaCentavos(textOrEmpty(t.get("valorInicial")));
            if (!data.isEmpty() && centavos > 0) {
                chaves.add(chaveDedup(data, centavos));
            }
        }
        return chaves;
    }

    private Map<String, Long> carregarVencimentosCadastrados(String cod8, int numeroProcesso, List<DimResumo> dims) {
        Map<String, Long> out = new LinkedHashMap<>();
        for (DimResumo d : dims) {
            mesclarVencimentosDimensao(out, extrairVencimentoValorCentavos(cod8, numeroProcesso, d.dimensao()));
        }
        return out;
    }

    private Map<String, Long> extrairVencimentoValorCentavos(String cod8, int numeroProcesso, int dimensao) {
        Map<String, Long> out = new LinkedHashMap<>();
        Optional<JsonNode> opt = calculoApplicationService.obterRodada(cod8, numeroProcesso, dimensao);
        if (opt.isEmpty() || !opt.get().isObject()) {
            return out;
        }
        JsonNode titulos = opt.get().get("titulos");
        if (titulos == null || !titulos.isArray()) {
            return out;
        }
        for (JsonNode t : titulos) {
            if (t == null || !t.isObject()) {
                continue;
            }
            String data = CalculoApplicationService.normalizaDataVencimento(textOrEmpty(t.get("dataVencimento")));
            long centavos = CalculoApplicationService.parseValorInicialParaCentavos(textOrEmpty(t.get("valorInicial")));
            if (data.isEmpty() || centavos <= 0) {
                continue;
            }
            Long existente = out.get(data);
            if (existente != null && existente != centavos) {
                throw new BusinessRuleException(
                        "Revisão manual necessária: cálculo existente inconsistente para vencimento "
                                + textOrEmpty(t.get("dataVencimento"))
                                + ".");
            }
            out.put(data, centavos);
        }
        return out;
    }

    private static void mesclarVencimentosDimensao(Map<String, Long> destino, Map<String, Long> origem) {
        for (Map.Entry<String, Long> e : origem.entrySet()) {
            Long existente = destino.get(e.getKey());
            if (existente != null && !existente.equals(e.getValue())) {
                throw new BusinessRuleException(
                        "Revisão manual necessária: vencimento "
                                + e.getKey()
                                + " com valores diferentes entre dimensões do cálculo.");
            }
            destino.put(e.getKey(), e.getValue());
        }
    }

    private static void validarSemConflitoValor(Map<String, Long> vencimentosCadastrados, DebitoNovo debito) {
        String venc = CalculoApplicationService.normalizaDataVencimento(debito.vencimento());
        if (venc.isEmpty() || debito.valorCentavos() <= 0) {
            return;
        }
        Long existente = vencimentosCadastrados.get(venc);
        if (existente != null && existente != debito.valorCentavos()) {
            throw new BusinessRuleException(
                    "Revisão manual necessária: vencimento "
                            + debito.vencimento()
                            + " já cadastrado com valor "
                            + formatBrl(existente)
                            + ", mas o PDF/planilha traz "
                            + formatBrl(debito.valorCentavos())
                            + ".");
        }
    }

    private static void registrarVencimentoValor(Map<String, Long> vencimentosCadastrados, DebitoNovo debito) {
        String venc = CalculoApplicationService.normalizaDataVencimento(debito.vencimento());
        if (venc.isEmpty() || debito.valorCentavos() <= 0) {
            return;
        }
        vencimentosCadastrados.put(venc, debito.valorCentavos());
    }

    private List<ResultadoMerge.InsercaoDebito> persistirInsercoes(
            String cod8,
            int numeroProcesso,
            int dimensao,
            List<DebitoNovo> debitos,
            boolean dimensaoCriada,
            String importacaoId) {
        ObjectNode payload;
        int posicaoInicial;
        if (dimensaoCriada) {
            payload = montarPayloadInicial(debitos);
            posicaoInicial = 0;
        } else {
            Optional<JsonNode> opt = calculoApplicationService.obterRodada(cod8, numeroProcesso, dimensao);
            if (opt.isPresent() && opt.get().isObject()) {
                payload = (ObjectNode) opt.get().deepCopy();
            } else {
                payload = objectMapper.createObjectNode();
            }
            posicaoInicial = payload.has("titulos") && payload.get("titulos").isArray()
                    ? payload.get("titulos").size()
                    : 0;
            for (DebitoNovo d : debitos) {
                appendDebitoNoPayload(payload, d);
            }
        }

        calculoApplicationService.salvarRodada(cod8, numeroProcesso, dimensao, payload, importacaoId);

        List<ResultadoMerge.InsercaoDebito> insercoes = new ArrayList<>();
        for (int i = 0; i < debitos.size(); i++) {
            insercoes.add(new ResultadoMerge.InsercaoDebito(dimensao, posicaoInicial + i, debitos.get(i)));
        }
        return insercoes;
    }

    private ObjectNode montarPayloadInicial(List<DebitoNovo> debitos) {
        int n = debitos.size();
        String qtd = n <= 99 ? String.format(Locale.ROOT, "%02d", n) : String.valueOf(n);

        ArrayNode titulos = objectMapper.createArrayNode();
        ArrayNode parcelas = objectMapper.createArrayNode();
        for (DebitoNovo c : debitos) {
            appendDebitoNodes(titulos, parcelas, c);
        }

        ObjectNode root = objectMapper.createObjectNode();
        root.put("pagina", 1);
        root.put("paginaParcelamento", 1);
        root.put("parcelamentoAceito", false);
        root.put("quantidadeParcelasInformada", qtd);
        root.put("taxaJurosParcelamento", "0,00");
        root.put("limpezaAtiva", false);
        root.putNull("snapshotAntesLimpeza");
        ObjectNode cab = objectMapper.createObjectNode();
        cab.put("autor", "");
        cab.put("reu", "");
        root.set("cabecalho", cab);
        root.set("honorariosDataRecebimento", objectMapper.createObjectNode());
        root.set("titulos", titulos);
        root.set("parcelas", parcelas);
        root.putNull("panelConfig");
        return root;
    }

    private void appendDebitoNoPayload(ObjectNode payload, DebitoNovo debito) {
        ArrayNode titulos = ensureArray(payload, "titulos");
        ArrayNode parcelas = ensureArray(payload, "parcelas");
        appendDebitoNodes(titulos, parcelas, debito);
        int n = titulos.size();
        String qtd = n <= 99 ? String.format(Locale.ROOT, "%02d", n) : String.valueOf(n);
        payload.put("quantidadeParcelasInformada", qtd);
    }

    private void appendDebitoNodes(ArrayNode titulos, ArrayNode parcelas, DebitoNovo c) {
        String brl = formatBrl(c.valorCentavos());
        String desc = c.descricao() != null ? c.descricao().trim() : "";
        ObjectNode t = objectMapper.createObjectNode();
        t.put("dataVencimento", c.vencimento());
        t.put("valorInicial", brl);
        t.put("atualizacaoMonetaria", "");
        t.put("diasAtraso", "");
        t.put("juros", "");
        t.put("multa", "");
        t.put("honorarios", "");
        t.put("total", brl);
        t.put("descricaoValor", desc);
        t.putNull("datasEspeciais");
        titulos.add(t);

        ObjectNode p = objectMapper.createObjectNode();
        p.put("dataVencimento", c.vencimento());
        p.put("valorParcela", brl);
        p.put("honorariosParcela", "");
        p.put("observacao", "");
        p.put("dataPagamento", c.vencimento());
        parcelas.add(p);
    }

    private ArrayNode ensureArray(ObjectNode payload, String field) {
        JsonNode node = payload.get(field);
        if (node instanceof ArrayNode array) {
            return array;
        }
        ArrayNode created = objectMapper.createArrayNode();
        payload.set(field, created);
        return created;
    }

    private static String chaveDedup(DebitoNovo debito) {
        return chaveDedup(
                CalculoApplicationService.normalizaDataVencimento(debito.vencimento()), debito.valorCentavos());
    }

    private static String chaveDedup(String vencimentoNormalizado, long valorCentavos) {
        return vencimentoNormalizado + "|" + valorCentavos;
    }

    private static String textOrEmpty(JsonNode n) {
        if (n == null || n.isNull()) {
            return "";
        }
        return n.asText("").trim();
    }

    private static String formatBrl(long centavos) {
        BigDecimal bd = BigDecimal.valueOf(centavos, 2);
        DecimalFormatSymbols sym = DecimalFormatSymbols.getInstance(Locale.of("pt", "BR"));
        DecimalFormat df = new DecimalFormat("#,##0.00", sym);
        return "R$ " + df.format(bd);
    }

    private record DimResumo(int dimensao, boolean parcelamentoAceito) {}
}
