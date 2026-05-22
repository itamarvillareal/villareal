package br.com.vilareal.pagamento.api.dto.prestacao;

import java.math.BigDecimal;
import java.time.LocalDate;

public class PrestacaoContasPagamentoItemDto {

    private Long id;
    private String descricao;
    private String categoria;
    private String mesReferencia;
    private LocalDate dataVencimento;
    private LocalDate dataPagamentoEfetivo;
    private BigDecimal valor;
    private BigDecimal valorPagoBanco;
    private BigDecimal valorDiferenca;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getMesReferencia() {
        return mesReferencia;
    }

    public void setMesReferencia(String mesReferencia) {
        this.mesReferencia = mesReferencia;
    }

    public LocalDate getDataVencimento() {
        return dataVencimento;
    }

    public void setDataVencimento(LocalDate dataVencimento) {
        this.dataVencimento = dataVencimento;
    }

    public LocalDate getDataPagamentoEfetivo() {
        return dataPagamentoEfetivo;
    }

    public void setDataPagamentoEfetivo(LocalDate dataPagamentoEfetivo) {
        this.dataPagamentoEfetivo = dataPagamentoEfetivo;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }

    public BigDecimal getValorPagoBanco() {
        return valorPagoBanco;
    }

    public void setValorPagoBanco(BigDecimal valorPagoBanco) {
        this.valorPagoBanco = valorPagoBanco;
    }

    public BigDecimal getValorDiferenca() {
        return valorDiferenca;
    }

    public void setValorDiferenca(BigDecimal valorDiferenca) {
        this.valorDiferenca = valorDiferenca;
    }
}
