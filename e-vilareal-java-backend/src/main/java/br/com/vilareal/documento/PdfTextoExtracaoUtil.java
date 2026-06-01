package br.com.vilareal.documento;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/** Extração de texto PDF (PDFBox) e heurística «precisa OCR?». */
public final class PdfTextoExtracaoUtil {

    /** Página considerada «sem texto» antes do OCR. */
    private static final int MIN_CHARS_PAGINA_SEM_TEXTO = 5;
    /** Ganho mínimo de chars (sem espaços) para contar página como OCRada. */
    private static final int DELTA_CHARS_PAGINA_OCR = 15;

    private PdfTextoExtracaoUtil() {}

    public static boolean parecePdf(byte[] bytes) {
        if (bytes == null || bytes.length < 5) {
            return false;
        }
        return bytes[0] == '%'
                && bytes[1] == 'P'
                && bytes[2] == 'D'
                && bytes[3] == 'F';
    }

    public static String extrairTexto(byte[] pdfBytes) {
        if (!parecePdf(pdfBytes)) {
            return "";
        }
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String texto = stripper.getText(doc);
            return normalizarTextoExtraido(texto);
        } catch (Exception e) {
            return "";
        }
    }

    public static List<String> extrairTextoPorPagina(byte[] pdfBytes) {
        if (!parecePdf(pdfBytes)) {
            return List.of();
        }
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            int total = doc.getNumberOfPages();
            List<String> paginas = new ArrayList<>(total);
            for (int pagina = 1; pagina <= total; pagina++) {
                stripper.setStartPage(pagina);
                stripper.setEndPage(pagina);
                paginas.add(normalizarTextoExtraido(stripper.getText(doc)));
            }
            return paginas;
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Compara texto por página antes/depois do {@code ocrmypdf --skip-text}.
     * Páginas que ganharam texto significativo contam como OCRadas.
     */
    public static int contarPaginasComOcrAdicionado(byte[] pdfAntes, byte[] pdfDepois) {
        List<String> antes = extrairTextoPorPagina(pdfAntes);
        List<String> depois = extrairTextoPorPagina(pdfDepois);
        int max = Math.max(antes.size(), depois.size());
        int paginasOcr = 0;
        for (int i = 0; i < max; i++) {
            int charsAntes = tamanhoTextoSignificativo(i < antes.size() ? antes.get(i) : "");
            int charsDepois = tamanhoTextoSignificativo(i < depois.size() ? depois.get(i) : "");
            if (charsDepois > charsAntes + DELTA_CHARS_PAGINA_OCR
                    || (charsAntes < MIN_CHARS_PAGINA_SEM_TEXTO
                            && charsDepois >= MIN_CHARS_PAGINA_SEM_TEXTO)) {
                paginasOcr++;
            }
        }
        return paginasOcr;
    }

    /** Para {@code --redo-ocr}: conta páginas cujo texto extraído mudou (OCR refeito). */
    public static int contarPaginasComTextoAlterado(byte[] pdfAntes, byte[] pdfDepois) {
        List<String> antes = extrairTextoPorPagina(pdfAntes);
        List<String> depois = extrairTextoPorPagina(pdfDepois);
        int max = Math.max(antes.size(), depois.size());
        int alteradas = 0;
        for (int i = 0; i < max; i++) {
            String tAntes = normalizarParaComparacao(i < antes.size() ? antes.get(i) : "");
            String tDepois = normalizarParaComparacao(i < depois.size() ? depois.get(i) : "");
            if (!tAntes.equals(tDepois)) {
                alteradas++;
            }
        }
        return alteradas;
    }

    public static String normalizarTextoExtraido(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replace('\r', '\n').replaceAll("\\n{3,}", "\n\n").trim();
    }

    /** Texto abaixo do limiar ⇒ provável scan/imagem sem camada de texto. */
    public static boolean precisaOcr(String textoExtraido, int minCaracteres) {
        int limite = Math.max(1, minCaracteres);
        String t = textoExtraido == null ? "" : textoExtraido.replaceAll("\\s+", "").trim();
        return t.length() < limite;
    }

    public static boolean precisaOcr(byte[] pdfBytes, int minCaracteres) {
        if (!parecePdf(pdfBytes)) {
            return false;
        }
        return precisaOcr(extrairTexto(pdfBytes), minCaracteres);
    }

    public static String resumirParaLog(String texto, int max) {
        if (!StringUtils.hasText(texto)) {
            return "(vazio)";
        }
        String t = texto.replaceAll("\\s+", " ").trim();
        int lim = Math.max(20, max);
        if (t.length() <= lim) {
            return t;
        }
        return t.substring(0, lim) + "…";
    }

    /**
     * Gate de segurança antes de substituir PDF no Drive ou no upload do robô.
     * Primeiro passe: rejeita saída inválida ou com menos texto que o original.
     * Redo: PDF válido, texto acima do limiar e não drasticamente menor (&lt; 50% do original).
     */
    public static ValidacaoPdfSaida validarPdfSaida(
            byte[] pdfOriginal, byte[] pdfCandidato, boolean modoRedo, int minCaracteres) {
        ValidacaoPdfSaida estrutural = validarEstruturaPdfSaida(pdfCandidato);
        if (!estrutural.aceito()) {
            return estrutural;
        }
        int charsOriginal = tamanhoTextoSignificativo(extrairTexto(pdfOriginal));
        int charsSaida = tamanhoTextoSignificativo(extrairTexto(pdfCandidato));
        return validarContagemTextoPosOcr(charsOriginal, charsSaida, minCaracteres, modoRedo);
    }

    /** Testável: regras de texto pós-OCR (primeiro passe vs redo). */
    static ValidacaoPdfSaida validarContagemTextoPosOcr(
            int charsOriginal, int charsSaida, int minCaracteres, boolean modoRedo) {
        int limiar = Math.max(1, minCaracteres);
        if (modoRedo) {
            if (charsSaida < limiar) {
                return ValidacaoPdfSaida.rejeitar(
                        "texto abaixo do limiar após redo (" + charsSaida + " < " + limiar + " chars)");
            }
            if (charsOriginal > 0 && charsSaida * 2 < charsOriginal) {
                return ValidacaoPdfSaida.rejeitar(
                        "texto drasticamente menor que o original ("
                                + charsSaida + " < 50% de " + charsOriginal + " chars)");
            }
            return ValidacaoPdfSaida.ok();
        }
        if (charsSaida < charsOriginal) {
            return ValidacaoPdfSaida.rejeitar(
                    "texto extraído menor que o original (" + charsSaida + " < " + charsOriginal + " chars)");
        }
        return ValidacaoPdfSaida.ok();
    }

    /** Compat: primeiro passe (robô/backfill skip-text). */
    public static ValidacaoPdfSaida validarPdfSaida(byte[] pdfOriginal, byte[] pdfCandidato) {
        return validarPdfSaida(pdfOriginal, pdfCandidato, false, 32);
    }

    private static ValidacaoPdfSaida validarEstruturaPdfSaida(byte[] pdfCandidato) {
        if (pdfCandidato == null || pdfCandidato.length == 0) {
            return ValidacaoPdfSaida.rejeitar("PDF de saída vazio");
        }
        if (!parecePdf(pdfCandidato)) {
            return ValidacaoPdfSaida.rejeitar("saída não parece PDF");
        }
        try (PDDocument doc = Loader.loadPDF(pdfCandidato)) {
            if (doc.getNumberOfPages() <= 0) {
                return ValidacaoPdfSaida.rejeitar("PDF de saída sem páginas");
            }
        } catch (Exception e) {
            return ValidacaoPdfSaida.rejeitar("PDF de saída inválido: " + e.getMessage());
        }
        return ValidacaoPdfSaida.ok();
    }

    public record ValidacaoPdfSaida(boolean aceito, String motivoRejeicao) {
        public static ValidacaoPdfSaida ok() {
            return new ValidacaoPdfSaida(true, null);
        }

        public static ValidacaoPdfSaida rejeitar(String motivo) {
            return new ValidacaoPdfSaida(false, motivo);
        }
    }

    private static int tamanhoTextoSignificativo(String texto) {
        if (texto == null) {
            return 0;
        }
        return texto.replaceAll("\\s+", "").length();
    }

    private static String normalizarParaComparacao(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replaceAll("\\s+", " ").trim();
    }
}
