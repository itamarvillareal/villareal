package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Leitura/gravação de fiadores vinculados ao contrato de locação. */
public final class ContratoLocacaoFiadorSupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ContratoLocacaoFiadorSupport() {}

    public record FiadorRef(Long pessoaId) {}

    public static List<Long> extrairPessoaIds(String fiadoresJson) {
        if (!StringUtils.hasText(fiadoresJson)) {
            return List.of();
        }
        try {
            JsonNode root = MAPPER.readTree(fiadoresJson);
            if (root == null || root.isNull()) {
                return List.of();
            }
            if (root.isArray()) {
                Set<Long> ids = new LinkedHashSet<>();
                for (JsonNode node : root) {
                    Long id = extrairPessoaIdNode(node);
                    if (id != null) {
                        ids.add(id);
                    }
                }
                return List.copyOf(ids);
            }
        } catch (Exception ignored) {
            return List.of();
        }
        return List.of();
    }

    public static String serializarPessoaIds(List<Long> pessoaIds) {
        if (pessoaIds == null || pessoaIds.isEmpty()) {
            return null;
        }
        List<FiadorRef> refs = new ArrayList<>();
        Set<Long> vistos = new LinkedHashSet<>();
        for (Long id : pessoaIds) {
            if (id == null || id < 1 || !vistos.add(id)) {
                continue;
            }
            refs.add(new FiadorRef(id));
        }
        if (refs.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(refs);
        } catch (Exception e) {
            return null;
        }
    }

    public static List<PessoaEntity> carregarFiadores(ContratoLocacaoEntity contrato, PessoaRepository pessoaRepository) {
        if (contrato == null || pessoaRepository == null) {
            return List.of();
        }
        List<PessoaEntity> out = new ArrayList<>();
        for (Long id : extrairPessoaIds(contrato.getFiadoresJson())) {
            pessoaRepository
                    .findById(id)
                    .ifPresent(out::add);
        }
        return List.copyOf(out);
    }

    public static List<PessoaEntity> resolverFiadoresParaGravacao(
            List<Long> pessoaIds, PessoaRepository pessoaRepository) {
        if (pessoaIds == null || pessoaIds.isEmpty()) {
            return List.of();
        }
        List<PessoaEntity> out = new ArrayList<>();
        Set<Long> vistos = new LinkedHashSet<>();
        for (Long id : pessoaIds) {
            if (id == null || id < 1 || !vistos.add(id)) {
                continue;
            }
            PessoaEntity p = pessoaRepository
                    .findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Fiador não encontrado: " + id));
            out.add(p);
        }
        return List.copyOf(out);
    }

    private static Long extrairPessoaIdNode(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.longValue();
        }
        if (node.isObject()) {
            if (node.hasNonNull("pessoaId")) {
                return node.get("pessoaId").asLong();
            }
            if (node.hasNonNull("id")) {
                return node.get("id").asLong();
            }
        }
        return null;
    }

    static List<Long> parseRequestIds(Object raw) {
        if (raw == null) {
            return List.of();
        }
        if (raw instanceof List<?> list) {
            List<Long> out = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Number n) {
                    out.add(n.longValue());
                } else if (o != null && StringUtils.hasText(String.valueOf(o))) {
                    try {
                        out.add(Long.parseLong(String.valueOf(o).trim()));
                    } catch (NumberFormatException ignored) {
                        // ignora
                    }
                }
            }
            return out;
        }
        return List.of();
    }
}
