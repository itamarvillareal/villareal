package br.com.vilareal.topicos.api.dto;

import java.util.Map;

public class TopicoProcessarRequest {

    private Long processoId;
    private Map<String, String> parametros;

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public Map<String, String> getParametros() {
        return parametros;
    }

    public void setParametros(Map<String, String> parametros) {
        this.parametros = parametros;
    }
}
