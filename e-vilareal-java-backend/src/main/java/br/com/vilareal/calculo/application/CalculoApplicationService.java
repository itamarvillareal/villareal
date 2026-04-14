package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.api.dto.CalculoClienteConfigResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadaResumoItem;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResumoResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasWriteRequest;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoClienteConfigEntity;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
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
        RodadaCalculoChave chave = RodadaCalculoChave.fromPath(codigoCliente, numeroProcesso, dimensao);
        return rodadaRepository
                .findByCodigoClienteAndNumeroProcessoAndDimensao(
                        chave.codigoCliente(), chave.numeroProcesso(), chave.dimensao())
                .map(e -> {
                    JsonNode p = corrigirPayloadJsonRodadaTolerante(e);
                    return p != null ? p : objectMapper.createObjectNode();
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
        if (inserindo && StringUtils.hasText(importacaoIdParaNovaRodada)) {
            entity.setImportacaoId(importacaoIdParaNovaRodada.trim());
        }
        CalculoRodadaEntity saved = rodadaRepository.save(entity);
        return corrigirPayloadJson(saved.getPayloadJson());
    }

    @Transactional(readOnly = true)
    public CalculoRodadasResumoResponse listarResumoRodadas() {
        List<CalculoRodadaResumoItem> items = new ArrayList<>();
        for (CalculoRodadaEntity row : rodadaRepository.findAll()) {
            if (!chaveRodadaCompleta(row)) {
                log.warn(
                        "calculo_rodada id={} omitida em GET /rodadas/resumo: codigo_cliente, numero_processo ou dimensao nulos",
                        row.getId());
                continue;
            }
            JsonNode payload = corrigirPayloadJsonRodadaTolerante(row);
            RodadaCalculoChave ch = new RodadaCalculoChave(
                    row.getCodigoCliente(), row.getNumeroProcesso(), row.getDimensao());
            items.add(new CalculoRodadaResumoItem(ch.toMapKey(), lerParcelamentoAceito(payload)));
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
            rodadaRepository.save(entity);
        }
        java.util.HashSet<String> keys = new java.util.HashSet<>(incoming.keySet());
        for (CalculoRodadaEntity row : rodadaRepository.findAll()) {
            String k = new RodadaCalculoChave(row.getCodigoCliente(), row.getNumeroProcesso(), row.getDimensao())
                    .toMapKey();
            if (!keys.contains(k)) {
                rodadaRepository.delete(row);
            }
        }
    }

    @Transactional(readOnly = true)
    public CalculoClienteConfigResponse obterConfigCliente(String codigoCliente) {
        String cod8 = formatarCodigoCliente(codigoCliente);
        ObjectNode merged = defaultsConfigCliente();
        clienteConfigRepository.findById(cod8).ifPresent(e -> shallowMerge(merged, e.getPayloadJson()));
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
        clienteConfigRepository
                .findById(cod8)
                .ifPresent(e -> shallowMerge(merged, corrigirPayloadJson(e.getPayloadJson())));
        if (patch != null) {
            shallowMerge(merged, patch);
        }
        CalculoClienteConfigEntity entity = clienteConfigRepository
                .findById(cod8)
                .orElseGet(() -> {
                    CalculoClienteConfigEntity n = new CalculoClienteConfigEntity();
                    n.setCodigoCliente(cod8);
                    return n;
                });
        entity.setPayloadJson(merged);
        clienteConfigRepository.save(entity);
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
        n.put("honorariosValor", "0");
        n.put("honorariosVariaveisTexto", "> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%");
        n.put("juros", "1 %");
        n.put("multa", "0 %");
        n.put("indice", "INPC");
        n.put("periodicidade", "mensal");
        n.put("modeloListaDebitos", "01");
        return n;
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
