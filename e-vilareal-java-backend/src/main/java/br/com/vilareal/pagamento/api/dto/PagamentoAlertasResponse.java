package br.com.vilareal.pagamento.api.dto;

public class PagamentoAlertasResponse {

    private long vencidos;
    private long vencendoHoje;
    private long proximos3Dias;
    private long proximos7Dias;
    private long agendadosAguardandoConfirmacao;
    private long conferenciaPendente;
    private long pagoSemComprovante;
    private long altoValor;
    private long urgentes;
    private PagamentoAlertaValorResponse pagosNaoConciliados;
    private PagamentoAlertaValorResponse conferidosNaoAcertados;

    public long getVencidos() {
        return vencidos;
    }

    public void setVencidos(long vencidos) {
        this.vencidos = vencidos;
    }

    public long getVencendoHoje() {
        return vencendoHoje;
    }

    public void setVencendoHoje(long vencendoHoje) {
        this.vencendoHoje = vencendoHoje;
    }

    public long getProximos3Dias() {
        return proximos3Dias;
    }

    public void setProximos3Dias(long proximos3Dias) {
        this.proximos3Dias = proximos3Dias;
    }

    public long getProximos7Dias() {
        return proximos7Dias;
    }

    public void setProximos7Dias(long proximos7Dias) {
        this.proximos7Dias = proximos7Dias;
    }

    public long getAgendadosAguardandoConfirmacao() {
        return agendadosAguardandoConfirmacao;
    }

    public void setAgendadosAguardandoConfirmacao(long agendadosAguardandoConfirmacao) {
        this.agendadosAguardandoConfirmacao = agendadosAguardandoConfirmacao;
    }

    public long getConferenciaPendente() {
        return conferenciaPendente;
    }

    public void setConferenciaPendente(long conferenciaPendente) {
        this.conferenciaPendente = conferenciaPendente;
    }

    public long getPagoSemComprovante() {
        return pagoSemComprovante;
    }

    public void setPagoSemComprovante(long pagoSemComprovante) {
        this.pagoSemComprovante = pagoSemComprovante;
    }

    public long getAltoValor() {
        return altoValor;
    }

    public void setAltoValor(long altoValor) {
        this.altoValor = altoValor;
    }

    public long getUrgentes() {
        return urgentes;
    }

    public void setUrgentes(long urgentes) {
        this.urgentes = urgentes;
    }

    public PagamentoAlertaValorResponse getPagosNaoConciliados() {
        return pagosNaoConciliados;
    }

    public void setPagosNaoConciliados(PagamentoAlertaValorResponse pagosNaoConciliados) {
        this.pagosNaoConciliados = pagosNaoConciliados;
    }

    public PagamentoAlertaValorResponse getConferidosNaoAcertados() {
        return conferidosNaoAcertados;
    }

    public void setConferidosNaoAcertados(PagamentoAlertaValorResponse conferidosNaoAcertados) {
        this.conferidosNaoAcertados = conferidosNaoAcertados;
    }
}
