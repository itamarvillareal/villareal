package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.api.dto.AcordoDescumpridoProporRequest;
import br.com.vilareal.calculo.api.dto.AcordoDescumpridoProporResponse;
import br.com.vilareal.calculo.api.dto.AcordoDescumpridoProporResponse.ParcelaConvertidaResumo;
import br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.calculo.model.RodadaCalculoChave;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class AcordoDescumpridoApplicationService {

    private final CalculoApplicationService calculoApplicationService;
    private final CalculoRodadaRepository rodadaRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteRepository clienteRepository;
    private final AcordoOperacaoAndamentoService andamentoService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public AcordoDescumpridoApplicationService(
            CalculoApplicationService calculoApplicationService,
            CalculoRodadaRepository rodadaRepository,
            ProcessoRepository processoRepository,
            ClienteRepository clienteRepository,
            AcordoOperacaoAndamentoService andamentoService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.calculoApplicationService = calculoApplicationService;
        this.rodadaRepository = rodadaRepository;
        this.processoRepository = processoRepository;
        this.clienteRepository = clienteRepository;
        this.andamentoService = andamentoService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AcordoDescumpridoProporResponse propor(AcordoDescumpridoProporRequest req) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(req.codigoCliente());
        int proc = req.numeroProcesso();
        int dimOrigem = req.dimensaoAcordo();
        if (proc < 1) {
            throw new BusinessRuleException("Número interno do processo inválido.");
        }

        JsonNode origem = calculoApplicationService
                .obterRodada(cod8, proc, dimOrigem)
                .orElseThrow(() -> new BusinessRuleException("Rodada de acordo não encontrada."));

        if (!origem.path("parcelamentoAceito").asBoolean(false)) {
            throw new BusinessRuleException("A rodada informada não possui parcelamento aceito.");
        }

        List<ParcelaAberta> abertas = extrairParcelasAbertas(origem);
        if (abertas.isEmpty()) {
            throw new BusinessRuleException("Não há parcelas em aberto para declarar descumprimento.");
        }

        validarSemDuplicacao(cod8, proc, dimOrigem, abertas);

        int dimNova = resolverDimensaoDestino(cod8, proc, dimOrigem);
        ObjectNode payload = montarPayloadDescumprimento(origem, abertas);

        calculoApplicationService.salvarRodada(cod8, proc, dimNova, payload);

        long totalPrincipal = abertas.stream().mapToLong(ParcelaAberta::valorCentavos).sum();
        List<ParcelaConvertidaResumo> resumo = abertas.stream()
                .map(p -> new ParcelaConvertidaResumo(
                        p.numero(), p.dataVencimento(), p.valorCentavos(), p.honorariosCentavos()))
                .toList();

        if (req.registrarHistorico()) {
            registrarHistorico(cod8, proc, dimOrigem, dimNova, abertas);
        }

        String chave = new RodadaCalculoChave(cod8, proc, dimNova).toMapKey();
        return new AcordoDescumpridoProporResponse(dimNova, chave, payload, resumo, totalPrincipal);
    }

    private record ParcelaAberta(int numero, String dataVencimento, long valorCentavos, long honorariosCentavos) {}

    private List<ParcelaAberta> extrairParcelasAbertas(JsonNode rodada) {
        JsonNode parcelas = rodada.path("parcelas");
        if (!parcelas.isArray()) {
            return List.of();
        }
        int limite = lerQuantidadeParcelas(rodada, parcelas.size());
        List<ParcelaAberta> out = new ArrayList<>();
        for (int i = 0; i < limite && i < parcelas.size(); i++) {
            JsonNode p = parcelas.get(i);
            if (p == null || !p.isObject()) {
                continue;
            }
            String dataPag = text(p.get("dataPagamento"));
            if (StringUtils.hasText(dataPag)) {
                continue;
            }
            long valor = CalculoApplicationService.parseValorInicialParaCentavos(text(p.get("valorParcela")));
            long hon = CalculoApplicationService.parseValorInicialParaCentavos(text(p.get("honorariosParcela")));
            if (valor <= 0 && hon <= 0) {
                continue;
            }
            String venc = text(p.get("dataVencimento"));
            if (!StringUtils.hasText(venc)) {
                continue;
            }
            out.add(new ParcelaAberta(i + 1, venc, valor, hon));
        }
        return out;
    }

    private void validarSemDuplicacao(String cod8, int proc, int dimOrigem, List<ParcelaAberta> abertas) {
        List<CalculoRodadaResumoProjection> dims =
                rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(cod8, proc);
        Set<String> chavesExistentes = new HashSet<>();
        for (CalculoRodadaResumoProjection d : dims) {
            if (d.dimensao() == null || d.dimensao() <= dimOrigem) {
                continue;
            }
            Optional<JsonNode> opt = calculoApplicationService.obterRodada(cod8, proc, d.dimensao());
            if (opt.isEmpty()) {
                continue;
            }
            JsonNode titulos = opt.get().path("titulos");
            if (!titulos.isArray()) {
                continue;
            }
            for (JsonNode t : titulos) {
                String data = CalculoApplicationService.normalizaDataVencimento(text(t.get("dataVencimento")));
                long cent = CalculoApplicationService.parseValorInicialParaCentavos(text(t.get("valorInicial")));
                if (StringUtils.hasText(data) && cent > 0) {
                    chavesExistentes.add(data + "|" + cent);
                }
            }
        }
        for (ParcelaAberta p : abertas) {
            String data = CalculoApplicationService.normalizaDataVencimento(p.dataVencimento());
            String chave = data + "|" + p.valorCentavos();
            if (chavesExistentes.contains(chave)) {
                throw new BusinessRuleException(
                        "Já existem títulos na dimensão posterior para a parcela "
                                + p.numero()
                                + " (venc. "
                                + p.dataVencimento()
                                + "). Revise manualmente.");
            }
        }
    }

    private int resolverDimensaoDestino(String cod8, int proc, int dimOrigem) {
        List<CalculoRodadaResumoProjection> dims =
                rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(cod8, proc);
        int maxDim = dims.stream().mapToInt(d -> d.dimensao() != null ? d.dimensao() : 0).max().orElse(dimOrigem);
        for (CalculoRodadaResumoProjection d : dims) {
            int dim = d.dimensao() != null ? d.dimensao() : 0;
            if (dim > dimOrigem && !d.parcelamentoAceito()) {
                Optional<JsonNode> existente = calculoApplicationService.obterRodada(cod8, proc, dim);
                if (existente.isPresent() && existente.get().path("titulos").size() > 0) {
                    return dim;
                }
            }
        }
        return maxDim + 1;
    }

    private ObjectNode montarPayloadDescumprimento(JsonNode origem, List<ParcelaAberta> abertas) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("pagina", 1);
        root.put("paginaParcelamento", 1);
        root.put("parcelamentoAceito", false);
        root.put("limpezaAtiva", false);
        root.putNull("snapshotAntesLimpeza");
        root.put("taxaJurosParcelamento", "0,00");
        root.put("entradaParcelamentoModo", "nenhuma");

        if (origem.has("cabecalho")) {
            root.set("cabecalho", origem.get("cabecalho").deepCopy());
        }
        if (origem.has("panelConfig")) {
            root.set("panelConfig", origem.get("panelConfig").deepCopy());
        }
        if (origem.has("dataCalculoRodada")) {
            root.put("dataCalculoRodada", origem.get("dataCalculoRodada").asText());
        }

        ArrayNode titulos = objectMapper.createArrayNode();
        ArrayNode parcelas = objectMapper.createArrayNode();
        for (ParcelaAberta p : abertas) {
            String brl = formatBrl(p.valorCentavos());
            String honBrl = p.honorariosCentavos() > 0 ? formatBrl(p.honorariosCentavos()) : "";
            ObjectNode t = objectMapper.createObjectNode();
            t.put("dataVencimento", p.dataVencimento());
            t.put("valorInicial", brl);
            t.put("atualizacaoMonetaria", "");
            t.put("diasAtraso", "");
            t.put("juros", "");
            t.put("multa", "");
            t.put("honorarios", honBrl);
            t.put("total", brl);
            t.put("descricaoValor", "Parcela " + p.numero() + " — acordo descumprido");
            t.putNull("datasEspeciais");
            titulos.add(t);

            ObjectNode par = objectMapper.createObjectNode();
            par.put("dataVencimento", p.dataVencimento());
            par.put("valorParcela", brl);
            par.put("honorariosParcela", honBrl);
            par.put("observacao", "Acordo descumprido");
            par.put("dataPagamento", "");
            parcelas.add(par);
        }

        int n = titulos.size();
        String qtd = n <= 99 ? String.format(Locale.ROOT, "%02d", n) : String.valueOf(n);
        root.put("quantidadeParcelasInformada", qtd);
        root.set("titulos", titulos);
        root.set("parcelas", parcelas);
        root.set("honorariosDataRecebimento", objectMapper.createObjectNode());
        return root;
    }

    private void registrarHistorico(String cod8, int proc, int dimOrigem, int dimNova, List<ParcelaAberta> abertas) {
        ProcessoEntity processo = resolverProcesso(cod8, proc);
        if (processo == null) {
            return;
        }
        StringBuilder det = new StringBuilder();
        det.append("Parcelas convertidas em títulos na dimensão ")
                .append(dimNova)
                .append(":\n");
        for (ParcelaAberta p : abertas) {
            det.append("- Parcela ")
                    .append(p.numero())
                    .append(": venc. ")
                    .append(p.dataVencimento())
                    .append(", valor ")
                    .append(formatBrl(p.valorCentavos()));
            if (p.honorariosCentavos() > 0) {
                det.append(", honor. ").append(formatBrl(p.honorariosCentavos()));
            }
            det.append('\n');
        }
        andamentoService.registrar(
                processo.getId(),
                AcordoOperacaoAndamentoService.ORIGEM_DESCUMPRIMENTO,
                AcordoOperacaoAndamentoService.tituloDescumprimento(proc, dimOrigem, dimNova),
                det.toString().trim(),
                AcordoOperacaoAndamentoService.novoImportacaoId());
    }

    private ProcessoEntity resolverProcesso(String cod8, int proc) {
        return clienteRepository
                .findByCodigoCliente(cod8)
                .flatMap(c -> processoRepository.findByCliente_IdAndNumeroInterno(c.getId(), proc))
                .or(() -> processoRepository.findByNumeroInternoOrderByIdAsc(proc).stream().findFirst())
                .orElse(null);
    }

    private static int lerQuantidadeParcelas(JsonNode payload, int tamanhoArray) {
        JsonNode q = payload.get("quantidadeParcelasInformada");
        if (q == null || q.isNull()) {
            return tamanhoArray;
        }
        String digits = q.asText("").replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return tamanhoArray;
        }
        try {
            int n = Integer.parseInt(digits);
            return n > 0 ? Math.min(n, tamanhoArray) : tamanhoArray;
        } catch (NumberFormatException e) {
            return tamanhoArray;
        }
    }

    private static String text(JsonNode n) {
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
}
