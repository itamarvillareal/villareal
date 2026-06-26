package br.com.vilareal.documento.parse;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Fallback: extrai texto de PDF e classifica por heurísticas de conteúdo (sem bold/center).
 */
@Component
public class DocumentoReformatarPdfParser {

    public DocumentoParseado parsear(InputStream inputStream) throws IOException {
        byte[] bytes = inputStream.readAllBytes();
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String texto = stripper.getText(doc);
            if (texto == null || texto.isBlank()) {
                throw new IllegalArgumentException(
                        "Não foi possível extrair texto do PDF (pode ser imagem escaneada). Prefira .docx.");
            }
            return parsearTexto(texto);
        }
    }

    DocumentoParseado parsearTexto(String textoBruto) {
        String texto = textoBruto.replace('\r', '\n').replaceAll("\\n{3,}", "\n\n").trim();
        List<String> linhas = new ArrayList<>();
        for (String linha : texto.split("\\n")) {
            String t = linha.trim();
            if (!t.isEmpty() && !DocumentoParseadoHeuristics.ehRuidoEscritorio(t)) {
                linhas.add(t);
            }
        }

        String enderecoJuizo = null;
        String numeroProcesso = null;
        String nomePeca = null;
        String localData = null;
        String nomeAdvogado = null;
        String oab = null;

        List<ParagrafoDocumento> preambulo = new ArrayList<>();
        List<SecaoDocumento> secoes = new ArrayList<>();
        List<ParagrafoDocumento> fecho = new ArrayList<>();

        int i = 0;
        while (i < linhas.size() && enderecoJuizo == null) {
            String linha = linhas.get(i);
            if (DocumentoParseadoHeuristics.pareceEnderecamentoJuizo(linha)) {
                enderecoJuizo = linha;
                i++;
                break;
            }
            i++;
        }

        while (i < linhas.size() && numeroProcesso == null) {
            String linha = linhas.get(i);
            if (DocumentoParseadoHeuristics.contemNumeroProcesso(linha)) {
                numeroProcesso = DocumentoParseadoHeuristics.extrairNumeroProcesso(linha);
                i++;
                break;
            }
            i++;
        }

        SecaoDocumento secaoAtual = null;
        boolean emFecho = false;

        while (i < linhas.size()) {
            String linha = linhas.get(i);
            i++;

            if (DocumentoParseadoHeuristics.ehFechoLinha(linha)) {
                emFecho = true;
                fecho.add(paragrafoSimples(linha, TipoParagrafo.FECHO));
                continue;
            }
            if (emFecho) {
                if (DocumentoParseadoHeuristics.ehLocalData(linha)) {
                    localData = linha;
                    continue;
                }
                if (DocumentoParseadoHeuristics.ehAssinatura(linha, true, true)) {
                    if (linha.toUpperCase(Locale.ROOT).contains("OAB")) {
                        oab = linha;
                    } else {
                        nomeAdvogado = linha;
                    }
                    continue;
                }
                fecho.add(paragrafoSimples(linha, TipoParagrafo.FECHO));
                continue;
            }

            if (nomePeca == null && DocumentoParseadoHeuristics.ehNomePecaTexto(linha)) {
                nomePeca = linha;
                preambulo.add(paragrafoSimples(linha, TipoParagrafo.NOME_PECA));
                continue;
            }

            if (DocumentoParseadoHeuristics.ehTituloPrincipalTexto(linha)) {
                if (secaoAtual != null) {
                    secoes.add(secaoAtual);
                }
                secaoAtual = new SecaoDocumento(linha, TipoTitulo.PRINCIPAL, new ArrayList<>());
                continue;
            }

            if (DocumentoParseadoHeuristics.ehSubtituloTexto(linha)) {
                if (secaoAtual != null) {
                    secoes.add(secaoAtual);
                }
                secaoAtual = new SecaoDocumento(linha, TipoTitulo.SUB, new ArrayList<>());
                continue;
            }

            TipoParagrafo tipo = DocumentoParseadoHeuristics.ehEnumeracao(linha, false)
                    ? TipoParagrafo.ENUMERACAO
                    : TipoParagrafo.CORPO;
            ParagrafoDocumento p = paragrafoSimples(linha, tipo);

            if (secaoAtual == null) {
                preambulo.add(p);
            } else {
                List<ParagrafoDocumento> ps = new ArrayList<>(secaoAtual.paragrafos());
                ps.add(p);
                secaoAtual = new SecaoDocumento(secaoAtual.titulo(), secaoAtual.tipoTitulo(), ps);
            }
        }

        if (secaoAtual != null) {
            secoes.add(secaoAtual);
        }

        return new DocumentoParseado(
                enderecoJuizo, numeroProcesso, preambulo, nomePeca, secoes, fecho, localData, nomeAdvogado, oab);
    }

    private static ParagrafoDocumento paragrafoSimples(String texto, TipoParagrafo tipo) {
        return new ParagrafoDocumento(tipo, List.of(new TextoFormatado(texto, false, false, false)));
    }
}
