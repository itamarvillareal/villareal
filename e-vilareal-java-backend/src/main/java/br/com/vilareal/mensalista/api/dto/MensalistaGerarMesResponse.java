package br.com.vilareal.mensalista.api.dto;

import java.util.ArrayList;
import java.util.List;

public class MensalistaGerarMesResponse {

    private String mesReferencia;
    private int totalMensalistas;
    private int gerados;
    private int jaExistiam;
    private int ignorados;
    private int erros;
    private List<Detalhe> detalhes = new ArrayList<>();

    public String getMesReferencia() {
        return mesReferencia;
    }

    public void setMesReferencia(String mesReferencia) {
        this.mesReferencia = mesReferencia;
    }

    public int getTotalMensalistas() {
        return totalMensalistas;
    }

    public void setTotalMensalistas(int totalMensalistas) {
        this.totalMensalistas = totalMensalistas;
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

    public int getIgnorados() {
        return ignorados;
    }

    public void setIgnorados(int ignorados) {
        this.ignorados = ignorados;
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

    public static class Detalhe {
        private Long mensalistaId;
        private Long clienteId;
        private String clienteNome;
        private String resultado;
        private Long pagamentoId;
        private String mensagemErro;

        public Long getMensalistaId() {
            return mensalistaId;
        }

        public void setMensalistaId(Long mensalistaId) {
            this.mensalistaId = mensalistaId;
        }

        public Long getClienteId() {
            return clienteId;
        }

        public void setClienteId(Long clienteId) {
            this.clienteId = clienteId;
        }

        public String getClienteNome() {
            return clienteNome;
        }

        public void setClienteNome(String clienteNome) {
            this.clienteNome = clienteNome;
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
}
