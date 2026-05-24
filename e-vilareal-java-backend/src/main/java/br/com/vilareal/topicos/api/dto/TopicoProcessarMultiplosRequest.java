package br.com.vilareal.topicos.api.dto;

import java.util.List;
import java.util.Map;

public class TopicoProcessarMultiplosRequest {

    private List<Long> topicoIds;
    private Long processoId;
    private Map<String, String> parametros;

    public List<Long> getTopicoIds() {
        return topicoIds;
    }

    public void setTopicoIds(List<Long> topicoIds) {
        this.topicoIds = topicoIds;
    }

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
