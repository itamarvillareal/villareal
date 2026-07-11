package br.com.vilareal.projudi;

/**
 * Resposta do PROJUDI sem a estrutura HTML esperada (lista, detalhe, paginação). Falha
 * ALTO de propósito: uma página inesperada tratada como "lista vazia" corromperia o
 * estado do monitoramento (ex.: baseline vazia → acervo inteiro vira falso NOVO).
 * A varredura converte esta exceção em {@code erro_codigo=ESTRUTURA_INESPERADA}.
 */
public class ProjudiEstruturaInesperadaException extends RuntimeException {

    /** Código estável gravado em varredura_pessoa.erro_codigo. */
    public static final String CODIGO = "ESTRUTURA_INESPERADA";

    public ProjudiEstruturaInesperadaException(String message) {
        super(message);
    }
}
