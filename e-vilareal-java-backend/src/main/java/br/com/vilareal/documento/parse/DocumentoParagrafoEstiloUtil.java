package br.com.vilareal.documento.parse;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;

import java.util.Locale;

/** Converte propriedades de parágrafo Word (recuo, alinhamento) em CSS inline. */
public final class DocumentoParagrafoEstiloUtil {

    /** 1 cm ≈ 567 twips (1440 twips por polegada, 2,54 cm por polegada). */
    private static final double TWIPS_PER_CM = 566.929133857;

    private DocumentoParagrafoEstiloUtil() {}

    public static String estiloFromWordParagraph(XWPFParagraph paragrafo, boolean center, boolean justify) {
        if (paragrafo == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        if (center) {
            sb.append("text-align: center; ");
        } else if (justify) {
            sb.append("text-align: justify; ");
        }

        int firstLine = valorPositivo(paragrafo.getIndentationFirstLine());
        int left = valorPositivo(paragrafo.getIndentationLeft());
        int hanging = valorPositivo(paragrafo.getIndentationHanging());

        if (firstLine > 0) {
            sb.append("text-indent: ").append(twipsToCm(firstLine)).append("; ");
            if (left > 0) {
                sb.append("margin-left: ").append(twipsToCm(left)).append("; ");
            }
        } else if (hanging > 0) {
            sb.append("text-indent: -").append(twipsToCm(hanging)).append("; ");
            int marginLeft = left > 0 ? left + hanging : hanging;
            sb.append("margin-left: ").append(twipsToCm(marginLeft)).append("; ");
        } else if (left > 0) {
            sb.append("margin-left: ").append(twipsToCm(left)).append("; ");
        }

        String result = sb.toString().trim();
        return result.isEmpty() ? null : result;
    }

    private static int valorPositivo(int twips) {
        return twips > 0 ? twips : 0;
    }

    static String twipsToCm(int twips) {
        double cm = twips / TWIPS_PER_CM;
        return String.format(Locale.US, "%.2fcm", cm);
    }

    static String alinhamentoFromWord(ParagraphAlignment alignment) {
        if (alignment == null) {
            return null;
        }
        return switch (alignment) {
            case CENTER -> "text-align: center;";
            case BOTH -> "text-align: justify;";
            case RIGHT -> "text-align: right;";
            case LEFT -> "text-align: left;";
            default -> null;
        };
    }
}
