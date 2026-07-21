package br.com.vilareal.processo.api.dto;

import br.com.vilareal.localidade.api.dto.MunicipioResumoResponse;
import br.com.vilareal.orgaojulgador.api.dto.OrgaoJulgadorResumoResponse;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

public class ProcessoResponse {

    private Long id;
    @Schema(description = "PK da tabela cliente (processo.cliente_id)")
    private Long clienteId;
    private String codigoCliente;
    @Schema(description = "PK da pessoa titular/sujeito do processo (processo.pessoa_id)")
    private Long pessoaTitularId;
    private Integer numeroInterno;
    private String numeroCnj;
    private String numeroProcessoAntigo;
    private String naturezaAcao;
    private String descricaoAcao;
    private String competencia;
    private String fase;
    private String observacaoFase;
    private String tramitacao;
    private String pjeTribunal;
    private String pjeGrau;
    private LocalDate dataProtocolo;
    private LocalDate prazoFatal;
    private LocalDate proximaConsulta;
    private String observacao;
    private BigDecimal valorCausa;
    private String uf;
    private String cidade;
    private Integer municipioId;
    private MunicipioResumoResponse municipio;
    private Long orgaoJulgadorId;
    private OrgaoJulgadorResumoResponse orgaoJulgador;
    private String cidadeLegado;
    private String unidade;
    private String pasta;
    private String papelCliente;
    private LocalDate audienciaData;
    private String audienciaHora;
    private String audienciaTipo;
    private String audienciaLinkReuniao;
    private String avisoAudiencia;
    private Boolean consultaAutomatica;
    private Boolean ativo;
    private String consultor;
    private Long usuarioResponsavelId;
    private String parteOposta;
    /** Nomes das partes do lado cliente (polo autor/requerente), agregados para listagens. */
    private String parteCliente;
    /** Nome do titular/sujeito do processo (processo.pessoa_id). */
    private String titularNome;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public Long getPessoaTitularId() {
        return pessoaTitularId;
    }

    public void setPessoaTitularId(Long pessoaTitularId) {
        this.pessoaTitularId = pessoaTitularId;
    }

    public String getCodigoCliente() {
        return codigoCliente;
    }

    public void setCodigoCliente(String codigoCliente) {
        this.codigoCliente = codigoCliente;
    }

    public Integer getNumeroInterno() {
        return numeroInterno;
    }

    public void setNumeroInterno(Integer numeroInterno) {
        this.numeroInterno = numeroInterno;
    }

    public String getNumeroCnj() {
        return numeroCnj;
    }

    public void setNumeroCnj(String numeroCnj) {
        this.numeroCnj = numeroCnj;
    }

    public String getNumeroProcessoAntigo() {
        return numeroProcessoAntigo;
    }

    public void setNumeroProcessoAntigo(String numeroProcessoAntigo) {
        this.numeroProcessoAntigo = numeroProcessoAntigo;
    }

    public String getNaturezaAcao() {
        return naturezaAcao;
    }

    public void setNaturezaAcao(String naturezaAcao) {
        this.naturezaAcao = naturezaAcao;
    }

    public String getDescricaoAcao() {
        return descricaoAcao;
    }

    public void setDescricaoAcao(String descricaoAcao) {
        this.descricaoAcao = descricaoAcao;
    }

    public String getCompetencia() {
        return competencia;
    }

    public void setCompetencia(String competencia) {
        this.competencia = competencia;
    }

    public String getFase() {
        return fase;
    }

    public void setFase(String fase) {
        this.fase = fase;
    }

    public String getObservacaoFase() {
        return observacaoFase;
    }

    public void setObservacaoFase(String observacaoFase) {
        this.observacaoFase = observacaoFase;
    }

    public String getTramitacao() {
        return tramitacao;
    }

    public void setTramitacao(String tramitacao) {
        this.tramitacao = tramitacao;
    }

    public String getPjeTribunal() {
        return pjeTribunal;
    }

    public void setPjeTribunal(String pjeTribunal) {
        this.pjeTribunal = pjeTribunal;
    }

    public String getPjeGrau() {
        return pjeGrau;
    }

    public void setPjeGrau(String pjeGrau) {
        this.pjeGrau = pjeGrau;
    }

    public LocalDate getDataProtocolo() {
        return dataProtocolo;
    }

    public void setDataProtocolo(LocalDate dataProtocolo) {
        this.dataProtocolo = dataProtocolo;
    }

    public LocalDate getPrazoFatal() {
        return prazoFatal;
    }

    public void setPrazoFatal(LocalDate prazoFatal) {
        this.prazoFatal = prazoFatal;
    }

    public LocalDate getProximaConsulta() {
        return proximaConsulta;
    }

    public void setProximaConsulta(LocalDate proximaConsulta) {
        this.proximaConsulta = proximaConsulta;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }

    public BigDecimal getValorCausa() {
        return valorCausa;
    }

    public void setValorCausa(BigDecimal valorCausa) {
        this.valorCausa = valorCausa;
    }

    public String getUf() {
        return uf;
    }

    public void setUf(String uf) {
        this.uf = uf;
    }

    public String getCidade() {
        return cidade;
    }

    public void setCidade(String cidade) {
        this.cidade = cidade;
    }

    public Integer getMunicipioId() {
        return municipioId;
    }

    public void setMunicipioId(Integer municipioId) {
        this.municipioId = municipioId;
    }

    public MunicipioResumoResponse getMunicipio() {
        return municipio;
    }

    public void setMunicipio(MunicipioResumoResponse municipio) {
        this.municipio = municipio;
    }

    public Long getOrgaoJulgadorId() {
        return orgaoJulgadorId;
    }

    public void setOrgaoJulgadorId(Long orgaoJulgadorId) {
        this.orgaoJulgadorId = orgaoJulgadorId;
    }

    public OrgaoJulgadorResumoResponse getOrgaoJulgador() {
        return orgaoJulgador;
    }

    public void setOrgaoJulgador(OrgaoJulgadorResumoResponse orgaoJulgador) {
        this.orgaoJulgador = orgaoJulgador;
    }

    public String getCidadeLegado() {
        return cidadeLegado;
    }

    public void setCidadeLegado(String cidadeLegado) {
        this.cidadeLegado = cidadeLegado;
    }

    public String getUnidade() {
        return unidade;
    }

    public void setUnidade(String unidade) {
        this.unidade = unidade;
    }

    public String getPasta() {
        return pasta;
    }

    public void setPasta(String pasta) {
        this.pasta = pasta;
    }

    public String getPapelCliente() {
        return papelCliente;
    }

    public void setPapelCliente(String papelCliente) {
        this.papelCliente = papelCliente;
    }

    public LocalDate getAudienciaData() {
        return audienciaData;
    }

    public void setAudienciaData(LocalDate audienciaData) {
        this.audienciaData = audienciaData;
    }

    public String getAudienciaHora() {
        return audienciaHora;
    }

    public void setAudienciaHora(String audienciaHora) {
        this.audienciaHora = audienciaHora;
    }

    public String getAudienciaTipo() {
        return audienciaTipo;
    }

    public void setAudienciaTipo(String audienciaTipo) {
        this.audienciaTipo = audienciaTipo;
    }

    public String getAudienciaLinkReuniao() {
        return audienciaLinkReuniao;
    }

    public void setAudienciaLinkReuniao(String audienciaLinkReuniao) {
        this.audienciaLinkReuniao = audienciaLinkReuniao;
    }

    public String getAvisoAudiencia() {
        return avisoAudiencia;
    }

    public void setAvisoAudiencia(String avisoAudiencia) {
        this.avisoAudiencia = avisoAudiencia;
    }

    public Boolean getConsultaAutomatica() {
        return consultaAutomatica;
    }

    public void setConsultaAutomatica(Boolean consultaAutomatica) {
        this.consultaAutomatica = consultaAutomatica;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public String getConsultor() {
        return consultor;
    }

    public void setConsultor(String consultor) {
        this.consultor = consultor;
    }

    public Long getUsuarioResponsavelId() {
        return usuarioResponsavelId;
    }

    public void setUsuarioResponsavelId(Long usuarioResponsavelId) {
        this.usuarioResponsavelId = usuarioResponsavelId;
    }

    public String getParteOposta() {
        return parteOposta;
    }

    public void setParteOposta(String parteOposta) {
        this.parteOposta = parteOposta;
    }

    public String getParteCliente() {
        return parteCliente;
    }

    public void setParteCliente(String parteCliente) {
        this.parteCliente = parteCliente;
    }

    public String getTitularNome() {
        return titularNome;
    }

    public void setTitularNome(String titularNome) {
        this.titularNome = titularNome;
    }
}
