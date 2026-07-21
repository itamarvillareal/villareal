package br.com.vilareal.pje.infrastructure.browser;

/** Mensagens estáveis do robô PJe (classificação de falha / logs). */
public final class PjeCopiaIntegralMessages {

    /** Login OK, mas CNJ não abre no acervo — comum após descadastro (PUSH pode continuar). */
    public static final String SEM_ACESSO_ACERVO =
            "Processo não localizado no acervo PJe (login OK). "
                    + "Possível descadastro ou falta de habilitação — o PUSH do tribunal pode continuar chegando.";

    private PjeCopiaIntegralMessages() {}
}
