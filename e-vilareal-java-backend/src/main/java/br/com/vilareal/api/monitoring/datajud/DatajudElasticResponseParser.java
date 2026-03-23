package br.com.vilareal.api.monitoring.datajud;

import java.util.*;

/**
 * Extrai campos comuns do JSON de resposta Elasticsearch do DataJud (estrutura pode variar por tribunal).
 */
public final class DatajudElasticResponseParser {

    private DatajudElasticResponseParser() {
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> extractHits(Map<String, Object> responseJson) {
        if (responseJson == null) {
            return List.of();
        }
        Object hitsRoot = responseJson.get("hits");
        if (!(hitsRoot instanceof Map<?, ?> hm)) {
            return List.of();
        }
        Object inner = ((Map<String, Object>) hm).get("hits");
        if (!(inner instanceof List<?> list)) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                out.add((Map<String, Object>) m);
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> sourceOfHit(Map<String, Object> hit) {
        if (hit == null) {
            return Map.of();
        }
        Object s = hit.get("_source");
        if (s instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        return Map.of();
    }

    public static String numeroProcesso(Map<String, Object> source) {
        Object n = source.get("numeroProcesso");
        return n != null ? String.valueOf(n) : "";
    }

    public static String tribunal(Map<String, Object> source) {
        Object t = source.get("tribunal");
        if (t != null) return String.valueOf(t);
        Object s = source.get("siglaTribunal");
        return s != null ? String.valueOf(s) : "";
    }

    public static String classeNome(Map<String, Object> source) {
        Object c = source.get("classe");
        if (c instanceof Map<?, ?> m && m.get("nome") != null) {
            return String.valueOf(m.get("nome"));
        }
        Object cp = source.get("classeProcessual");
        return cp != null ? String.valueOf(cp) : null;
    }

    public static String orgaoJulgadorNome(Map<String, Object> source) {
        Object o = source.get("orgaoJulgador");
        if (o instanceof Map<?, ?> m && m.get("nome") != null) {
            return String.valueOf(m.get("nome"));
        }
        if (o != null) return String.valueOf(o);
        return null;
    }

    @SuppressWarnings("unchecked")
    public static LastMovement lastMovement(Map<String, Object> source) {
        Object movs = source.get("movimentos");
        if (!(movs instanceof List<?> list) || list.isEmpty()) {
            return new LastMovement(null, null);
        }
        Object last = list.get(list.size() - 1);
        if (!(last instanceof Map<?, ?> m)) {
            return new LastMovement(null, null);
        }
        Map<String, Object> mm = (Map<String, Object>) m;
        String nome = Optional.ofNullable(mm.get("nome")).map(String::valueOf).orElse(null);
        if (nome == null) {
            nome = Optional.ofNullable(mm.get("complemento")).map(String::valueOf).orElse(null);
        }
        String data = Optional.ofNullable(mm.get("dataHora")).map(String::valueOf)
                .or(() -> Optional.ofNullable(mm.get("data")).map(String::valueOf))
                .orElse(null);
        return new LastMovement(nome, data);
    }

    public static String nivelSigilo(Map<String, Object> source) {
        Object n = source.get("nivelSigilo");
        if (n != null) return String.valueOf(n);
        Object s = source.get("sigilo");
        return s != null ? String.valueOf(s) : null;
    }

    public record LastMovement(String texto, String dataHora) {
    }
}
