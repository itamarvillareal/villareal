package br.com.vilareal.orgaojulgador.domain;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class DatajudOrgaoAggregationParserTest {

    @Test
    void parse_extraiCodigoNomeGrauIbge() throws Exception {
        String json =
                """
                {
                  "aggregations": {
                    "orgaos": {
                      "sum_other_doc_count": 0,
                      "buckets": [
                        {
                          "key": 11447,
                          "amostra": {
                            "hits": {
                              "hits": [
                                {
                                  "_source": {
                                    "grau": "G1",
                                    "orgaoJulgador": {
                                      "codigo": 11447,
                                      "nome": "9º Juizado Especial Cível",
                                      "codigoMunicipioIBGE": 5208707
                                    }
                                  }
                                }
                              ]
                            }
                          }
                        }
                      ]
                    }
                  }
                }
                """;
        DatajudOrgaoAggregationParser.Resultado r = DatajudOrgaoAggregationParser.parse(json.getBytes(StandardCharsets.UTF_8));
        assertThat(r.sumOtherDocCount()).isZero();
        assertThat(r.orgaos()).hasSize(1);
        assertThat(r.orgaos().get(0).codigoCnj()).isEqualTo(11447);
        assertThat(r.orgaos().get(0).nome()).isEqualTo("9º Juizado Especial Cível");
        assertThat(r.orgaos().get(0).grau()).isEqualTo("G1");
        assertThat(r.orgaos().get(0).codigoMunicipioIbge()).isEqualTo(5208707);
    }

    @Test
    void corpoAgregacaoOrgaos_contemTermsETopHits() {
        String corpo = new String(DatajudOrgaoAggregationParser.corpoAgregacaoOrgaos(), StandardCharsets.UTF_8);
        assertThat(corpo).contains("orgaoJulgador.codigo");
        assertThat(corpo).contains("top_hits");
        assertThat(corpo).contains("\"size\": 10000");
    }
}
