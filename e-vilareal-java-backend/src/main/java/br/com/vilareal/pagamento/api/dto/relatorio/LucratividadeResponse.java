package br.com.vilareal.pagamento.api.dto.relatorio;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class LucratividadeResponse {

    private RelatorioPeriodoDto periodo;
    private List<LucratividadeImovelItem> imoveis = new ArrayList<>();
    private BigDecimal totalVolumeAdministrado;
    private BigDecimal totalReceitaAdministracao;

    public RelatorioPeriodoDto getPeriodo() {
        return periodo;
    }

    public void setPeriodo(RelatorioPeriodoDto periodo) {
        this.periodo = periodo;
    }

    public List<LucratividadeImovelItem> getImoveis() {
        return imoveis;
    }

    public void setImoveis(List<LucratividadeImovelItem> imoveis) {
        this.imoveis = imoveis;
    }

    public BigDecimal getTotalVolumeAdministrado() {
        return totalVolumeAdministrado;
    }

    public void setTotalVolumeAdministrado(BigDecimal totalVolumeAdministrado) {
        this.totalVolumeAdministrado = totalVolumeAdministrado;
    }

    public BigDecimal getTotalReceitaAdministracao() {
        return totalReceitaAdministracao;
    }

    public void setTotalReceitaAdministracao(BigDecimal totalReceitaAdministracao) {
        this.totalReceitaAdministracao = totalReceitaAdministracao;
    }

    public static class LucratividadeImovelItem {
        private Long imovelId;
        private String numeroPlanilha;
        private String endereco;
        private BigDecimal volumeAdministrado;
        private BigDecimal receitaAdministracao;
        private int qtdPagamentos;

        public Long getImovelId() {
            return imovelId;
        }

        public void setImovelId(Long imovelId) {
            this.imovelId = imovelId;
        }

        public String getNumeroPlanilha() {
            return numeroPlanilha;
        }

        public void setNumeroPlanilha(String numeroPlanilha) {
            this.numeroPlanilha = numeroPlanilha;
        }

        public String getEndereco() {
            return endereco;
        }

        public void setEndereco(String endereco) {
            this.endereco = endereco;
        }

        public BigDecimal getVolumeAdministrado() {
            return volumeAdministrado;
        }

        public void setVolumeAdministrado(BigDecimal volumeAdministrado) {
            this.volumeAdministrado = volumeAdministrado;
        }

        public BigDecimal getReceitaAdministracao() {
            return receitaAdministracao;
        }

        public void setReceitaAdministracao(BigDecimal receitaAdministracao) {
            this.receitaAdministracao = receitaAdministracao;
        }

        public int getQtdPagamentos() {
            return qtdPagamentos;
        }

        public void setQtdPagamentos(int qtdPagamentos) {
            this.qtdPagamentos = qtdPagamentos;
        }
    }
}
