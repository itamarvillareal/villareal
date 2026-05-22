package br.com.vilareal.pagamento.api.dto.recorrencia;

import java.math.BigDecimal;
import java.time.LocalDate;

public class PagamentoRecorrenciaGeradoItemResponse {

    private Long id;
    private String descricao;
    private String mesReferencia;
    private LocalDate dataVencimento;
    private BigDecimal valor;
    private BigDecimal valorPagoBanco;
    private String status;
    private boolean autoGerado;

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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isAutoGerado() {
        return autoGerado;
    }

    public void setAutoGerado(boolean autoGerado) {
        this.autoGerado = autoGerado;
    }
}
