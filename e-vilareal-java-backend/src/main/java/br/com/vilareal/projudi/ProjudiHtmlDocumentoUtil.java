package br.com.vilareal.projudi;

import com.openhtmltopdf.extend.FSSupplier;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Entities;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Envolve/converte fragmentos HTML do PROJUDI antes do upload ao Drive. */
public final class ProjudiHtmlDocumentoUtil {

    private static final String FONTE_DEJAVU_SANS = "DejaVu Sans";
    private static final String CAMINHO_FONTE_DEJAVU = "fonts/DejaVuSans.ttf";

    private static final byte[] PREFIXO_BYTES = (
            "<!DOCTYPE html><html lang=\"pt-br\"><head><meta charset=\"utf-8\"><style>"
                    + "body{font-family:'DejaVu Sans',sans-serif;max-width:800px;margin:24px auto;"
                    + "padding:0 24px;color:#000;background:#fff;line-height:1.4}"
                    + "img{max-width:100%}"
                    + "</style></head><body>")
            .getBytes(StandardCharsets.UTF_8);

    private static final byte[] SUFIXO_BYTES = "</body></html>".getBytes(StandardCharsets.UTF_8);

    private ProjudiHtmlDocumentoUtil() {}

    /** Resultado da preparação de bytes/nome/mime para upload ao Drive. */
    public record PreparacaoUploadDrive(byte[] conteudo, String nomeDrive, String mimeType, String avisoDetalhe) {}

    /**
     * Prepara conteúdo para upload: HTML vira PDF (fallback para HTML embrulhado se a conversão falhar).
     * Demais tipos passam inalterados.
     */
    public static PreparacaoUploadDrive prepararParaUploadDrive(
            byte[] bytes, String nomeDrive, String nomeArquivo, String arquivoTipo) {
        if (bytes == null || bytes.length == 0 || !isHtmlArquivo(nomeArquivo, arquivoTipo)) {
            String mime = mimeTypePorExtensao(extensaoComPonto(nomeDrive));
            return new PreparacaoUploadDrive(bytes, nomeDrive, mime, null);
        }

        byte[] htmlEmbrulhado = envolverFragmentoHtml(bytes);
        try {
            byte[] pdf = converterHtmlEmbrulhadoParaPdf(htmlEmbrulhado);
            return new PreparacaoUploadDrive(
                    pdf, trocarExtensaoParaPdf(nomeDrive), "application/pdf", null);
        } catch (Exception e) {
            String aviso = "conversão HTML→PDF falhou ("
                    + nomeDrive
                    + "), enviado como HTML: "
                    + e.getMessage();
            return new PreparacaoUploadDrive(htmlEmbrulhado, nomeDrive, "text/html", aviso);
        }
    }

    public static boolean isHtmlArquivo(String nomeArquivo, String arquivoTipo) {
        if (isExtensaoHtml(nomeArquivo)) {
            return true;
        }
        if (!StringUtils.hasText(arquivoTipo)) {
            return false;
        }
        String tipo = arquivoTipo.trim().toLowerCase(Locale.ROOT);
        return tipo.contains("html") || "text/html".equals(tipo) || "htm".equals(tipo);
    }

    static byte[] converterHtmlEmbrulhadoParaPdf(byte[] htmlEmbrulhado) throws IOException {
        String html = new String(htmlEmbrulhado, StandardCharsets.UTF_8);
        Document doc = Jsoup.parse(html);
        doc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
        doc.outputSettings().escapeMode(Entities.EscapeMode.xhtml);
        doc.outputSettings().charset(StandardCharsets.UTF_8);
        String xhtml = doc.html();

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            registrarFonteDejaVuSans(builder);
            builder.withHtmlContent(xhtml, null);
            builder.toStream(out);
            builder.run();
            byte[] pdf = out.toByteArray();
            if (pdf.length == 0) {
                throw new IOException("PDF gerado vazio");
            }
            return pdf;
        } catch (RuntimeException e) {
            if (e.getCause() instanceof IOException io) {
                throw io;
            }
            throw e;
        }
    }

    private static void registrarFonteDejaVuSans(PdfRendererBuilder builder) throws IOException {
        ClassPathResource resource = new ClassPathResource(CAMINHO_FONTE_DEJAVU);
        if (!resource.exists()) {
            throw new IOException("Fonte não encontrada: " + CAMINHO_FONTE_DEJAVU);
        }
        FSSupplier<InputStream> supplier = () -> {
            try {
                return resource.getInputStream();
            } catch (IOException e) {
                throw new IllegalStateException("Falha ao carregar " + CAMINHO_FONTE_DEJAVU, e);
            }
        };
        builder.useFont(supplier, FONTE_DEJAVU_SANS);
    }

    private static byte[] envolverFragmentoHtml(byte[] fragmento) {
        byte[] resultado = new byte[PREFIXO_BYTES.length + fragmento.length + SUFIXO_BYTES.length];
        System.arraycopy(PREFIXO_BYTES, 0, resultado, 0, PREFIXO_BYTES.length);
        System.arraycopy(fragmento, 0, resultado, PREFIXO_BYTES.length, fragmento.length);
        System.arraycopy(SUFIXO_BYTES, 0, resultado, PREFIXO_BYTES.length + fragmento.length, SUFIXO_BYTES.length);
        return resultado;
    }

    static String trocarExtensaoParaPdf(String nomeDrive) {
        if (!StringUtils.hasText(nomeDrive)) {
            return "arquivo.pdf";
        }
        String lower = nomeDrive.trim();
        if (lower.endsWith(".html")) {
            return nomeDrive.substring(0, nomeDrive.length() - 5) + ".pdf";
        }
        if (lower.endsWith(".htm")) {
            return nomeDrive.substring(0, nomeDrive.length() - 4) + ".pdf";
        }
        return nomeDrive + ".pdf";
    }

    private static boolean isExtensaoHtml(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return false;
        }
        String lower = nomeArquivo.trim().toLowerCase(Locale.ROOT);
        return lower.endsWith(".html") || lower.endsWith(".htm");
    }

    private static String extensaoComPonto(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return "";
        }
        int ponto = nomeArquivo.lastIndexOf('.');
        if (ponto <= 0 || ponto == nomeArquivo.length() - 1) {
            return "";
        }
        return nomeArquivo.substring(ponto);
    }

    private static String mimeTypePorExtensao(String ext) {
        if (!StringUtils.hasText(ext)) {
            return "application/octet-stream";
        }
        return switch (ext.toLowerCase(Locale.ROOT)) {
            case ".pdf" -> "application/pdf";
            case ".p7s" -> "application/pkcs7-signature";
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".png" -> "image/png";
            case ".html", ".htm" -> "text/html";
            default -> "application/octet-stream";
        };
    }
}
