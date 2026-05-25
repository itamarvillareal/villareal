package br.com.vilareal.email;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class PublicacaoEmailProcessamentoResumo {

    private int emailsLidos;
    /** Blocos principais extraídos dos e-mails (uma linha por publicação efetiva). */
    private int publicacoesEncontradas;
    /** CNJs principais distintos no lote processado. */
    private int processosUnicos;
    private int publicacoesProcessadas;
    private int publicacoesDuplicadasIgnoradas;
    /** Publicações vinculadas automaticamente ao processo cadastrado (CNJ). */
    private int vinculosAutomaticos;
    private List<String> erros = new ArrayList<>();
}
