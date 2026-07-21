package br.com.vilareal.documento.parse;

import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/** Converte tabelas Word (.docx) em HTML para o PDF reformatado. */
final class DocumentoDocxTabelaHtmlUtil {

    private DocumentoDocxTabelaHtmlUtil() {}

    static ParagrafoDocumento tabelaParaParagrafo(XWPFTable table) {
        String html = tabelaParaHtml(table);
        if (!StringUtils.hasText(html)) {
            return null;
        }
        return new ParagrafoDocumento(TipoParagrafo.TABELA, List.of(new TextoFormatado(html, false, false, false)));
    }

    static String tabelaParaHtml(XWPFTable table) {
        if (table == null || table.getRows().isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("<table class=\"doc-tabela\">");
        List<XWPFTableRow> rows = table.getRows();
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            XWPFTableRow row = rows.get(rowIndex);
            sb.append("<tr>");
            boolean cabecalho = rowIndex == 0;
            for (XWPFTableCell cell : row.getTableCells()) {
                String tag = cabecalho ? "th" : "td";
                sb.append('<').append(tag).append('>');
                sb.append(celulaParaHtml(cell));
                sb.append("</").append(tag).append('>');
            }
            sb.append("</tr>");
        }
        sb.append("</table>");
        return sb.toString();
    }

    private static String celulaParaHtml(XWPFTableCell cell) {
        List<String> blocos = new ArrayList<>();
        for (XWPFParagraph paragrafo : cell.getParagraphs()) {
            String html = paragrafoParaHtml(paragrafo);
            if (StringUtils.hasText(html)) {
                blocos.add(html);
            }
        }
        return String.join("<br/>", blocos);
    }

    private static String paragrafoParaHtml(XWPFParagraph paragrafo) {
        List<TextoFormatado> runs = extrairRuns(paragrafo);
        if (runs.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (TextoFormatado run : runs) {
            sb.append(runParaHtml(run));
        }
        return sb.toString();
    }

    private static String runParaHtml(TextoFormatado run) {
        String t = escapeHtml(run.texto());
        if (!StringUtils.hasText(t)) {
            return "";
        }
        if (run.negrito() && run.italico()) {
            return "<strong><em>" + t + "</em></strong>";
        }
        if (run.negrito()) {
            return "<strong>" + t + "</strong>";
        }
        if (run.italico()) {
            return "<em>" + t + "</em>";
        }
        return t;
    }

    private static List<TextoFormatado> extrairRuns(XWPFParagraph paragrafo) {
        List<TextoFormatado> runs = new ArrayList<>();
        for (XWPFRun run : paragrafo.getRuns()) {
            String texto = run.getText(0);
            if (texto == null || texto.isEmpty()) {
                continue;
            }
            runs.add(new TextoFormatado(texto, run.isBold(), run.isItalic(), false));
        }
        if (runs.isEmpty()) {
            String t = paragrafo.getText();
            if (StringUtils.hasText(t)) {
                runs.add(new TextoFormatado(t, false, false, false));
            }
        }
        return runs;
    }

    private static String escapeHtml(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
