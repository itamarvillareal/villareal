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
    private int emailsMarcadosLidos;
    private int lancamentosCriados;
    private int lancamentosJaExistiam;
    private int falhas;
    private final List<String> erros = new ArrayList<>();
}
