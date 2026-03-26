package br.com.vilareal.auditoria.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuditoriaAtividadeWriteRequest {

    @Size(max = 120)
    private String usuarioId;

    @Size(max = 255)
    private String usuarioNome;

    @NotBlank
    @Size(max = 255)
    private String modulo;

    @NotBlank
    @Size(max = 500)
    private String tela;

    @NotBlank
    @Size(max = 80)
    private String tipoAcao;

    @NotBlank
    @Size(max = 65000)
    private String descricao;

    @Size(max = 120)
    @JsonProperty("registroAfetadoId")
    private String registroAfetadoId;

    @Size(max = 500)
    @JsonProperty("registroAfetadoNome")
    private String registroAfetadoNome;

    @Size(max = 4000)
    @JsonProperty("observacoesTecnicas")
    private String observacoesTecnicas;
}
