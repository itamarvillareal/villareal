package br.com.vilareal.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Linha do relatório de auditoria")
public class AuditoriaAtividadeResponse {

    private Long id;
    private String usuarioId;
    private String usuarioNome;
    private Instant ocorridoEm;
    /** dd/MM/yyyy (America/Sao_Paulo) */
    private String dataBr;
    /** HH:mm:ss (America/Sao_Paulo) */
    private String horaBr;
    private String modulo;
    private String tela;
    private String tipoAcao;
    private String descricao;
    private String registroAfetadoId;
    private String registroAfetadoNome;
    private String ipOrigem;
    private String observacoesTecnicas;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public Instant getOcorridoEm() {
        return ocorridoEm;
    }

    public void setOcorridoEm(Instant ocorridoEm) {
        this.ocorridoEm = ocorridoEm;
    }

    public String getDataBr() {
        return dataBr;
    }

    public void setDataBr(String dataBr) {
        this.dataBr = dataBr;
    }

    public String getHoraBr() {
        return horaBr;
    }

    public void setHoraBr(String horaBr) {
        this.horaBr = horaBr;
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

    public String getIpOrigem() {
        return ipOrigem;
    }

    public void setIpOrigem(String ipOrigem) {
        this.ipOrigem = ipOrigem;
    }

    public String getObservacoesTecnicas() {
        return observacoesTecnicas;
    }

    public void setObservacoesTecnicas(String observacoesTecnicas) {
        this.observacoesTecnicas = observacoesTecnicas;
    }
}
