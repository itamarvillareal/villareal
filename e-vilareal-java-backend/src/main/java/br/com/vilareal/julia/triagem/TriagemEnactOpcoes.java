package br.com.vilareal.julia.triagem;

/** Opções do enactment da Júlia (triagem normal vs análise de backlog). */
public record TriagemEnactOpcoes(String contextoAdicional, boolean analiseSemPrazo) {

    public static TriagemEnactOpcoes padrao() {
        return new TriagemEnactOpcoes(null, false);
    }

    public static TriagemEnactOpcoes analiseBacklog(String contextoAdicional) {
        return new TriagemEnactOpcoes(contextoAdicional, true);
    }
}
