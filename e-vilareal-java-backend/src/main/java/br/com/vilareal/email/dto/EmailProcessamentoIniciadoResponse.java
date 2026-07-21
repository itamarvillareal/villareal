package br.com.vilareal.email.dto;

import lombok.Getter;
import lombok.Setter;

/** Resposta imediata quando o processamento Gmail roda em segundo plano (forçar completo). */
@Getter
@Setter
public class EmailProcessamentoIniciadoResponse {

    private boolean async = true;
    private Long jobRunId;
    private String jobName;
    private String fonte;
    private boolean forcarAtualizacao;
}
