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
        Double confianca) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Prazo(
            Boolean existe,
            String natureza,
            String tipo,
            String gatilho,
            Integer diasUteis,
            String dataReal,
            String dataTrabalho) {

        /** Data fatal parseada (ISO ou dd/MM/yyyy na resposta da IA). */
        public LocalDate dataRealAsLocalDate() {
            return JuliaTriagemDateParseUtil.parseDataResposta(dataReal);
        }

        /** Data de trabalho parseada (geralmente recalculada no backend). */
        public LocalDate dataTrabalhoAsLocalDate() {
            return JuliaTriagemDateParseUtil.parseDataResposta(dataTrabalho);
        }
    }
}
