package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.api.dto.CalculoClienteConfigResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadaResumoItem;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResumoResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasWriteRequest;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoClienteConfigEntity;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoClienteConfigRepository;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.calculo.model.RodadaCalculoChave;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CalculoApplicationService {

    private static final Logger log = LoggerFactory.getLogger(CalculoApplicationService.class);

    private final CalculoRodadaRepository rodadaRepository;
    private final CalculoClienteConfigRepository clienteConfigRepository;
    private final PessoaRepository pessoaRepository;
    private final ObjectMapper objectMapper;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;

    public CalculoApplicationService(
            CalculoRodadaRepository rodadaRepository,
            CalculoClienteConfigRepository clienteConfigRepository,
            PessoaRepository pessoaRepository,
            ObjectMapper objectMapper,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver) {
        this.rodadaRepository = rodadaRepository;
        this.clienteConfigRepository = clienteConfigRepository;
        this.pessoaRepository = pessoaRepository;
        this.objectMapper = objectMapper;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
    }

    @Transactional(readOnly = true)
    public CalculoRodadasResponse listarRodadas() {
        Map<String, JsonNode> map = new HashMap<>();
        for (CalculoRodadaEntity row : rodadaRepository.findAll()) {
            if (!chaveRodadaCompleta(row)) {
                log.warn(
                        "calculo_rodada id={} omitida em GET /rodadas: codigo_cliente, numero_processo ou dimensao nulos",
                        row.getId());
                continue;
            }
            JsonNode payload = corrigirPayloadJsonRodadaTolerante(row);
            if (payload == null) {
                payload = objectMapper.createObjectNode();
            }
            map.put(
                    new RodadaCalculoChave(row.getCodigoCliente(), row.getNumeroProcesso(), row.getDimensao())
                            .toMapKey(),
                    payload);
        }
        return new CalculoRodadasResponse(map);
    }

    @Transactional(readOnly = true)
    public Optional<JsonNode> obterRodada(String codigoCliente, int numeroProcesso, int dimensao) {
        return obterRodada(codigoCliente, numeroProcesso, dimensao, null, null);
    }

    /**
     * @param titulosPage 1-based; com {@code titulosLimit} aplica fatia em {@code titulos[]} (não em
     *     {@code titulosGravadosAceito}).
     * @param titulosLimit padrão 20 quando {@code titulosPage} informado
     */
    @Transactional(readOnly = true)
    public Optional<JsonNode> obterRodada(
            String codigoCliente, int numeroProcesso, int dimensao, Integer titulosPage, Integer titulosLimit) {
        RodadaCalculoChave chave = RodadaCalculoChave.fromPath(codigoCliente, numeroProcesso, dimensao);
        return rodadaRepository
                .findByCodigoClienteAndNumeroProcessoAndDimensao(
                        chave.codigoCliente(), chave.numeroProcesso(), chave.dimensao())
                .map(e -> {
                    JsonNode p = corrigirPayloadJsonRodadaTolerante(e);
                    if (p == null || !p.isObject()) {
                        return objectMapper.createObjectNode();
                    }
                    if (titulosPage == null && titulosLimit == null) {
                        return p;
                    }
                    return aplicarPaginacaoTitulosNoPayload((ObjectNode) p, titulosPage, titulosLimit);
                });
    }

    /**
     * Upsert de uma única rodada; não remove nem altera outras chaves (diferente de {@link #substituirRodadas}).
     */
    @Transactional
    public JsonNode salvarRodada(String codigoCliente, int numeroProcesso, int dimensao, JsonNode payload) {
        return salvarRodada(codigoCliente, numeroProcesso, dimensao, payload, null);
    }

    /**
     * @param importacaoIdParaNovaRodada se não nulo, gravado apenas quando a rodada é <strong>inserida</strong> (não
     *     em atualização de linha já existente).
     */
    @Transactional
    public JsonNode salvarRodada(
            String codigoCliente,
            int numeroProcesso,
            int dimensao,
            JsonNode payload,
            String importacaoIdParaNovaRodada) {
        RodadaCalculoChave chave = RodadaCalculoChave.fromPath(codigoCliente, numeroProcesso, dimensao);
        if (payload == null || !payload.isObject()) {
            throw new BusinessRuleException("Rodada deve ser um objeto JSON");
        }
        CalculoRodadaEntity entity = rodadaRepository
                .findByCodigoClienteAndNumeroProcessoAndDimensao(
                        chave.codigoCliente(), chave.numeroProcesso(), chave.dimensao())
                .orElseGet(CalculoRodadaEntity::new);
        boolean inserindo = entity.getId() == null;
        entity.setCodigoCliente(chave.codigoCliente());
        entity.setNumeroProcesso(chave.numeroProcesso());
        entity.setDimensao(chave.dimensao());
        entity.setPayloadJson(payload);
        sincronizarParcelamentoAceito(entity, payload);
        if (inserindo && StringUtils.hasText(importacaoIdParaNovaRodada)) {
            entity.setImportacaoId(importacaoIdParaNovaRodada.trim());
        }
        CalculoRodadaEntity saved = rodadaRepository.save(entity);
        return corrigirPayloadJson(saved.getPayloadJson());
    }

    @Transactional(readOnly = true)
    public CalculoRodadasResumoResponse listarResumoRodadas() {
        List<CalculoRodadaResumoItem> items = new ArrayList<>();
        for (CalculoRodadaResumoProjection row : rodadaRepository.findAllResumo()) {
            RodadaCalculoChave ch = new RodadaCalculoChave(
                    row.codigoCliente(), row.numeroProcesso(), row.dimensao());
            items.add(new CalculoRodadaResumoItem(ch.toMapKey(), row.parcelamentoAceito()));
        }
        items.sort(Comparator.comparing(CalculoRodadaResumoItem::chave));
        return new CalculoRodadasResumoResponse(items);
    }

    private static boolean chaveRodadaCompleta(CalculoRodadaEntity row) {
        return row.getCodigoCliente() != null
                && row.getNumeroProcesso() != null
                && row.getDimensao() != null;
    }

    /**
     * Evita 500 em listagens quando {@code payload_json} está corrompido ou a correção de encoding falha.
     *
     * @return payload corrigido; {@code null} se não houver payload ou se for ilegível (tratado como sem dados)
     */
    private JsonNode corrigirPayloadJsonRodadaTolerante(CalculoRodadaEntity row) {
        if (row.getPayloadJson() == null) {
            return null;
        }
        try {
            return corrigirPayloadJson(row.getPayloadJson());
        } catch (RuntimeException e) {
            log.warn(
                    "calculo_rodada id={} ({}, {}, {}): payload ilegível — {}",
                    row.getId(),
                    row.getCodigoCliente(),
                    row.getNumeroProcesso(),
                    row.getDimensao(),
                    e.getMessage());
            return null;
        }
    }

    private ObjectNode aplicarPaginacaoTitulosNoPayload(ObjectNode payload, Integer titulosPage, Integer titulosLimit) {
        ObjectNode out = payload.deepCopy();
        JsonNode titulosNode = out.get("titulos");
        if (titulosNode == null || !titulosNode.isArray()) {
            return out;
        }
        int page = titulosPage != null && titulosPage > 0 ? titulosPage : 1;
        int limit = titulosLimit != null && titulosLimit > 0 ? Math.min(titulosLimit, 500) : 20;
        int total = titulosNode.size();
        int start = (page - 1) * limit;
        int end = Math.min(start + limit, total);
        ArrayNode paginated = objectMapper.createArrayNode();
        if (start < total) {
            for (int i = start; i < end; i++) {
                paginated.add(titulosNode.get(i));
            }
        }
        out.set("titulos", paginated);
        int totalPages = limit > 0 ? (int) Math.ceil((double) total / limit) : 1;
        ObjectNode pagination = objectMapper.createObjectNode();
        pagination.put("page", page);
        pagination.put("limit", limit);
        pagination.put("total", total);
        pagination.put("totalPages", Math.max(1, totalPages));
        pagination.put("hasNext", page < totalPages);
        pagination.put("hasPrev", page > 1);
        out.set("titulosPagination", pagination);
        out.set("titulosResumo", calcularTitulosResumoJson(titulosNode));
        return out;
    }

    /** Soma campos monetários das linhas com {@code valorInicial} preenchido (paridade resumo geral do front). */
    private ObjectNode calcularTitulosResumoJson(JsonNode titulosNode) {
        ObjectNode resumo = objectMapper.createObjectNode();
        int qtd = 0;
        double sumValorInicial = 0;
        double sumAtualizacao = 0;
        double sumJuros = 0;
        double sumMulta = 0;
        double sumHonorarios = 0;
        double sumTotal = 0;
        long sumDias = 0;
        if (titulosNode != null && titulosNode.isArray()) {
            for (JsonNode t : titulosNode) {
                if (t == null || !t.isObject()) {
                    continue;
                }
                String vi = textOrEmpty(t.get("valorInicial"));
                if (vi.isBlank()) {
                    continue;
                }
                qtd++;
                sumValorInicial += parseBrlMonetario(vi);
                sumAtualizacao += parseBrlMonetario(textOrEmpty(t.get("atualizacaoMonetaria")));
                sumJuros += parseBrlMonetario(textOrEmpty(t.get("juros")));
                sumMulta += parseBrlMonetario(textOrEmpty(t.get("multa")));
                sumHonorarios += parseBrlMonetario(textOrEmpty(t.get("honorarios")));
                sumTotal += parseBrlMonetario(textOrEmpty(t.get("total")));
                String dias = textOrEmpty(t.get("diasAtraso")).replaceAll("\\D", "");
                if (!dias.isBlank()) {
                    try {
                        sumDias += Long.parseLong(dias);
                    } catch (NumberFormatException ignored) {
                        // ignora
                    }
                }
            }
        }
        resumo.put("quantidadeTitulos", qtd);
        resumo.put("totalValorInicial", trunc2(sumValorInicial));
        resumo.put("totalAtualizacao", trunc2(sumAtualizacao));
        resumo.put("totalJuros", trunc2(sumJuros));
        resumo.put("totalMulta", trunc2(sumMulta));
        resumo.put("totalHonorarios", trunc2(sumHonorarios));
        resumo.put("totalGeral", trunc2(sumTotal));
        resumo.put("totalDiasAtraso", sumDias);
        return resumo;
    }

    private static String textOrEmpty(JsonNode n) {
        if (n == null || n.isNull()) {
            return "";
        }
        return n.asText("").trim();
    }

    /**
     * Valor monetário de título de rodada ({@code valorInicial}, etc.) em centavos inteiros.
     * Mesma regra de {@link #parseBrlMonetario(String)}.
     */
    public static long parseValorInicialParaCentavos(String raw) {
        return Math.round(parseBrlMonetario(raw) * 100.0);
    }

    /** Normaliza data de vencimento {@code dd/MM/yyyy} para deduplicação (zero à esquerda em dia/mês). */
    public static String normalizaDataVencimento(String vencimento) {
        if (vencimento == null || vencimento.isBlank()) {
            return "";
        }
        String t = vencimento.trim();
        java.util.regex.Matcher m =
                java.util.regex.Pattern.compile("^(\\d{1,2})/(\\d{1,2})/(\\d{4})$").matcher(t);
        if (!m.matches()) {
            return t;
        }
        return String.format(
                java.util.Locale.ROOT,
                "%02d/%02d/%04d",
                Integer.parseInt(m.group(1)),
                Integer.parseInt(m.group(2)),
                Integer.parseInt(m.group(3)));
    }

    private static double parseBrlMonetario(String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        String s = raw.replaceAll("(?i)R\\$\\s?", "").trim().replace(".", "").replace(",", ".");
        s = s.replaceAll("[^\\d.-]", "");
        if (s.isBlank()) {
            return 0;
        }
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static double trunc2(double n) {
        return Math.floor(n * 100.0) / 100.0;
    }

    /** Coluna desnormalizada + campo no JSON permanecem alinhados. */
    private void sincronizarParcelamentoAceito(CalculoRodadaEntity entity, JsonNode payload) {
        boolean aceito = lerParcelamentoAceito(payload);
        entity.setParcelamentoAceito(aceito);
        if (payload instanceof ObjectNode objectNode) {
            objectNode.put("parcelamentoAceito", aceito);
        }
    }

    private static boolean lerParcelamentoAceito(JsonNode payload) {
        if (payload == null || !payload.has("parcelamentoAceito")) {
            return false;
        }
        JsonNode n = payload.get("parcelamentoAceito");
        if (n.isBoolean()) {
            return n.booleanValue();
        }
        if (n.isTextual()) {
            String t = n.asText().trim();
            return "true".equalsIgnoreCase(t) || "1".equals(t) || "sim".equalsIgnoreCase(t);
        }
        if (n.isNumber()) {
            return n.asInt() != 0;
        }
        return false;
    }

    @Transactional
    public void substituirRodadas(CalculoRodadasWriteRequest request) {
        Map<String, JsonNode> incoming = request.rodadas();
        if (incoming.isEmpty()) {
            rodadaRepository.deleteAll();
            return;
        }
        for (Map.Entry<String, JsonNode> e : incoming.entrySet()) {
            RodadaCalculoChave chave = RodadaCalculoChave.parse(e.getKey());
            JsonNode payload = e.getValue();
            if (payload == null || !payload.isObject()) {
                throw new BusinessRuleException("Cada rodada deve ser um objeto JSON: " + e.getKey());
            }
            CalculoRodadaEntity entity = rodadaRepository
                    .findByCodigoClienteAndNumeroProcessoAndDimensao(
                            chave.codigoCliente(), chave.numeroProcesso(), chave.dimensao())
                    .orElseGet(CalculoRodadaEntity::new);
            entity.setCodigoCliente(chave.codigoCliente());
            entity.setNumeroProcesso(chave.numeroProcesso());
            entity.setDimensao(chave.dimensao());
            entity.setPayloadJson(payload);
            sincronizarParcelamentoAceito(entity, payload);
            rodadaRepository.save(entity);
        }
        java.util.HashSet<String> keys = new java.util.HashSet<>(incoming.keySet());
        for (CalculoRodadaResumoProjection row : rodadaRepository.findAllResumo()) {
            String k = new RodadaCalculoChave(row.codigoCliente(), row.numeroProcesso(), row.dimensao())
                    .toMapKey();
            if (!keys.contains(k)) {
                rodadaRepository.deleteByCodigoClienteAndNumeroProcessoAndDimensao(
                        row.codigoCliente(), row.numeroProcesso(), row.dimensao());
            }
        }
    }

    @Transactional(readOnly = true)
    public CalculoClienteConfigResponse obterConfigCliente(String codigoCliente) {
        String cod8 = formatarCodigoCliente(codigoCliente);
        ObjectNode merged = defaultsConfigCliente();
        clienteConfigRepository.findById(cod8).ifPresent(e -> aplicarEntityConfigCliente(merged, e));
        return new CalculoClienteConfigResponse(merged);
    }

    @Transactional
    public CalculoClienteConfigResponse salvarConfigCliente(String codigoCliente, JsonNode patch) {
        String cod8 = formatarCodigoCliente(codigoCliente);
        long pessoaId = clienteCodigoPessoaResolver
                .resolverPessoaIdComFallbackCliente(cod8)
                .orElseThrow(() -> new BusinessRuleException("Código de cliente não encontrado: " + cod8));
        if (!pessoaRepository.existsById(pessoaId)) {
            throw new BusinessRuleException("Cliente não encontrado: " + cod8);
        }
        if (patch != null && !patch.isObject()) {
            throw new BusinessRuleException("Configuração deve ser um objeto JSON");
        }
        ObjectNode merged = defaultsConfigCliente();
        Optional<CalculoClienteConfigEntity> existente = clienteConfigRepository.findById(cod8);
        existente.ifPresent(e -> aplicarEntityConfigCliente(merged, e));
        if (patch != null) {
            shallowMerge(merged, patch);
        }
        int regraDias = RegraInicioCobrancaDiasValidator.parse(merged.get("regraInicioCobrancaDias"));
        CalculoClienteConfigEntity entity = existente.orElseGet(() -> {
            CalculoClienteConfigEntity n = new CalculoClienteConfigEntity();
            n.setCodigoCliente(cod8);
            return n;
        });
        ObjectNode payload = merged.deepCopy();
        payload.remove("regraInicioCobrancaDias");
        entity.setPayloadJson(payload);
        entity.setRegraInicioCobrancaDias(regraDias);
        clienteConfigRepository.save(entity);
        merged.put("regraInicioCobrancaDias", regraDias);
        return new CalculoClienteConfigResponse(merged);
    }

    private static String formatarCodigoCliente(String codigoCliente) {
        long id = CodigoClienteUtil.parsePessoaId(codigoCliente);
        return CodigoClienteUtil.formatar(id);
    }

    /** Alinhado a {@code DEFAULT_CONFIG_CALCULO_CLIENTE} no front. */
    private ObjectNode defaultsConfigCliente() {
        ObjectNode n = objectMapper.createObjectNode();
        n.put("honorariosTipo", "fixos");
        n.put("honorariosValor", "0 %");
        n.put("honorariosVariaveisTexto", "> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%");
        n.put("juros", "1 %");
        n.put("multa", "0 %");
        n.put("indice", "INPC");
        n.put("periodicidade", "mensal");
        n.put("modeloListaDebitos", "01");
        n.put("regraInicioCobrancaDias", RegraInicioCobrancaDiasValidator.DEFAULT);
        return n;
    }

    private void aplicarEntityConfigCliente(ObjectNode merged, CalculoClienteConfigEntity entity) {
        shallowMerge(merged, corrigirPayloadJson(entity.getPayloadJson()));
        merged.put("regraInicioCobrancaDias", entity.getRegraInicioCobrancaDias());
    }

    private void shallowMerge(ObjectNode target, JsonNode overlay) {
        if (overlay == null || !overlay.isObject()) {
            return;
        }
        Iterator<Map.Entry<String, JsonNode>> it = overlay.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            target.set(e.getKey(), e.getValue());
        }
    }

    /** Corrige mojibake UTF-8 em texto serializado (rótulos dentro do JSON). */
    private JsonNode corrigirPayloadJson(JsonNode node) {
        if (node == null) {
            return null;
        }
        try {
            String raw = objectMapper.writeValueAsString(node);
            String fixed = Utf8MojibakeUtil.corrigir(raw);
            return objectMapper.readTree(fixed);
        } catch (Exception e) {
            throw new IllegalStateException("JSON de cálculo ilegível após correção de encoding.", e);
        }
    }
}
