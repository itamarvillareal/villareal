package br.com.vilareal.pagamento.api.dto.relatorio;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class GastosPorImovelResponse {

    private RelatorioPeriodoDto periodo;
    private List<GastosPorImovelItem> imoveis = new ArrayList<>();
    private BigDecimal totalGeral;
    private List<String> categoriasPresentes = new ArrayList<>();

    public RelatorioPeriodoDto getPeriodo() {
        return periodo;
    }

    public void setPeriodo(RelatorioPeriodoDto periodo) {
        this.periodo = periodo;
    }

    public List<GastosPorImovelItem> getImoveis() {
        return imoveis;
    }

    public void setImoveis(List<GastosPorImovelItem> imoveis) {
        this.imoveis = imoveis;
    }

    public BigDecimal getTotalGeral() {
        return totalGeral;
    }

    public void setTotalGeral(BigDecimal totalGeral) {
        this.totalGeral = totalGeral;
    }

    public List<String> getCategoriasPresentes() {
        return categoriasPresentes;
    }

    public void setCategoriasPresentes(List<String> categoriasPresentes) {
        this.categoriasPresentes = categoriasPresentes;
    }

    public static class GastosPorImovelItem {
        private Long imovelId;
        private String numeroPlanilha;
        private String endereco;
        private Map<String, BigDecimal> gastosPorCategoria = new LinkedHashMap<>();
        private BigDecimal total;

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

        public Map<String, BigDecimal> getGastosPorCategoria() {
            return gastosPorCategoria;
        }

        public void setGastosPorCategoria(Map<String, BigDecimal> gastosPorCategoria) {
            this.gastosPorCategoria = gastosPorCategoria;
        }

        public BigDecimal getTotal() {
            return total;
        }

        public void setTotal(BigDecimal total) {
            this.total = total;
        }
    }
}
