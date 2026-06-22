package br.com.vilareal.financeiro.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ExtratoPosImportResponse {

    private boolean executado;
    private String motivoIgnorado;
    private int honorariosAutoConciliados;
    private int honorariosAmbiguos;
    private List<String> erros = new ArrayList<>();

    public boolean isExecutado() {
        return executado;
    }

    public void setExecutado(boolean executado) {
        this.executado = executado;
    }

    public String getMotivoIgnorado() {
        return motivoIgnorado;
    }

    public void setMotivoIgnorado(String motivoIgnorado) {
        this.motivoIgnorado = motivoIgnorado;
    }

    public int getHonorariosAutoConciliados() {
        return honorariosAutoConciliados;
    }

    public void setHonorariosAutoConciliados(int honorariosAutoConciliados) {
        this.honorariosAutoConciliados = honorariosAutoConciliados;
    }

    public int getHonorariosAmbiguos() {
        return honorariosAmbiguos;
    }

    public void setHonorariosAmbiguos(int honorariosAmbiguos) {
        this.honorariosAmbiguos = honorariosAmbiguos;
    }

    public List<String> getErros() {
        return erros;
    }

    public void setErros(List<String> erros) {
        this.erros = erros;
    }
}
