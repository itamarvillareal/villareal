package br.com.vilareal.pagamento.api.dto.relatorio;

import br.com.vilareal.pagamento.api.dto.prestacao.PrestacaoContasImovelDto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ComparativoMensalResponse {

    private int ano;
    private PrestacaoContasImovelDto imovel;
    private List<MesComparativo> meses = new ArrayList<>();
    private BigDecimal mediaMensal;
    private List<AlertaAnomalia> alertasAnomalia = new ArrayList<>();

    public int getAno() {
        return ano;
    }

    public void setAno(int ano) {
        this.ano = ano;
    }

    public PrestacaoContasImovelDto getImovel() {
        return imovel;
    }

    public void setImovel(PrestacaoContasImovelDto imovel) {
        this.imovel = imovel;
    }

    public List<MesComparativo> getMeses() {
        return meses;
    }

    public void setMeses(List<MesComparativo> meses) {
        this.meses = meses;
    }

    public BigDecimal getMediaMensal() {
        return mediaMensal;
    }

    public void setMediaMensal(BigDecimal mediaMensal) {
        this.mediaMensal = mediaMensal;
    }

    public List<AlertaAnomalia> getAlertasAnomalia() {
        return alertasAnomalia;
    }

    public void setAlertasAnomalia(List<AlertaAnomalia> alertasAnomalia) {
        this.alertasAnomalia = alertasAnomalia;
    }

    public static class MesComparativo {
        private int mes;
        private String nomeMes;
        private Map<String, BigDecimal> categorias = new LinkedHashMap<>();
        private BigDecimal total;

        public int getMes() {
            return mes;
        }

        public void setMes(int mes) {
            this.mes = mes;
        }

        public String getNomeMes() {
            return nomeMes;
        }

        public void setNomeMes(String nomeMes) {
            this.nomeMes = nomeMes;
        }

        public Map<String, BigDecimal> getCategorias() {
            return categorias;
        }

        public void setCategorias(Map<String, BigDecimal> categorias) {
            this.categorias = categorias;
        }

        public BigDecimal getTotal() {
            return total;
        }

        public void setTotal(BigDecimal total) {
            this.total = total;
        }
    }

    public static class AlertaAnomalia {
        private int mes;
        private String categoria;
        private BigDecimal valor;
        private BigDecimal media6m;
        private double percentualAcima;

        public int getMes() {
            return mes;
        }

        public void setMes(int mes) {
            this.mes = mes;
        }

        public String getCategoria() {
            return categoria;
        }

        public void setCategoria(String categoria) {
            this.categoria = categoria;
        }

        public BigDecimal getValor() {
            return valor;
        }

        public void setValor(BigDecimal valor) {
            this.valor = valor;
        }

        public BigDecimal getMedia6m() {
            return media6m;
        }

        public void setMedia6m(BigDecimal media6m) {
            this.media6m = media6m;
        }

        public double getPercentualAcima() {
            return percentualAcima;
        }

        public void setPercentualAcima(double percentualAcima) {
            this.percentualAcima = percentualAcima;
        }
    }
}
