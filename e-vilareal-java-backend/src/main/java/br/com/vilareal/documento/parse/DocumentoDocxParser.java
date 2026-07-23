package br.com.vilareal.documento.parse;

import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Extrai estrutura e formatação inline de documentos .docx sem alterar o texto.
 */
@Component
public class DocumentoDocxParser {

    private enum Estado {
        CABECALHO,
        ENDERECAMENTO,
        PRE_CORPO,
        CORPO,
        FECHO,
        RODAPE
    }

    public DocumentoParseado parsear(InputStream inputStream) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(inputStream)) {
            return parsear(doc);
        }
    }

    DocumentoParseado parsear(XWPFDocument doc) {
        String enderecoJuizo = null;
        String numeroProcesso = null;
        String nomePeca = null;
        String localData = null;
        String nomeAdvogado = null;
        String oab = null;

        List<ParagrafoDocumento> preambulo = new ArrayList<>();
        List<SecaoDocumento> secoes = new ArrayList<>();
        List<ParagrafoDocumento> fecho = new ArrayList<>();

        Estado estado = Estado.CABECALHO;
        SecaoDocumento secaoAtual = null;

        for (IBodyElement element : doc.getBodyElements()) {
            if (element instanceof XWPFTable table) {
                secaoAtual = adicionarTabela(table, estado, preambulo, secaoAtual, fecho);
                continue;
            }
            if (!(element instanceof XWPFParagraph paragrafo)) {
                continue;
            }

            Props props = extrairPropriedades(paragrafo);
            if (props.texto().isBlank()) {
                continue;
            }

            switch (estado) {
                case CABECALHO -> {
                    if (props.cabecalhoEscritorio()) {
                        continue;
                    }
                    if (DocumentoParseadoHeuristics.pareceEnderecamentoJuizo(props.texto())) {
                        enderecoJuizo = props.texto().trim();
                        estado = Estado.ENDERECAMENTO;
                        continue;
                    }
                    if (props.fontSizeHalfPoints() > 22 || props.bold()) {
                        estado = Estado.PRE_CORPO;
                    } else {
                        continue;
                    }
                }
                case ENDERECAMENTO -> {
                    if (DocumentoParseadoHeuristics.contemNumeroProcesso(props.texto())) {
                        numeroProcesso = DocumentoParseadoHeuristics.extrairNumeroProcesso(props.texto());
                        estado = Estado.PRE_CORPO;
                        if (ehLinhaSomenteProcesso(props.texto(), numeroProcesso)) {
                            continue;
                        }
                    } else {
                        estado = Estado.PRE_CORPO;
                    }
                }
                default -> { /* fall through */ }
            }

            if ((estado == Estado.FECHO || estado == Estado.RODAPE)
                    && DocumentoParseadoHeuristics.pareceReinicioCorpo(props.texto(), props.center(), props.bold())) {
                fecho.clear();
                localData = null;
                nomeAdvogado = null;
                oab = null;
                removerFechoPrematuroDoPreambulo(preambulo);
                estado = Estado.CORPO;
                secaoAtual = null;
            } else if (estado == Estado.RODAPE) {
                if (DocumentoParseadoHeuristics.ehAssinatura(props.texto(), props.center(), props.bold())) {
                    if (props.texto().toUpperCase(Locale.ROOT).contains("OAB")) {
                        oab = props.texto().trim();
                    } else {
                        nomeAdvogado = props.texto().trim();
                    }
                }
                continue;
            }

            if (estado == Estado.FECHO) {
                if (DocumentoParseadoHeuristics.ehLocalData(props.texto())) {
                    localData = props.texto().trim();
                    estado = Estado.RODAPE;
                    continue;
                }
                if (DocumentoParseadoHeuristics.ehAssinatura(props.texto(), props.center(), props.bold())) {
                    estado = Estado.RODAPE;
                    if (props.texto().toUpperCase(Locale.ROOT).contains("OAB")) {
                        oab = props.texto().trim();
                    } else {
                        nomeAdvogado = props.texto().trim();
                    }
                    continue;
                }
                fecho.add(criarParagrafo(props, TipoParagrafo.FECHO));
                continue;
            }

            if (DocumentoParseadoHeuristics.ehFechoLinha(props.texto())) {
                if (corpoMinimoAtingido(preambulo, secoes, secaoAtual)) {
                    finalizarSecao(secoes, secaoAtual);
                    secaoAtual = null;
                    estado = Estado.FECHO;
                    fecho.add(criarParagrafo(props, TipoParagrafo.FECHO));
                    continue;
                }
            }

            if (estado == Estado.PRE_CORPO) {
                if (enderecoJuizo == null && DocumentoParseadoHeuristics.pareceEnderecamentoJuizo(props.texto())) {
                    enderecoJuizo = props.texto().trim();
                    continue;
                }
                if (numeroProcesso == null && DocumentoParseadoHeuristics.contemNumeroProcesso(props.texto())) {
                    numeroProcesso = DocumentoParseadoHeuristics.extrairNumeroProcesso(props.texto());
                    if (ehLinhaSomenteProcesso(props.texto(), numeroProcesso)) {
                        continue;
                    }
                }
                if (DocumentoParseadoHeuristics.ehTituloPrincipal(props.texto(), props.center(), props.bold())) {
                    if (secoes.isEmpty() && secaoAtual == null) {
                        removerFechoPrematuroDoPreambulo(preambulo);
                    }
                    estado = Estado.CORPO;
                    finalizarSecao(secoes, secaoAtual);
                    secaoAtual = novaSecao(props.texto(), TipoTitulo.PRINCIPAL);
                    continue;
                }
                if (nomePeca == null && DocumentoParseadoHeuristics.ehNomePeca(props.texto(), props.center(), props.bold())) {
                    nomePeca = props.texto().trim();
                    preambulo.add(criarParagrafo(props, TipoParagrafo.NOME_PECA));
                    continue;
                }
                preambulo.add(criarParagrafo(props, TipoParagrafo.CORPO));
                continue;
            }

            // CORPO
            if (DocumentoParseadoHeuristics.ehTituloPrincipal(props.texto(), props.center(), props.bold())) {
                finalizarSecao(secoes, secaoAtual);
                secaoAtual = novaSecao(props.texto(), TipoTitulo.PRINCIPAL);
                continue;
            }
            if (DocumentoParseadoHeuristics.ehSubtitulo(props.texto(), props.bold())) {
                finalizarSecao(secoes, secaoAtual);
                secaoAtual = novaSecao(props.texto(), TipoTitulo.SUB);
                continue;
            }

            TipoParagrafo tipo = DocumentoParseadoHeuristics.ehEnumeracao(props.texto(), props.temListaNativa())
                    ? TipoParagrafo.ENUMERACAO
                    : TipoParagrafo.CORPO;
            ParagrafoDocumento p = criarParagrafo(props, tipo);

            if (secaoAtual == null) {
                preambulo.add(p);
            } else {
                secaoAtual = adicionarParagrafo(secaoAtual, p);
            }
        }

        finalizarSecao(secoes, secaoAtual);

        return new DocumentoParseado(
                enderecoJuizo,
                numeroProcesso,
                preambulo,
                nomePeca,
                secoes,
                fecho,
                localData,
                nomeAdvogado,
                oab);
    }

    private static void removerFechoPrematuroDoPreambulo(List<ParagrafoDocumento> preambulo) {
        preambulo.removeIf(p -> {
            String t = p.textoPlano();
            return DocumentoParseadoHeuristics.ehFechoLinha(t)
                    || DocumentoParseadoHeuristics.ehLocalData(t)
                    || DocumentoParseadoHeuristics.ehLinhaAssinaturaOuOab(t);
        });
    }

    private static boolean corpoMinimoAtingido(
            List<ParagrafoDocumento> preambulo,
            List<SecaoDocumento> secoes,
            SecaoDocumento secaoAtual) {
        int n = preambulo.size();
        for (SecaoDocumento s : secoes) {
            n += s.paragrafos().size();
        }
        if (secaoAtual != null) {
            n += secaoAtual.paragrafos().size();
        }
        return n >= 8;
    }

    private static SecaoDocumento adicionarTabela(
            XWPFTable table,
            Estado estado,
            List<ParagrafoDocumento> preambulo,
            SecaoDocumento secaoAtual,
            List<ParagrafoDocumento> fecho) {
        ParagrafoDocumento tabela = DocumentoDocxTabelaHtmlUtil.tabelaParaParagrafo(table);
        if (tabela == null) {
            return secaoAtual;
        }
        if (estado == Estado.FECHO) {
            fecho.add(tabela);
            return secaoAtual;
        }
        if (estado != Estado.CORPO && estado != Estado.PRE_CORPO) {
            return secaoAtual;
        }
        if (secaoAtual == null) {
            preambulo.add(tabela);
        } else {
            secaoAtual = adicionarParagrafo(secaoAtual, tabela);
        }
        return secaoAtual;
    }

    private static void finalizarSecao(List<SecaoDocumento> secoes, SecaoDocumento secaoAtual) {
        if (secaoAtual != null && (!secaoAtual.paragrafos().isEmpty() || secaoAtual.titulo() != null)) {
            secoes.add(secaoAtual);
        }
    }

    private static SecaoDocumento novaSecao(String titulo, TipoTitulo tipo) {
        return new SecaoDocumento(titulo.trim(), tipo, new ArrayList<>());
    }

    private static SecaoDocumento adicionarParagrafo(SecaoDocumento secao, ParagrafoDocumento p) {
        List<ParagrafoDocumento> ps = new ArrayList<>(secao.paragrafos());
        ps.add(p);
        return new SecaoDocumento(secao.titulo(), secao.tipoTitulo(), ps);
    }

    private static ParagrafoDocumento criarParagrafo(Props props, TipoParagrafo tipo) {
        return new ParagrafoDocumento(tipo, props.runs(), props.estiloCss());
    }

    private static boolean ehLinhaSomenteProcesso(String texto, String numeroProcesso) {
        if (!StringUtils.hasText(texto) || !StringUtils.hasText(numeroProcesso)) {
            return false;
        }
        String t = texto.trim();
        if (t.equalsIgnoreCase(numeroProcesso)) {
            return true;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        return lower.startsWith("processo") || lower.startsWith("autos");
    }

    private Props extrairPropriedades(XWPFParagraph paragrafo) {
        List<TextoFormatado> runs = extrairRuns(paragrafo);
        String texto = runs.stream().map(TextoFormatado::texto).reduce("", String::concat).trim();

        boolean center = paragrafo.getAlignment() == ParagraphAlignment.CENTER;
        boolean justify = paragrafo.getAlignment() == ParagraphAlignment.BOTH;
        boolean temLista = paragrafo.getNumIlvl() != null;

        boolean bold = false;
        boolean allCaps = false;
        int maxFont = 0;
        for (TextoFormatado r : runs) {
            if (r.negrito()) {
                bold = true;
            }
            if (r.caps()) {
                allCaps = true;
            }
        }
        if (!bold && runs.size() == 1) {
            bold = runs.get(0).negrito();
        }
        if (DocumentoParseadoHeuristics.textoTodoCaps(texto)) {
            allCaps = true;
        }

        for (XWPFRun run : paragrafo.getRuns()) {
            int sz = resolverFontSizeHalfPoints(run);
            if (sz > maxFont) {
                maxFont = sz;
            }
        }
        if (maxFont == 0) {
            maxFont = 24;
        }

        String estiloCss = DocumentoParagrafoEstiloUtil.estiloFromWordParagraph(paragrafo, center, justify);
        return new Props(texto, runs, center, justify, bold, allCaps, maxFont, temLista, estiloCss);
    }

    private static int resolverFontSizeHalfPoints(XWPFRun run) {
        Double sz = run.getFontSizeAsDouble();
        if (sz != null && sz > 0) {
            return (int) Math.round(sz * 2);
        }
        return 0;
    }

    private static List<TextoFormatado> extrairRuns(XWPFParagraph paragrafo) {
        List<TextoFormatado> runs = new ArrayList<>();
        for (XWPFRun run : paragrafo.getRuns()) {
            String texto = run.getText(0);
            if (texto == null || texto.isEmpty()) {
                continue;
            }
            boolean negrito = run.isBold();
            boolean italico = run.isItalic();
            boolean caps = run.isCapitalized() || run.isSmallCaps();
            runs.add(new TextoFormatado(texto, negrito, italico, caps));
        }
        if (runs.isEmpty()) {
            String t = paragrafo.getText();
            if (t != null && !t.isBlank()) {
                runs.add(new TextoFormatado(t, false, false, false));
            }
        }
        return runs;
    }

    private record Props(
            String texto,
            List<TextoFormatado> runs,
            boolean center,
            boolean justify,
            boolean bold,
            boolean allCaps,
            int fontSizeHalfPoints,
            boolean temListaNativa,
            String estiloCss) {

        boolean cabecalhoEscritorio() {
            if (DocumentoParseadoHeuristics.ehRuidoEscritorio(texto)) {
                return true;
            }
            return fontSizeHalfPoints <= 22 && center && !DocumentoParseadoHeuristics.pareceEnderecamentoJuizo(texto);
        }
    }
}
