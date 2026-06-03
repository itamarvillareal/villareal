package br.com.vilareal.julia.triagem;

import br.com.vilareal.julia.domain.JuliaTriagemDateParseUtil;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TriagemResultado(
        String classificacao,
        String resumo,
        String impactoCliente,
        String baseImpacto,
        Prazo prazo,
        String providenciaCliente,
        String prioridade,
        String acaoSugerida,
        Double confianca,
        Audiencia audiencia) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Prazo(
            Boolean existe,
            String natureza,
            String tipo,
            String gatilho,
            Integer diasUteis,
            String dataReal,
            String dataTrabalho) {

        public LocalDate dataRealAsLocalDate() {
            return JuliaTriagemDateParseUtil.parseDataResposta(dataReal);
        }

        public LocalDate dataTrabalhoAsLocalDate() {
            return JuliaTriagemDateParseUtil.parseDataResposta(dataTrabalho);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Audiencia(
            Boolean existe,
            String data,
            String hora,
            String tipo,
            String meio,
            Double confianca) {

        public LocalDate dataAsLocalDate() {
            return JuliaTriagemDateParseUtil.parseDataResposta(data);
        }
    }
}
