package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.ContratoLocacaoStatus;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "contratos_locacao", indexes = {
        @Index(name = "idx_contratos_imovel_id", columnList = "imovel_id"),
        @Index(name = "idx_contratos_status", columnList = "status"),
        @Index(name = "idx_contratos_data_inicio", columnList = "data_inicio")
})
public class ContratoLocacao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "imovel_id", nullable = false, foreignKey = @ForeignKey(name = "fk_contratos_imovel"))
    private Imovel imovel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "locador_pessoa_id", foreignKey = @ForeignKey(name = "fk_contratos_locador_pessoa"))
    private CadastroPessoa locadorPessoa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inquilino_pessoa_id", foreignKey = @ForeignKey(name = "fk_contratos_inquilino_pessoa"))
    private CadastroPessoa inquilinoPessoa;

    @Column(name = "data_inicio", nullable = false)
    private LocalDate dataInicio;

    @Column(name = "data_fim")
    private LocalDate dataFim;

    @Column(name = "valor_aluguel", nullable = false, precision = 15, scale = 2)
    private BigDecimal valorAluguel;

    @Column(name = "valor_repasse_pactuado", precision = 15, scale = 2)
    private BigDecimal valorRepassePactuado;

    @Column(name = "dia_vencimento_aluguel")
    private Integer diaVencimentoAluguel;

    @Column(name = "dia_repasse")
    private Integer diaRepasse;

    @Column(name = "garantia_tipo", length = 40)
    private String garantiaTipo;

    @Column(name = "valor_garantia", precision = 15, scale = 2)
    private BigDecimal valorGarantia;

    @Column(name = "dados_bancarios_repasse_json", columnDefinition = "json")
    private String dadosBancariosRepasseJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContratoLocacaoStatus status = ContratoLocacaoStatus.VIGENTE;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Imovel getImovel() { return imovel; }
    public void setImovel(Imovel imovel) { this.imovel = imovel; }
    public CadastroPessoa getLocadorPessoa() { return locadorPessoa; }
    public void setLocadorPessoa(CadastroPessoa locadorPessoa) { this.locadorPessoa = locadorPessoa; }
    public CadastroPessoa getInquilinoPessoa() { return inquilinoPessoa; }
    public void setInquilinoPessoa(CadastroPessoa inquilinoPessoa) { this.inquilinoPessoa = inquilinoPessoa; }
    public LocalDate getDataInicio() { return dataInicio; }
    public void setDataInicio(LocalDate dataInicio) { this.dataInicio = dataInicio; }
    public LocalDate getDataFim() { return dataFim; }
    public void setDataFim(LocalDate dataFim) { this.dataFim = dataFim; }
    public BigDecimal getValorAluguel() { return valorAluguel; }
    public void setValorAluguel(BigDecimal valorAluguel) { this.valorAluguel = valorAluguel; }
    public BigDecimal getValorRepassePactuado() { return valorRepassePactuado; }
    public void setValorRepassePactuado(BigDecimal valorRepassePactuado) { this.valorRepassePactuado = valorRepassePactuado; }
    public Integer getDiaVencimentoAluguel() { return diaVencimentoAluguel; }
    public void setDiaVencimentoAluguel(Integer diaVencimentoAluguel) { this.diaVencimentoAluguel = diaVencimentoAluguel; }
    public Integer getDiaRepasse() { return diaRepasse; }
    public void setDiaRepasse(Integer diaRepasse) { this.diaRepasse = diaRepasse; }
    public String getGarantiaTipo() { return garantiaTipo; }
    public void setGarantiaTipo(String garantiaTipo) { this.garantiaTipo = garantiaTipo; }
    public BigDecimal getValorGarantia() { return valorGarantia; }
    public void setValorGarantia(BigDecimal valorGarantia) { this.valorGarantia = valorGarantia; }
    public String getDadosBancariosRepasseJson() { return dadosBancariosRepasseJson; }
    public void setDadosBancariosRepasseJson(String dadosBancariosRepasseJson) { this.dadosBancariosRepasseJson = dadosBancariosRepasseJson; }
    public ContratoLocacaoStatus getStatus() { return status; }
    public void setStatus(ContratoLocacaoStatus status) { this.status = status; }
    public String getObservacoes() { return observacoes; }
    public void setObservacoes(String observacoes) { this.observacoes = observacoes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
