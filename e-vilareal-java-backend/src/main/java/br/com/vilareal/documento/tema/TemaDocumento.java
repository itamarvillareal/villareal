package br.com.vilareal.documento.tema;

import org.springframework.util.StringUtils;

/**
 * Identidade visual de petições/procurações. Campos opcionais fazem overlay sobre {@link #padrao()};
 * logo vazio usa o asset Villa Real atual.
 */
public final class TemaDocumento {

    public static final String ID_PADRAO = "padrao";

    private static final String LOGO_PADRAO = "static/documentos/logo_cabecalho.jpeg";
    private static final String ADVOGADO_NOME_PADRAO = "Dr. Itamar Alexandre Felix Villa Real Junior";
    private static final String ADVOGADO_OAB_PADRAO = "OAB/GO 33.329";

    private static final String RODAPE_PRIMEIRA_PADRAO =
            """
            <p class="rodape-linha1">Av. Pinheiro Chagas, nº 232, Bairro Jundiaí, Anápolis-GO, CEP n 75.110-580.</p>
            <p class="rodape-linha2">Telefones: 62-3321-2374 (fixo), 62-98129-6212 (tim)</p>
            <p class="rodape-linha3">E-mail: <span class="rodape-email">villareal@villarealadvocacia.adv.br</span></p>
            <p class="rodape-linha4">www.villarealadvocacia.adv.br</p>
            """;

    private static final String RODAPE_CORRIDO_PADRAO =
            """
            <p class="rodape-linha1">Av. Pinheiro Chagas, nº 232, Bairro Jundiaí, Anápolis-GO, CEP n 75.110-580.</p>
            <p class="rodape-linha3">E-mail: <span class="rodape-email">villareal@villarealadvocacia.adv.br</span></p>
            <p class="rodape-linha4">www.villarealadvocacia.adv.br</p>
            """;

    private static final TemaDocumento INSTANCIA_PADRAO = new TemaDocumento(
            ID_PADRAO,
            LOGO_PADRAO,
            null,
            RODAPE_PRIMEIRA_PADRAO,
            RODAPE_CORRIDO_PADRAO,
            ADVOGADO_NOME_PADRAO,
            ADVOGADO_OAB_PADRAO);

    private final String id;
    private final String logoCabecalhoPath;
    private final String logoCabecalhoBase64;
    private final String rodapePrimeiraHtml;
    private final String rodapeCorridoHtml;
    private final String advogadoNome;
    private final String advogadoOab;

    private TemaDocumento(
            String id,
            String logoCabecalhoPath,
            String logoCabecalhoBase64,
            String rodapePrimeiraHtml,
            String rodapeCorridoHtml,
            String advogadoNome,
            String advogadoOab) {
        this.id = id;
        this.logoCabecalhoPath = logoCabecalhoPath;
        this.logoCabecalhoBase64 = logoCabecalhoBase64;
        this.rodapePrimeiraHtml = rodapePrimeiraHtml;
        this.rodapeCorridoHtml = rodapeCorridoHtml;
        this.advogadoNome = advogadoNome;
        this.advogadoOab = advogadoOab;
    }

    public static TemaDocumento padrao() {
        return INSTANCIA_PADRAO;
    }

    public static TemaDocumento personalizado(
            String id,
            String logoCabecalhoPath,
            String logoCabecalhoBase64,
            String rodapePrimeiraHtml,
            String rodapeCorridoHtml,
            String advogadoNome,
            String advogadoOab) {
        return new TemaDocumento(
                id,
                logoCabecalhoPath,
                logoCabecalhoBase64,
                rodapePrimeiraHtml,
                rodapeCorridoHtml,
                advogadoNome,
                advogadoOab);
    }

    public String id() {
        return id;
    }

    public String logoCabecalhoPathEfetivo() {
        return StringUtils.hasText(logoCabecalhoPath) ? logoCabecalhoPath.trim() : LOGO_PADRAO;
    }

    public String logoCabecalhoBase64Efetivo() {
        return StringUtils.hasText(logoCabecalhoBase64) ? logoCabecalhoBase64.trim() : null;
    }

    public String rodapePrimeiraHtmlEfetivo() {
        return StringUtils.hasText(rodapePrimeiraHtml) ? rodapePrimeiraHtml : RODAPE_PRIMEIRA_PADRAO;
    }

    public String rodapeCorridoHtmlEfetivo() {
        return StringUtils.hasText(rodapeCorridoHtml) ? rodapeCorridoHtml : RODAPE_CORRIDO_PADRAO;
    }

    public String advogadoNomeEfetivo() {
        return StringUtils.hasText(advogadoNome) ? advogadoNome.trim() : ADVOGADO_NOME_PADRAO;
    }

    public String advogadoOabEfetivo() {
        return StringUtils.hasText(advogadoOab) ? advogadoOab.trim() : ADVOGADO_OAB_PADRAO;
    }

    public static String advogadoNomePadrao() {
        return ADVOGADO_NOME_PADRAO;
    }

    public static String advogadoOabPadrao() {
        return ADVOGADO_OAB_PADRAO;
    }
}
