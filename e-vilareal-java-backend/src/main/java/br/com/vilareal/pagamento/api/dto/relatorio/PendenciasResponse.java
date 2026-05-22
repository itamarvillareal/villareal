package br.com.vilareal.pagamento.api.dto.relatorio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class PendenciasResponse {

    private Instant geradoEm;
    private List<PendenciasImovelItem> imoveis;
    private Map<String, PendenciasResumoItem> resumoGeral = new LinkedHashMap<>();

    public Instant getGeradoEm() {
        return geradoEm;
    }

    public void setGeradoEm(Instant geradoEm) {
        this.geradoEm = geradoEm;
    }

    public List<PendenciasImovelItem> getImoveis() {
        return imoveis;
    }

    public void setImoveis(List<PendenciasImovelItem> imoveis) {
        this.imoveis = imoveis;
    }

    public Map<String, PendenciasResumoItem> getResumoGeral() {
        return resumoGeral;
    }

    public void setResumoGeral(Map<String, PendenciasResumoItem> resumoGeral) {
        this.resumoGeral = resumoGeral;
    }

    public static class PendenciasResumoItem {
        private long qtd;
        private BigDecimal valor;

        public PendenciasResumoItem() {}

        public PendenciasResumoItem(long qtd, BigDecimal valor) {
            this.qtd = qtd;
            this.valor = valor;
        }

        public long getQtd() {
            return qtd;
        }

        public void setQtd(long qtd) {
            this.qtd = qtd;
        }

        public BigDecimal getValor() {
            return valor;
        }

        public void setValor(BigDecimal valor) {
            this.valor = valor;
        }
    }

    public static class PendenciasImovelItem {
        private Long imovelId;
        private String numeroPlanilha;
        private String endereco;
        private Map<String, PendenciasResumoItem> pendencias = new LinkedHashMap<>();
        private BigDecimal totalAberto;

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

        public Map<String, PendenciasResumoItem> getPendencias() {
            return pendencias;
        }

        public void setPendencias(Map<String, PendenciasResumoItem> pendencias) {
            this.pendencias = pendencias;
        }

        public BigDecimal getTotalAberto() {
            return totalAberto;
        }

        public void setTotalAberto(BigDecimal totalAberto) {
            this.totalAberto = totalAberto;
        }
    }
}
