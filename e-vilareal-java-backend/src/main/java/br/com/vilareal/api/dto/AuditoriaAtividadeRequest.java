package br.com.vilareal.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Corpo para registrar um evento de auditoria (também usado internamente pelo serviço de cadastro).
 */
@Schema(description = "Registro de atividade / auditoria")
public class AuditoriaAtividadeRequest {

    @Size(max = 64)
    @Schema(description = "ID do usuário (opcional se enviado no cabeçalho X-VilaReal-Usuario-Id)")
    private String usuarioId;

    @Size(max = 255)
    @Schema(description = "Nome para exibição (opcional se enviado no cabeçalho B64)")
    private String usuarioNome;

    @NotBlank
    @Size(max = 128)
    private String modulo;

    @Size(max = 512)
    private String tela;

    @NotBlank
    @Size(max = 64)
    private String tipoAcao;

    @NotBlank
    private String descricao;

    @Size(max = 64)
    private String registroAfetadoId;

    @Size(max = 512)
    private String registroAfetadoNome;

    @Size(max = 2000)
    private String observacoesTecnicas;

    public String getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(String usuarioId) {
        this.usuarioId = usuarioId;
    }

    public String getUsuarioNome() {
        return usuarioNome;
    }

    public void setUsuarioNome(String usuarioNome) {
        this.usuarioNome = usuarioNome;
    }

    public String getModulo() {
        return modulo;
    }

    public void setModulo(String modulo) {
        this.modulo = modulo;
    }

    public String getTela() {
        return tela;
    }

    public void setTela(String tela) {
        this.tela = tela;
    }

    public String getTipoAcao() {
        return tipoAcao;
    }

    public void setTipoAcao(String tipoAcao) {
        this.tipoAcao = tipoAcao;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getRegistroAfetadoId() {
        return registroAfetadoId;
    }

    public void setRegistroAfetadoId(String registroAfetadoId) {
        this.registroAfetadoId = registroAfetadoId;
    }

    public String getRegistroAfetadoNome() {
        return registroAfetadoNome;
    }

    public void setRegistroAfetadoNome(String registroAfetadoNome) {
        this.registroAfetadoNome = registroAfetadoNome;
    }

    public String getObservacoesTecnicas() {
        return observacoesTecnicas;
    }

    public void setObservacoesTecnicas(String observacoesTecnicas) {
        this.observacoesTecnicas = observacoesTecnicas;
    }
}
