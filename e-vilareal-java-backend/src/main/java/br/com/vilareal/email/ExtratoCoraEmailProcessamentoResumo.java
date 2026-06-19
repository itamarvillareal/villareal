package br.com.vilareal.email;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ExtratoCoraEmailProcessamentoResumo {

    private int emailsEncontrados;
    private int emailsProcessados;
    /** E-mails já importados anteriormente (registrados em {@code extrato_cora_email_processado}). */
    private int emailsIgnorados;
    private int emailsMarcadosLidos;
    private int lancamentosCriados;
    private int lancamentosJaExistiam;
    private int falhas;
    private final List<String> erros = new ArrayList<>();
}
