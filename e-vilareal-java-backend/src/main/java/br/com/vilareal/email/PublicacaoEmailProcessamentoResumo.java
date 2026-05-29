package br.com.vilareal.email;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
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

    /** Cursor usado no início desta execução (null na primeira vez ou em forçar completo). */
    private Instant ultimaSincronizacaoAnterior;
    /** Novo cursor gravado ao final (data/hora do email mais recente visto). */
    private Instant ultimaSincronizacaoGravada;
    private boolean forcarAtualizacao;
    private boolean sincronizacaoIncremental;
    private String queryGmail;
}
