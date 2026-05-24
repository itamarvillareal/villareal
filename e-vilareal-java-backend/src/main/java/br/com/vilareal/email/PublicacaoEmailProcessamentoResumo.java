package br.com.vilareal.email;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class PublicacaoEmailProcessamentoResumo {

    private int emailsLidos;
    private int publicacoesProcessadas;
    private List<String> erros = new ArrayList<>();
}
