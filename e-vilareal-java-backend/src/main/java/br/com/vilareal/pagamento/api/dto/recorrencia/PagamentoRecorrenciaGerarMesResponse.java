package br.com.vilareal.pagamento.api.dto.recorrencia;

import java.util.ArrayList;
import java.util.List;

public class PagamentoRecorrenciaGerarMesResponse {

    private String mesAno;
    private int totalConfigs;
    private int gerados;
    private int jaExistiam;
    private int erros;
    private List<Detalhe> detalhes = new ArrayList<>();

    public static class Detalhe {
        private Long configId;
        private String descricao;
        private String imovelNumeroPlanilha;
        private String resultado;
        private Long pagamentoId;
        private String mensagemErro;

        public Long getConfigId() {
            return configId;
        }

        public void setConfigId(Long configId) {
            this.configId = configId;
        }

        public String getDescricao() {
            return descricao;
        }

        public void setDescricao(String descricao) {
            this.descricao = descricao;
        }

        public String getImovelNumeroPlanilha() {
            return imovelNumeroPlanilha;
        }

        public void setImovelNumeroPlanilha(String imovelNumeroPlanilha) {
            this.imovelNumeroPlanilha = imovelNumeroPlanilha;
        }

        public String getResultado() {
            return resultado;
        }

        public void setResultado(String resultado) {
            this.resultado = resultado;
        }

        public Long getPagamentoId() {
            return pagamentoId;
        }

        public void setPagamentoId(Long pagamentoId) {
            this.pagamentoId = pagamentoId;
        }

        public String getMensagemErro() {
            return mensagemErro;
        }

        public void setMensagemErro(String mensagemErro) {
            this.mensagemErro = mensagemErro;
        }
    }

    public String getMesAno() {
        return mesAno;
    }

    public void setMesAno(String mesAno) {
        this.mesAno = mesAno;
    }

    public int getTotalConfigs() {
        return totalConfigs;
    }

    public void setTotalConfigs(int totalConfigs) {
        this.totalConfigs = totalConfigs;
    }

    public int getGerados() {
        return gerados;
    }

    public void setGerados(int gerados) {
        this.gerados = gerados;
    }

    public int getJaExistiam() {
        return jaExistiam;
    }

    public void setJaExistiam(int jaExistiam) {
        this.jaExistiam = jaExistiam;
    }

    public int getErros() {
        return erros;
    }

    public void setErros(int erros) {
        this.erros = erros;
    }

    public List<Detalhe> getDetalhes() {
        return detalhes;
    }

    public void setDetalhes(List<Detalhe> detalhes) {
        this.detalhes = detalhes;
    }
}
