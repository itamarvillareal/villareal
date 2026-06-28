package br.com.vilareal.orgaojulgador.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
public final class DatajudOrgaoAggregationParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private DatajudOrgaoAggregationParser() {}

    public record OrgaoAgregado(int codigoCnj, String nome, String grau, Integer codigoMunicipioIbge) {}

    public record Resultado(int sumOtherDocCount, List<OrgaoAgregado> orgaos) {}

    public static Resultado parse(byte[] json) throws IOException {
        if (json == null || json.length == 0) {
            return new Resultado(-1, List.of());
        }
        JsonNode root = MAPPER.readTree(json);
        JsonNode orgaosAgg = root.path("aggregations").path("orgaos");
        int sumOther = orgaosAgg.path("sum_other_doc_count").asInt(-1);
        JsonNode buckets = orgaosAgg.path("buckets");
        if (!buckets.isArray()) {
            return new Resultado(sumOther, List.of());
        }
        List<OrgaoAgregado> lista = new ArrayList<>();
        for (JsonNode bucket : buckets) {
            OrgaoAgregado item = parseBucket(bucket);
            if (item != null) {
                lista.add(item);
            }
        }
        return new Resultado(sumOther, lista);
    }

    private static OrgaoAgregado parseBucket(JsonNode bucket) {
        if (bucket == null || bucket.isMissingNode()) {
            return null;
        }
        int codigo = bucket.path("key").asInt(-1);
        if (codigo < 0) {
            return null;
        }
        JsonNode hits = bucket.path("amostra").path("hits").path("hits");
        if (!hits.isArray() || hits.isEmpty()) {
            return new OrgaoAgregado(codigo, "Órgão " + codigo, null, null);
        }
        JsonNode source = hits.get(0).path("_source");
        String grau = textOrNull(source.path("grau"));
        JsonNode orgao = source.path("orgaoJulgador");
        if (orgao.isMissingNode() || orgao.isNull()) {
            return new OrgaoAgregado(codigo, "Órgão " + codigo, grau, null);
        }
        int codigoOrgao = orgao.path("codigo").asInt(codigo);
        String nome = textOrNull(orgao.path("nome"));
        if (nome == null) {
            nome = textOrNull(orgao.path("nomeOrgao"));
        }
        if (nome == null) {
            nome = "Órgão " + codigoOrgao;
        }
        Integer ibge = orgao.hasNonNull("codigoMunicipioIBGE")
                ? orgao.path("codigoMunicipioIBGE").asInt()
                : null;
        return new OrgaoAgregado(codigoOrgao, nome, grau, ibge);
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String t = node.asText(null);
        if (t == null || t.isBlank()) {
            return null;
        }
        return t.trim();
    }

    public static byte[] corpoAgregacaoOrgaos() {
        String json =
                """
                {
                  "size": 0,
                  "query": { "match_all": {} },
                  "aggs": {
                    "orgaos": {
                      "terms": {
                        "field": "orgaoJulgador.codigo",
                        "size": 10000
                      },
                      "aggs": {
                        "amostra": {
                          "top_hits": {
                            "size": 1,
                            "_source": ["orgaoJulgador", "grau"]
                          }
                        }
                      }
                    }
                  }
                }
                """;
        return json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
