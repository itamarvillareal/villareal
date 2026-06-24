package br.com.vilareal.documento;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.parse.DocumentoLocalDataResolver;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import com.openhtmltopdf.extend.FSSupplier;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DocumentoPdfService {

    private static final String TEMPLATE_PETICAO = "documentos/peticao-base";
    private static final Locale LOCALE_PT_BR = Locale.forLanguageTag("pt-BR");
    private static final String FONTE_LUCIDA_CALLIGRAPHY = "Lucida Calligraphy";
    private static final String[] CAMINHOS_FONTE_LUCIDA = {
            "fonts/documentos/LucidaCalligraphy.ttf",
            "fonts/documentos/LCALLIG.TTF",
            "fonts/documentos/LCALLIG.ttf",
            "fonts/documentos/Lucida Calligraphy.ttf",
            "fonts/documentos/lucida-calligraphy.ttf"
    };

    private final SpringTemplateEngine templateEngine;
    private final DocumentoTemaResolver temaResolver;

    public DocumentoPdfService(SpringTemplateEngine templateEngine, DocumentoTemaResolver temaResolver) {
        this.templateEngine = templateEngine;
        this.temaResolver = temaResolver;
    }

    public byte[] gerarPeticaoPdf(DocumentoGerarRequest request) {
        return gerarPdf(DocumentoRenderContext.legado(request));
    }

    /** PDF de demonstração com corpo fixo e timbrado explícito (pré-visualização de modelo). */
    public byte[] gerarPeticaoDemonstracaoPdf(TemaDocumento tema) {
        LocalDate data = LocalDate.now();
        Map<String, Object> variables = new HashMap<>();
        variables.put("enderecamento", "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO");
        variables.put("numeroProcesso", "0000000-00.0000.0.00.0000");
        variables.put("modoReformatado", false);
        variables.put("nomePeca", null);
        variables.put(
                "preambulo",
                "<p><strong>PRÉ-VISUALIZAÇÃO DO MODELO</strong>, documento de exemplo gerado a partir "
                        + "das configurações desta tela.</p>");
        variables.put("preambuloParagrafos", List.of());
        variables.put(
                "secoes",
                List.of(new DocumentoGerarRequest.SecaoPeticao(
                        "DO OBJETIVO",
                        "<p>Validação visual do timbrado: cabeçalho, rodapé, nome e OAB do advogado.</p>")));
        variables.put("secoesDocumento", List.of());
        variables.put("fechoParagrafos", List.of());
        variables.put("omitirFechoPadrao", false);
        variables.put("pedidos", List.of("Deferimento."));
        variables.put("localData", montarLocalData("Anápolis, estado de Goiás", data));
        variables.put("modoCorpoUnico", false);
        variables.put("corpoUnicoHtml", null);
        return gerarPdfDeTemplate(TEMPLATE_PETICAO, variables, tema != null ? tema : TemaDocumento.padrao());
    }

    public byte[] gerarPdf(DocumentoRenderContext ctx) {
        LocalDate data = ctx.data() != null ? ctx.data() : LocalDate.now();
        String cidadeEstado = ctx.cidadeEstado() != null && !ctx.cidadeEstado().isBlank()
                ? ctx.cidadeEstado()
                : "Anápolis, estado de Goiás";
        String localData;
        if (StringUtils.hasText(ctx.localDataCustom())) {
            localData = ctx.localDataCustom();
        } else {
            String dataIso = data != null ? data.toString() : null;
            localData = DocumentoLocalDataResolver.resolver(cidadeEstado, dataIso, null, this);
        }
        if (!StringUtils.hasText(localData)) {
            localData = montarLocalData("Anápolis, estado de Goiás", data);
        }

        Map<String, Object> variables = new HashMap<>();
        variables.put("enderecamento", ctx.enderecamento());
        variables.put("numeroProcesso", ctx.numeroProcesso());
        variables.put("modoReformatado", ctx.modoReformatado());
        variables.put("nomePeca", ctx.nomePeca());
        variables.put("preambulo", ctx.preambuloHtml());
        variables.put("preambuloParagrafos", ctx.preambuloParagrafos());
        variables.put("secoes", ctx.secoesLegado());
        variables.put("secoesDocumento", ctx.secoesDocumento());
        variables.put("fechoParagrafos", ctx.fechoParagrafos());
        variables.put("omitirFechoPadrao", ctx.omitirFechoPadrao());
        variables.put("pedidos", ctx.pedidos());
        variables.put("localData", localData);
        if (StringUtils.hasText(ctx.advogadoNome())) {
            variables.put("advogadoNome", ctx.advogadoNome());
        }
        if (StringUtils.hasText(ctx.advogadoOab())) {
            variables.put("advogadoOab", ctx.advogadoOab());
        }
        variables.put("modoCorpoUnico", ctx.modoCorpoUnico());
        variables.put("corpoUnicoHtml", ctx.corpoUnicoHtml());
        TemaDocumento tema = temaResolver == null
                ? TemaDocumento.padrao()
                : temaResolver.resolverPorProcessoId(ctx.processoId());
        return gerarPdfDeTemplate(TEMPLATE_PETICAO, variables, tema);
    }

    /** Usado por {@link DocumentoLocalDataResolver} e testes. */
    public String montarLocalData(String cidadeEstado, LocalDate data) {
        LocalDate d = data != null ? data : LocalDate.now();
        String local = cidadeEstado != null && !cidadeEstado.isBlank()
                ? cidadeEstado
                : "Anápolis, estado de Goiás";
        local = normalizarCidadeEstadoLocal(local);
        return local + ", " + formatarDataExtenso(d) + ".";
    }

    /** «Anápolis, estado de Goiás» — cidade em título, não MAIÚSCULAS (ex.: processo com ANÁPOLIS). */
    public static String normalizarCidadeEstadoLocal(String texto) {
        if (!StringUtils.hasText(texto)) {
            return "Anápolis, estado de Goiás";
        }
        String t = texto.trim();
        String lower = t.toLowerCase(LOCALE_PT_BR);
        int idxEstado = lower.indexOf(", estado de");
        if (idxEstado > 0) {
            String cidade = QualificacaoPessoaUtil.normalizarCidade(t.substring(0, idxEstado).trim());
            return cidade + t.substring(idxEstado);
        }
        return QualificacaoPessoaUtil.normalizarCidade(t.replaceAll("\\.$", "").trim());
    }

    public byte[] gerarPdfDeTemplate(String templateName, Map<String, Object> variables) {
        return gerarPdfDeTemplate(templateName, variables, TemaDocumento.padrao());
    }

    public byte[] gerarPdfDeTemplate(String templateName, Map<String, Object> variables, TemaDocumento tema) {
        Context context = new Context(LOCALE_PT_BR);
        if (variables != null) {
            variables.forEach(context::setVariable);
        }
        aplicarTemaAoContext(context, tema != null ? tema : TemaDocumento.padrao());

        String htmlRenderizado = templateEngine.process(templateName, context);
        return converterHtmlParaPdf(htmlRenderizado);
    }

    /** Injeta logo, rodapé e advogado do timbrado no contexto Thymeleaf. */
    void aplicarTemaAoContext(Context context, TemaDocumento tema) {
        TemaDocumento t = tema != null ? tema : TemaDocumento.padrao();
        String logoBase64 = t.logoCabecalhoBase64Efetivo();
        if (!StringUtils.hasText(logoBase64)) {
            logoBase64 = carregarImagemBase64Obrigatoria(t.logoCabecalhoPathEfetivo());
        }
        context.setVariable("logoCabecalhoBase64", logoBase64);
        context.setVariable("rodapePrimeiraHtml", t.rodapePrimeiraHtmlEfetivo());
        context.setVariable("rodapeCorridoHtml", t.rodapeCorridoHtmlEfetivo());
        if (!context.containsVariable("advogadoNome") || context.getVariable("advogadoNome") == null
                || !StringUtils.hasText(String.valueOf(context.getVariable("advogadoNome")))) {
            context.setVariable("advogadoNome", t.advogadoNomeEfetivo());
        }
        if (!context.containsVariable("advogadoOab") || context.getVariable("advogadoOab") == null
                || !StringUtils.hasText(String.valueOf(context.getVariable("advogadoOab")))) {
            context.setVariable("advogadoOab", t.advogadoOabEfetivo());
        }
    }

    private byte[] converterHtmlParaPdf(String htmlRenderizado) {
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            registrarFonteLucidaCalligraphy(builder);
            builder.withHtmlContent(htmlRenderizado, "/");
            builder.toStream(os);
            builder.run();
            return os.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar PDF do documento", e);
        }
    }

    private void registrarFonteLucidaCalligraphy(PdfRendererBuilder builder) {
        for (String caminho : CAMINHOS_FONTE_LUCIDA) {
            ClassPathResource resource = new ClassPathResource(caminho);
            if (!resource.exists()) {
                continue;
            }
            try {
                FSSupplier<InputStream> supplier = () -> {
                    try {
                        return resource.getInputStream();
                    } catch (IOException e) {
                        throw new IllegalStateException("Falha ao carregar fonte " + caminho, e);
                    }
                };
                builder.useFont(supplier, FONTE_LUCIDA_CALLIGRAPHY);
                return;
            } catch (Exception e) {
                throw new IllegalStateException("Falha ao registrar fonte " + caminho, e);
            }
        }
    }

    private String carregarImagemBase64Obrigatoria(String caminhoClasspath) {
        try {
            ClassPathResource resource = new ClassPathResource(caminhoClasspath);
            if (!resource.exists()) {
                throw new BusinessRuleException("Asset de timbrado não encontrado: " + caminhoClasspath);
            }
            byte[] bytes;
            try (InputStream in = resource.getInputStream()) {
                bytes = in.readAllBytes();
            }
            if (bytes.length == 0) {
                throw new BusinessRuleException("Asset de timbrado vazio: " + caminhoClasspath);
            }
            String mime = detectarMimeImagem(bytes);
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (BusinessRuleException e) {
            throw e;
        } catch (IOException e) {
            throw new BusinessRuleException("Falha ao carregar asset de timbrado: " + caminhoClasspath + " — " + e.getMessage());
        }
    }

    /** @deprecated uso interno legado; preferir {@link #carregarImagemBase64Obrigatoria(String)} */
    @Deprecated
    private String carregarImagemBase64(String caminhoClasspath) {
        try {
            ClassPathResource resource = new ClassPathResource(caminhoClasspath);
            if (!resource.exists()) {
                return "";
            }
            byte[] bytes;
            try (InputStream in = resource.getInputStream()) {
                bytes = in.readAllBytes();
            }
            if (bytes.length == 0) {
                return "";
            }
            String mime = detectarMimeImagem(bytes);
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            return "";
        }
    }

    private static String detectarMimeImagem(byte[] bytes) {
        if (bytes.length >= 8
                && bytes[0] == (byte) 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47) {
            return "image/png";
        }
        if (bytes.length >= 3 && bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) {
            return "image/jpeg";
        }
        if (bytes.length >= 6
                && bytes[0] == 'G'
                && bytes[1] == 'I'
                && bytes[2] == 'F'
                && bytes[3] == '8') {
            return "image/gif";
        }
        return "image/jpeg";
    }

    private String formatarDataExtenso(LocalDate data) {
        DateTimeFormatter formatter =
                DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", LOCALE_PT_BR);
        return data.format(formatter);
    }
}
