package br.com.vilareal.projudi;

/**
 * Correções pontuais de mojibake (UTF-8 lido como ISO-8859-1) em textos do PROJUDI.
 */
public final class ProjudiTextoUtil {

    private static final int MAX_TEXTO_NOME_ARQUIVO_DRIVE = 120;

    private ProjudiTextoUtil() {}

    /**
     * Corrige pares conhecidos de mojibake. Nunca substitui {@code Ã} avulso.
     */
    public static String limparTexto(String texto) {
        if (texto == null) {
            return "";
        }
        return texto
                .replace("Ã\u00A0", "à")
                .replace("Ã©", "é")
                .replace("Ã£", "ã")
                .replace("Ã§", "ç")
                .replace("Ã¡", "á")
                .replace("Ã³", "ó")
                .replace("Ãº", "ú")
                .replace("Ãª", "ê")
                .replace("Ã´", "ô")
                .replace("Ã­", "í");
    }

    /**
     * Nome no Drive: {@code {NNNN} Movimentação - Arquivo {II} - {TEXTO}.{ext}}.
     * O prefixo numérico permanece no início (dedup/watermark progressivo).
     */
    public static String montarNomeArquivoMovimentacaoDrive(
            int seqMov, int indiceArquivo, String extensaoComPonto, ProjudiTeorService.MovimentacaoProjudi mov) {
        String prefixo = String.format("%04d Movimentação - Arquivo %02d", seqMov, indiceArquivo);
        String texto = textoMovimentacaoParaNomeArquivo(mov);
        if (texto.isEmpty()) {
            return prefixo + extensaoComPonto;
        }
        return prefixo + " - " + texto + extensaoComPonto;
    }

    static String textoMovimentacaoParaNomeArquivo(ProjudiTeorService.MovimentacaoProjudi mov) {
        if (mov == null) {
            return "";
        }
        String tipo = limparTexto(mov.tipo());
        String descricao = limparTexto(mov.descricao());
        String bruto;
        if (!tipo.isBlank() && !descricao.isBlank()) {
            bruto = tipo.trim() + " -> " + descricao.trim();
        } else if (!tipo.isBlank()) {
            bruto = tipo.trim();
        } else {
            bruto = descricao.trim();
        }
        return truncar(sanitizarSegmentoNomeArquivo(bruto), MAX_TEXTO_NOME_ARQUIVO_DRIVE);
    }

    /** Remove caracteres inválidos no Drive; mantém {@code ->}. */
    static String sanitizarSegmentoNomeArquivo(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        return texto.trim().replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ").trim();
    }

    private static String truncar(String s, int max) {
        if (s == null || s.length() <= max) {
            return s == null ? "" : s;
        }
        return s.substring(0, max).trim();
    }
}
