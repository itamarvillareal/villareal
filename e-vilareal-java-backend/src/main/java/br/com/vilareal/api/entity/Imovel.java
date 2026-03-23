package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.ImovelSituacao;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "imoveis", indexes = {
        @Index(name = "idx_imoveis_cliente_id", columnList = "cliente_id"),
        @Index(name = "idx_imoveis_situacao", columnList = "situacao"),
        @Index(name = "idx_imoveis_ativo", columnList = "ativo")
}, uniqueConstraints = @UniqueConstraint(name = "uk_imoveis_processo_id", columnNames = "processo_id"))
public class Imovel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false, foreignKey = @ForeignKey(name = "fk_imoveis_cliente"))
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id", foreignKey = @ForeignKey(name = "fk_imoveis_processo"))
    private Processo processo;

    @Column(length = 200)
    private String titulo;

    @Column(name = "endereco_completo", columnDefinition = "TEXT")
    private String enderecoCompleto;

    @Column(length = 200)
    private String condominio;

    @Column(length = 120)
    private String unidade;

    @Column(name = "tipo_imovel", length = 40)
    private String tipoImovel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImovelSituacao situacao = ImovelSituacao.OCUPADO;

    @Column(length = 20)
    private String garagens;

    @Column(name = "inscricao_imobiliaria", length = 80)
    private String inscricaoImobiliaria;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "campos_extras_json", columnDefinition = "json")
    private String camposExtrasJson;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getEnderecoCompleto() { return enderecoCompleto; }
    public void setEnderecoCompleto(String enderecoCompleto) { this.enderecoCompleto = enderecoCompleto; }
    public String getCondominio() { return condominio; }
    public void setCondominio(String condominio) { this.condominio = condominio; }
    public String getUnidade() { return unidade; }
    public void setUnidade(String unidade) { this.unidade = unidade; }
    public String getTipoImovel() { return tipoImovel; }
    public void setTipoImovel(String tipoImovel) { this.tipoImovel = tipoImovel; }
    public ImovelSituacao getSituacao() { return situacao; }
    public void setSituacao(ImovelSituacao situacao) { this.situacao = situacao; }
    public String getGaragens() { return garagens; }
    public void setGaragens(String garagens) { this.garagens = garagens; }
    public String getInscricaoImobiliaria() { return inscricaoImobiliaria; }
    public void setInscricaoImobiliaria(String inscricaoImobiliaria) { this.inscricaoImobiliaria = inscricaoImobiliaria; }
    public String getObservacoes() { return observacoes; }
    public void setObservacoes(String observacoes) { this.observacoes = observacoes; }
    public String getCamposExtrasJson() { return camposExtrasJson; }
    public void setCamposExtrasJson(String camposExtrasJson) { this.camposExtrasJson = camposExtrasJson; }
    public Boolean getAtivo() { return ativo; }
    public void setAtivo(Boolean ativo) { this.ativo = ativo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
