package br.com.vilareal.documento;

import br.com.vilareal.documento.parse.DocumentoDocxParser;
import br.com.vilareal.documento.parse.DocumentoParseado;
import br.com.vilareal.documento.parse.DocumentoReformatarPdfParser;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.time.format.DateTimeParseException;
import java.util.Locale;

@Service
public class DocumentoReformatarService {

    private static final long MAX_BYTES = 25L * 1024 * 1024;

    private final DocumentoDocxParser docxParser;
    private final DocumentoReformatarPdfParser pdfParser;
    private final DocumentoPdfService pdfService;

    public DocumentoReformatarService(
            DocumentoDocxParser docxParser,
            DocumentoReformatarPdfParser pdfParser,
            DocumentoPdfService pdfService) {
        this.docxParser = docxParser;
        this.pdfParser = pdfParser;
        this.pdfService = pdfService;
    }

    public byte[] reformatar(MultipartFile arquivo) throws IOException {
        return reformatar(arquivo, null, null, null, null);
    }

    public byte[] reformatar(
            MultipartFile arquivo,
            String enderecamentoOverride,
            String numeroProcessoOverride,
            String cidadeEstado,
            String dataIso)
            throws IOException {
        validarArquivo(arquivo);
        DocumentoParseado parseado = parsear(arquivo);
        DocumentoRenderContext ctx = converterParaContext(parseado, enderecamentoOverride, numeroProcessoOverride, cidadeEstado, dataIso);
        return pdfService.gerarPdf(ctx);
    }

    private DocumentoParseado parsear(MultipartFile arquivo) throws IOException {
        String nome = nomeArquivo(arquivo);
        String contentType =
                arquivo.getContentType() != null ? arquivo.getContentType().toLowerCase(Locale.ROOT) : "";

        if (nome.endsWith(".docx")
                || contentType.contains("officedocument.wordprocessingml")
                || contentType.contains("wordprocessingml")) {
            return docxParser.parsear(arquivo.getInputStream());
        }
        if (nome.endsWith(".pdf") || contentType.contains("pdf")) {
            return pdfParser.parsear(arquivo.getInputStream());
        }
        if (nome.endsWith(".doc") || contentType.contains("msword")) {
            throw new IllegalArgumentException(
                    "Formato .doc não suportado. Salve como .docx (Word) ou exporte em PDF.");
        }
        throw new IllegalArgumentException("Formato não suportado. Use .docx ou .pdf.");
    }

    private static void validarArquivo(MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new IllegalArgumentException("Selecione um arquivo Word (.docx) ou PDF.");
        }
        if (arquivo.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Arquivo muito grande (máximo 25 MB).");
        }
    }

    private static String nomeArquivo(MultipartFile arquivo) {
        return arquivo.getOriginalFilename() != null
                ? arquivo.getOriginalFilename().toLowerCase(Locale.ROOT)
                : "";
    }

    DocumentoRenderContext converterParaContext(
            DocumentoParseado parseado,
            String enderecamentoOverride,
            String numeroProcessoOverride,
            String cidadeEstado,
            String dataIso) {
        String enderecamento = StringUtils.hasText(enderecamentoOverride)
                ? enderecamentoOverride.trim()
                : (StringUtils.hasText(parseado.enderecoJuizo()) ? parseado.enderecoJuizo().trim() : "");

        String numeroProcesso = StringUtils.hasText(numeroProcessoOverride)
                ? numeroProcessoOverride.trim()
                : parseado.numeroProcesso();

        String cidade = StringUtils.hasText(cidadeEstado) ? cidadeEstado.trim() : "Anápolis, estado de Goiás";
        LocalDate data = parseData(dataIso);

        boolean temFecho = !parseado.fecho().isEmpty();
        String localData = StringUtils.hasText(parseado.localData()) ? parseado.localData().trim() : null;

        return new DocumentoRenderContext(
                enderecamento,
                numeroProcesso,
                cidade,
                data,
                true,
                parseado.nomePeca(),
                null,
                List.of(),
                List.of(),
                parseado.preambulo(),
                parseado.secoes(),
                parseado.fecho(),
                localData,
                temFecho);
    }

    private static LocalDate parseData(String dataIso) {
        if (!StringUtils.hasText(dataIso)) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(dataIso.trim());
        } catch (DateTimeParseException e) {
            return LocalDate.now();
        }
    }
}
