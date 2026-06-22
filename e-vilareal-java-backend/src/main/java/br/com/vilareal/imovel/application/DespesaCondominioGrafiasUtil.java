package br.com.vilareal.imovel.application;

import br.com.vilareal.financeiro.domain.DescricaoNormalizer;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

final class DespesaCondominioGrafiasUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private DespesaCondominioGrafiasUtil() {}

    static String serializarGrafias(List<String> grafias) {
        if (grafias == null || grafias.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(grafias);
        } catch (Exception ex) {
            return null;
        }
    }

    static List<String> deserializarGrafias(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    static boolean debitoCasaGrafia(LancamentoFinanceiroEntity l, String grafia) {
        if (l == null || !StringUtils.hasText(grafia)) {
            return false;
        }
        String g = grafia.trim();
        String norm = descricaoNorm(l);
        if (g.equalsIgnoreCase(norm)) {
            return true;
        }
        String texto = textoDebito(l);
        return StringUtils.hasText(texto) && texto.contains(g);
    }

    static boolean debitoCasaAlgumaGrafia(LancamentoFinanceiroEntity l, List<String> grafias) {
        for (String g : grafias) {
            if (debitoCasaGrafia(l, g)) {
                return true;
            }
        }
        return false;
    }

    private static String descricaoNorm(LancamentoFinanceiroEntity l) {
        if (StringUtils.hasText(l.getDescricaoNorm())) {
            return l.getDescricaoNorm().trim();
        }
        return DescricaoNormalizer.normalizar(l.getDescricao());
    }

    private static String textoDebito(LancamentoFinanceiroEntity l) {
        StringBuilder sb = new StringBuilder();
        if (l.getDescricao() != null) {
            sb.append(l.getDescricao()).append(' ');
        }
        if (l.getDescricaoDetalhada() != null) {
            sb.append(l.getDescricaoDetalhada());
        }
        return DescricaoNormalizer.normalizar(sb.toString());
    }

    static List<String> mesclarGrafias(List<String> existentes, List<String> novas) {
        List<String> out = new ArrayList<>();
        if (existentes != null) {
            out.addAll(existentes);
        }
        if (novas != null) {
            for (String n : novas) {
                if (StringUtils.hasText(n) && !out.contains(n.trim())) {
                    out.add(n.trim());
                }
            }
        }
        return out;
    }
}
