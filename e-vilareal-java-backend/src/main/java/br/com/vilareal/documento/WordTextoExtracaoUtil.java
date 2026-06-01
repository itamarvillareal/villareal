package br.com.vilareal.documento;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;

/** Extração de texto plano de DOCX/DOC (TEMP — sonda Júlia). */
public final class WordTextoExtracaoUtil {

    private WordTextoExtracaoUtil() {}

    public static boolean pareceDocx(byte[] bytes, String mimeType, String nome) {
        if ("application/vnd.openxmlformats-officedocument.wordprocessingml.document".equalsIgnoreCase(mimeType)) {
            return true;
        }
        return nome != null && nome.toLowerCase().endsWith(".docx");
    }

    public static boolean pareceDoc(byte[] bytes, String mimeType, String nome) {
        if ("application/msword".equalsIgnoreCase(mimeType)) {
            return true;
        }
        return nome != null && nome.toLowerCase().endsWith(".doc") && !nome.toLowerCase().endsWith(".docx");
    }

    /**
     * DOCX: parágrafos + tabelas + cabeçalhos/rodapés via {@link XWPFWordExtractor}
     * (cronogramas de parcelas costumam estar em tabela).
     */
    public static String extrairDocx(byte[] bytes) {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes));
                XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            String texto = extractor.getText();
            return texto == null ? "" : PdfTextoExtracaoUtil.normalizarTextoExtraido(texto);
        } catch (Exception e) {
            return "";
        }
    }

    /** DOC legado: {@link WordExtractor} já inclui conteúdo de tabelas. */
    public static String extrairDoc(byte[] bytes) {
        try (HWPFDocument doc = new HWPFDocument(new ByteArrayInputStream(bytes));
                WordExtractor extractor = new WordExtractor(doc)) {
            String texto = extractor.getText();
            return texto == null ? "" : PdfTextoExtracaoUtil.normalizarTextoExtraido(texto);
        } catch (Exception e) {
            return "";
        }
    }
}
