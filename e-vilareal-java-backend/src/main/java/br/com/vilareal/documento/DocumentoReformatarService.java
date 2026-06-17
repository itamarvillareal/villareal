package br.com.vilareal.documento;

import br.com.vilareal.documento.parse.DocumentoDocxParser;
import br.com.vilareal.documento.parse.DocumentoLocalDataResolver;
import br.com.vilareal.documento.parse.DocumentoParseado;
import br.com.vilareal.documento.parse.DocumentoParagrafoHtmlUtil;
import br.com.vilareal.documento.parse.DocumentoReformatarPdfParser;
import br.com.vilareal.documento.parse.ParagrafoDocumento;
import br.com.vilareal.documento.parse.SecaoDocumento;
import br.com.vilareal.documento.parse.TipoParagrafo;
import br.com.vilareal.documento.parse.TipoTitulo;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.regex.Pattern;

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
        return reformatar(arquivo, null, null, null, null, null);
    }

    public byte[] reformatar(
            MultipartFile arquivo,
            String enderecamentoOverride,
            String numeroProcessoOverride,
            String cidadeEstado,
            String dataIso)
            throws IOException {
        return reformatar(arquivo, enderecamentoOverride, numeroProcessoOverride, cidadeEstado, dataIso, null);
    }

    public byte[] reformatar(
            MultipartFile arquivo,
            String enderecamentoOverride,
            String numeroProcessoOverride,
            String cidadeEstado,
            String dataIso,
            Long processoId)
            throws IOException {
        validarArquivo(arquivo);
        DocumentoParseado parseado = parsear(arquivo);
        DocumentoRenderContext ctx =
                converterParaContext(parseado, enderecamentoOverride, numeroProcessoOverride, cidadeEstado, dataIso, processoId);
        return pdfService.gerarPdf(ctx);
    }

    public DocumentoReformatarConteudoRequest extrairConteudo(
            MultipartFile arquivo,
            String enderecamentoOverride,
            String numeroProcessoOverride,
            String cidadeEstado,
            String dataIso)
            throws IOException {
        return extrairConteudo(arquivo, enderecamentoOverride, numeroProcessoOverride, cidadeEstado, dataIso, null);
    }

    public DocumentoReformatarConteudoRequest extrairConteudo(
            MultipartFile arquivo,
            String enderecamentoOverride,
            String numeroProcessoOverride,
            String cidadeEstado,
            String dataIso,
            Long processoId)
            throws IOException {
        validarArquivo(arquivo);
        DocumentoParseado parseado = parsear(arquivo);
        DocumentoRenderContext ctx =
                converterParaContext(parseado, enderecamentoOverride, numeroProcessoOverride, cidadeEstado, dataIso, processoId);
        LocalDate data = ctx.data() != null ? ctx.data() : LocalDate.now();

        List<DocumentoReformatarConteudoRequest.SecaoConteudo> secoes = parseado.secoes().stream()
                .map(s -> new DocumentoReformatarConteudoRequest.SecaoConteudo(
                        s.titulo(),
                        s.tipoTitulo().name(),
                        DocumentoParagrafoHtmlUtil.paragrafosToHtml(s.paragrafos())))
                .toList();

        return new DocumentoReformatarConteudoRequest(
                ctx.enderecamento(),
                ctx.numeroProcesso(),
                ctx.cidadeEstado(),
                data.toString(),
                parseado.nomePeca(),
                DocumentoParagrafoHtmlUtil.paragrafosToHtml(parseado.preambulo()),
                secoes,
                DocumentoParagrafoHtmlUtil.paragrafosToHtml(ctx.fechoParagrafos()),
                null,
                null,
                null,
                processoId);
    }

    public DocumentoReformatarConteudoRequest enriquecerComCorpoUnico(DocumentoReformatarConteudoRequest request) {
        if (request == null) {
            return null;
        }
        if (StringUtils.hasText(request.corpoUnico())) {
            return request;
        }
        String corpoUnico = DocumentoReformatarCorpoUnicoHtml.montar(request);
        return new DocumentoReformatarConteudoRequest(
                request.enderecamento(),
                request.numeroProcesso(),
                request.cidadeEstado(),
                request.data(),
                request.nomePeca(),
                request.preambulo(),
                request.secoes(),
                request.fecho(),
                request.advogadoNome(),
                request.advogadoOab(),
                corpoUnico,
                request.processoId());
    }

    public byte[] gerarPdfFromConteudo(DocumentoReformatarConteudoRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Conteúdo do documento é obrigatório.");
        }
        if (StringUtils.hasText(request.corpoUnico())) {
            DocumentoReformatarConteudoRequest parsed =
                    DocumentoReformatarCorpoUnicoHtml.aplicarCorpoUnico(request, request.corpoUnico());
            String corpoHtml = DocumentoReformatarCorpoUnicoHtml.extrairHtmlParaPdf(request.corpoUnico());
            LocalDate data = parseData(parsed.data());
            String localDataCustom = resolverLocalDataCorpoUnico(
                    request.corpoUnico(), request.cidadeEstado(), data, parsed);
            String cidadeEstado = request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                    ? request.cidadeEstado().trim()
                    : "Anápolis, estado de Goiás";
            DocumentoRenderContext ctx = new DocumentoRenderContext(
                    "",
                    "",
                    cidadeEstado,
                    data,
                    true,
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    localDataCustom,
                    true,
                    advogadoManualOuNull(parsed.advogadoNome(), DocumentoReformatarCorpoUnicoHtml.ADVOGADO_NOME_PADRAO),
                    advogadoManualOuNull(parsed.advogadoOab(), DocumentoReformatarCorpoUnicoHtml.ADVOGADO_OAB_PADRAO),
                    true,
                    corpoHtml,
                    request.processoId());
            return pdfService.gerarPdf(ctx);
        }

        LocalDate data = parseData(request.data());
        String localData = DocumentoLocalDataResolver.resolver(request.cidadeEstado(), request.data(), null, pdfService);

        List<ParagrafoDocumento> preambulo =
                DocumentoParagrafoHtmlUtil.htmlToParagrafos(request.preambulo(), TipoParagrafo.CORPO);
        List<SecaoDocumento> secoes = new ArrayList<>();
        if (request.secoes() != null) {
            for (DocumentoReformatarConteudoRequest.SecaoConteudo s : request.secoes()) {
                if (s == null || !StringUtils.hasText(s.titulo())) {
                    continue;
                }
                TipoTitulo tipoTitulo = TipoTitulo.SUB;
                if (StringUtils.hasText(s.tipoTitulo())) {
                    try {
                        tipoTitulo = TipoTitulo.valueOf(s.tipoTitulo().trim().toUpperCase(Locale.ROOT));
                    } catch (IllegalArgumentException ignored) {
                        // mantém SUB
                    }
                }
                List<ParagrafoDocumento> paragrafos =
                        DocumentoParagrafoHtmlUtil.htmlToParagrafos(s.conteudo(), TipoParagrafo.CORPO);
                secoes.add(new SecaoDocumento(s.titulo().trim(), tipoTitulo, paragrafos));
            }
        }
        List<ParagrafoDocumento> fecho =
                DocumentoParagrafoHtmlUtil.htmlToParagrafos(request.fecho(), TipoParagrafo.FECHO);
        boolean temFecho = !fecho.isEmpty();

        DocumentoRenderContext ctx = new DocumentoRenderContext(
                request.enderecamento() != null ? request.enderecamento().trim() : "",
                request.numeroProcesso(),
                request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                        ? request.cidadeEstado().trim()
                        : "Anápolis, estado de Goiás",
                data,
                true,
                request.nomePeca(),
                null,
                List.of(),
                List.of(),
                preambulo,
                secoes,
                fecho,
                localData,
                temFecho,
                null,
                null,
                false,
                null,
                request.processoId());
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
            String dataIso,
            Long processoId) {
        String enderecamento = StringUtils.hasText(enderecamentoOverride)
                ? enderecamentoOverride.trim()
                : (StringUtils.hasText(parseado.enderecoJuizo()) ? parseado.enderecoJuizo().trim() : "");

        String numeroProcesso = StringUtils.hasText(numeroProcessoOverride)
                ? numeroProcessoOverride.trim()
                : parseado.numeroProcesso();

        String cidade = StringUtils.hasText(cidadeEstado) ? cidadeEstado.trim() : "Anápolis, estado de Goiás";
        LocalDate data = parseData(dataIso);

        boolean temFecho = !parseado.fecho().isEmpty();
        String localData = DocumentoLocalDataResolver.resolver(cidadeEstado, dataIso, parseado.localData(), pdfService);
        List<ParagrafoDocumento> fecho = filtrarFechoSemLocalData(parseado.fecho(), localData);

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
                fecho,
                localData,
                temFecho,
                null,
                null,
                false,
                null,
                processoId);
    }

    private static String advogadoManualOuNull(String valor, String placeholderPadrao) {
        if (!StringUtils.hasText(valor)) {
            return null;
        }
        return valor.trim().equalsIgnoreCase(placeholderPadrao.trim()) ? null : valor.trim();
    }

    private static List<ParagrafoDocumento> filtrarFechoSemLocalData(List<ParagrafoDocumento> fecho, String localDataFinal) {
        if (fecho == null || fecho.isEmpty()) {
            return List.of();
        }
        String ref = localDataFinal != null ? localDataFinal.replaceAll("\\.$", "").trim() : "";
        return fecho.stream()
                .filter(p -> {
                    String t = p.textoPlano();
                    if (!StringUtils.hasText(t)) {
                        return false;
                    }
                    if (DocumentoLocalDataResolver.ehLinhaLocalDataParaRemover(t)) {
                        return false;
                    }
                    if (StringUtils.hasText(ref) && t.trim().equalsIgnoreCase(ref)) {
                        return false;
                    }
                    return true;
                })
                .toList();
    }

    private String resolverLocalDataCorpoUnico(
            String corpoUnicoHtml,
            String cidadeEstadoForm,
            LocalDate data,
            DocumentoReformatarConteudoRequest parsed) {
        String fromCorpo = normalizarLocalDataCustom(
                DocumentoReformatarCorpoUnicoHtml.extrairLocalData(corpoUnicoHtml));
        if (StringUtils.hasText(fromCorpo)) {
            return fromCorpo;
        }
        if (StringUtils.hasText(parsed.cidadeEstado())
                && DocumentoReformatarCorpoUnicoHtml.pareceLinhaLocalData(parsed.cidadeEstado())) {
            String linha = parsed.cidadeEstado().trim();
            if (linha.toLowerCase(Locale.ROOT).contains(" de ")
                    && Pattern.compile("(?i)\\d{1,2}\\s+de\\s+").matcher(linha).find()) {
                return normalizarLocalDataCustom(linha);
            }
            return normalizarLocalDataCustom(pdfService.montarLocalData(linha.replaceAll("\\.$", ""), data));
        }
        String cidade = StringUtils.hasText(cidadeEstadoForm)
                ? cidadeEstadoForm.trim()
                : "Anápolis, estado de Goiás";
        return normalizarLocalDataCustom(pdfService.montarLocalData(cidade, data));
    }

    private static String normalizarLocalDataCustom(String localData) {
        if (!StringUtils.hasText(localData)) {
            return null;
        }
        String t = localData.trim();
        return t.endsWith(".") ? t : t + ".";
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
