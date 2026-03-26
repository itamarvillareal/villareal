package br.com.vilareal.auditoria.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuditoriaAtividadeResponse {

    private final Long id;

    /** ISO-8601 (ex.: 2026-03-25T14:30:00.123Z) — exibido no modal de detalhe. */
    private final String ocorridoEm;

    private final String dataBr;
    private final String horaBr;

    @JsonProperty("usuarioId")
    private final String usuarioId;

    private final String usuarioNome;
    private final String modulo;
    private final String tela;
    private final String tipoAcao;
    private final String descricao;

    @JsonProperty("registroAfetadoId")
    private final String registroAfetadoId;

    @JsonProperty("registroAfetadoNome")
    private final String registroAfetadoNome;

    private final String ipOrigem;

    @JsonProperty("observacoesTecnicas")
    private final String observacoesTecnicas;
}
