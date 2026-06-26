package br.com.vilareal.documento.parse;

import br.com.vilareal.documento.DocumentoReformatarConteudoRequest;
import br.com.vilareal.documento.DocumentoReformatarCorpoUnicoHtml;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoDocxParserContrarrazoesTest {

    private static final Path DOCX = Path.of(
            System.getProperty("user.home"),
            "Downloads",
            "Contrarrazoes Apelacao 5831274-43.docx");

    private final DocumentoDocxParser parser = new DocumentoDocxParser();

    static boolean docxDisponivel() {
        return Files.isRegularFile(DOCX);
    }

    @Test
    @EnabledIf("docxDisponivel")
    void parsear_contrarrazoesApelacao_incluiCorpoCompleto() throws Exception {
        int nonBlankRaw;
        try (XWPFDocument doc = new XWPFDocument(Files.newInputStream(DOCX))) {
            nonBlankRaw = (int) doc.getParagraphs().stream()
                    .map(XWPFParagraph::getText)
                    .filter(t -> t != null && !t.isBlank())
                    .count();
        }

        DocumentoParseado r;
        try (var in = Files.newInputStream(DOCX)) {
            r = parser.parsear(in);
        }

        int totalParagrafos = r.preambulo().size();
        for (SecaoDocumento s : r.secoes()) {
            totalParagrafos += s.paragrafos().size();
        }
        totalParagrafos += r.fecho().size();

        assertThat(r.nomePeca()).contains("CONTRARRAZ");
        assertThat(r.preambulo().stream().anyMatch(p -> p.tipo() == TipoParagrafo.NOME_PECA)).isTrue();

        String preambuloHtml = DocumentoParagrafoHtmlUtil.paragrafosToHtml(r.preambulo());
        assertThat(preambuloHtml).contains("nome-peca").contains("CONTRARRAZ");
        int idxSuas = preambuloHtml.indexOf("suas");
        int idxTitulo = preambuloHtml.indexOf("CONTRARRAZ");
        int idxPelas = preambuloHtml.indexOf("pelas razões");
        assertThat(idxSuas).isLessThan(idxTitulo);
        assertThat(idxTitulo).isLessThan(idxPelas);

        DocumentoReformatarConteudoRequest conteudo = new DocumentoReformatarConteudoRequest(
                r.enderecoJuizo(),
                r.numeroProcesso(),
                null,
                null,
                r.nomePeca(),
                preambuloHtml,
                List.of(),
                "",
                null,
                null,
                null,
                null);
        String corpoUnico = DocumentoReformatarCorpoUnicoHtml.montar(conteudo);
        String pdfHtml = DocumentoReformatarCorpoUnicoHtml.extrairHtmlParaPdf(corpoUnico);
        assertThat(pdfHtml).contains("CONTRARRAZÕES AO RECURSO DE APELAÇÃO");
        assertThat(pdfHtml).contains("RAZÕES DE CONTRARRAZÕES DE APELAÇÃO");

        assertThat(nonBlankRaw).isGreaterThan(20);
        assertThat(r.secoes()).isNotEmpty();
        assertThat(totalParagrafos).isGreaterThan(nonBlankRaw / 2);

        String todoTexto = r.preambulo().stream()
                .map(ParagrafoDocumento::textoPlano)
                .reduce("", String::concat)
                + r.secoes().stream()
                        .map(s -> s.titulo() != null ? s.titulo() : "")
                        .reduce("", String::concat)
                + r.secoes().stream()
                        .flatMap(s -> s.paragrafos().stream())
                        .map(ParagrafoDocumento::textoPlano)
                        .reduce("", String::concat);
        assertThat(todoTexto).contains("SÍNTESE").contains("PRELIMINARMENTE").contains("DESPROVIMENTO");
    }
}
