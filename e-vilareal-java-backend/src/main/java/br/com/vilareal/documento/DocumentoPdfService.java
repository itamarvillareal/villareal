package br.com.vilareal.documento;

import com.openhtmltopdf.extend.FSSupplier;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import javax.imageio.ImageIO;
import java.awt.AlphaComposite;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
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
    private static final float OPACIDADE_MARCA_DAGUA = 0.05f;
    private static final String FONTE_LUCIDA_CALLIGRAPHY = "Lucida Calligraphy";
    private static final String[] CAMINHOS_FONTE_LUCIDA = {
            "fonts/documentos/LucidaCalligraphy.ttf",
            "fonts/documentos/LCALLIG.TTF",
            "fonts/documentos/LCALLIG.ttf",
            "fonts/documentos/Lucida Calligraphy.ttf",
            "fonts/documentos/lucida-calligraphy.ttf"
    };

    private final SpringTemplateEngine templateEngine;

    public DocumentoPdfService(SpringTemplateEngine templateEngine) {
        this.templateEngine = templateEngine;
    }

    public byte[] gerarPeticaoPdf(DocumentoGerarRequest request) {
        return gerarPdf(DocumentoRenderContext.legado(request));
    }

    public byte[] gerarPdf(DocumentoRenderContext ctx) {
        LocalDate data = ctx.data() != null ? ctx.data() : LocalDate.now();
        String cidadeEstado = ctx.cidadeEstado() != null && !ctx.cidadeEstado().isBlank()
                ? ctx.cidadeEstado()
                : "Anápolis, estado de Goiás";
        String localData = StringUtils.hasText(ctx.localDataCustom())
                ? ctx.localDataCustom()
                : montarLocalData(cidadeEstado, data);

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
        return gerarPdfDeTemplate(TEMPLATE_PETICAO, variables);
    }

    public byte[] gerarPdfDeTemplate(String templateName, Map<String, Object> variables) {
        Context context = new Context(LOCALE_PT_BR);
        if (variables != null) {
            variables.forEach(context::setVariable);
        }
        context.setVariable("logoCabecalhoBase64", carregarImagemBase64("static/documentos/logo_cabecalho.jpeg"));
        context.setVariable("marcaDaguaBase64", carregarMarcaDaguaBase64());

        String htmlRenderizado = templateEngine.process(templateName, context);
        return converterHtmlParaPdf(htmlRenderizado);
    }

    public String montarLocalData(String cidadeEstado, LocalDate data) {
        LocalDate d = data != null ? data : LocalDate.now();
        String local = cidadeEstado != null && !cidadeEstado.isBlank()
                ? cidadeEstado
                : "Anápolis, estado de Goiás";
        return local + ", " + formatarDataExtenso(d) + ".";
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

    private String carregarMarcaDaguaBase64() {
        try {
            ClassPathResource resource = new ClassPathResource("static/documentos/marca_dagua.jpeg");
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
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(bytes));
            if (original == null) {
                return carregarImagemBase64("static/documentos/marca_dagua.jpeg");
            }
            BufferedImage faded = new BufferedImage(original.getWidth(), original.getHeight(), BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = faded.createGraphics();
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, OPACIDADE_MARCA_DAGUA));
            g.drawImage(original, 0, 0, null);
            g.dispose();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(faded, "png", out);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (IOException e) {
            return "";
        }
    }

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
