package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.api.dto.CalculoClienteConfigResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasResponse;
import br.com.vilareal.calculo.api.dto.CalculoRodadasWriteRequest;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoClienteConfigEntity;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoClienteConfigRepository;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.calculo.model.RodadaCalculoChave;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@Service
public class CalculoApplicationService {

    private final CalculoRodadaRepository rodadaRepository;
    private final CalculoClienteConfigRepository clienteConfigRepository;
    private final PessoaRepository pessoaRepository;
    private final ObjectMapper objectMapper;

    public CalculoApplicationService(
            CalculoRodadaRepository rodadaRepository,
            CalculoClienteConfigRepository clienteConfigRepository,
            PessoaRepository pessoaRepository,
            ObjectMapper objectMapper) {
        this.rodadaRepository = rodadaRepository;
        this.clienteConfigRepository = clienteConfigRepository;
        this.pessoaRepository = pessoaRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public CalculoRodadasResponse listarRodadas() {
        Map<String, JsonNode> map = new HashMap<>();
        for (CalculoRodadaEntity row : rodadaRepository.findAll()) {
            map.put(
                    new RodadaCalculoChave(row.getCodigoCliente(), row.getNumeroProcesso(), row.getDimensao())
                            .toMapKey(),
                    row.getPayloadJson());
        }
        return new CalculoRodadasResponse(map);
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
        long pessoaId = CodigoClienteUtil.parsePessoaId(cod8);
        if (!pessoaRepository.existsById(pessoaId)) {
            throw new BusinessRuleException("Cliente não encontrado: " + cod8);
        }
        if (patch != null && !patch.isObject()) {
            throw new BusinessRuleException("Configuração deve ser um objeto JSON");
        }
        ObjectNode merged = defaultsConfigCliente();
        clienteConfigRepository.findById(cod8).ifPresent(e -> shallowMerge(merged, e.getPayloadJson()));
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
}
