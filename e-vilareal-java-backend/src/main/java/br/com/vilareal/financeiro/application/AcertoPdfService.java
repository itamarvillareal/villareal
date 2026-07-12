package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Relatório do acerto do cliente arquivado no fechamento (Etapa 5b): visão do cliente
 * (só {@code visivel_cliente}, usa {@code valor_cliente} quando preenchido) com saldo acumulado
 * fechando no saldo final — formato do PDF de referência de dez/2023. Mesmo padrão de
 * armazenamento da prestação de contas: {storage}/acertos/{id}/acerto.pdf.
 */
@Service
public class AcertoPdfService {

    private static final float MARGIN = 40f;
    private static final float LINE = 12f;
    private static final DateTimeFormatter FMT_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final Path storageRoot;

    public AcertoPdfService(
            @Value("${vilareal.pagamentos.storage-dir:${java.io.tmpdir}/vilareal-pagamentos}") String storageDir) {
        this.storageRoot = Path.of(storageDir).toAbsolutePath().normalize();
    }

    public String gerarESalvar(
            AcertoFechamentoEntity acerto,
            String clienteNome,
            String codigoCliente,
            List<LancamentoFinanceiroEntity> lancamentosVisaoCliente,
            String nomeUsuario)
            throws IOException {
        Path dir = storageRoot.resolve("acertos").resolve(String.valueOf(acerto.getId())).normalize();
        if (!dir.startsWith(storageRoot)) {
            throw new IOException("Caminho inválido.");
        }
        Files.createDirectories(dir);
        Path dest = dir.resolve("acerto.pdf").normalize();

        try (PDDocument doc = new PDDocument()) {
            PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            float y = page.getMediaBox().getHeight() - MARGIN;
            PDPageContentStream cs = new PDPageContentStream(doc, page);

            y = escreverLinha(cs, fontBold, 15, MARGIN, y, "Villa Real — Acerto do Cliente");
            y = escreverLinha(cs, font, 10, MARGIN, y,
                    "Cliente: " + nvl(clienteNome) + " — Código: " + nvl(codigoCliente));
            String periodo = "Período: "
                    + (acerto.getPeriodoInicio() != null ? acerto.getPeriodoInicio().format(FMT_DATA) : "início")
                    + " a "
                    + (acerto.getPeriodoFim() != null ? acerto.getPeriodoFim().format(FMT_DATA) : "hoje");
            y = escreverLinha(cs, font, 10, MARGIN, y, periodo + " — Conta " + acerto.getNumeroBanco());
            y -= LINE * 0.5f;
            y = escreverLinha(cs, fontBold, 8, MARGIN, y,
                    "Data       | Nº lançamento        | Proc  | Descrição                                        | Valor         | Saldo");

            BigDecimal saldo = BigDecimal.ZERO;
            for (LancamentoFinanceiroEntity l : lancamentosVisaoCliente) {
                if (y < 60) {
                    cs.close();
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    y = page.getMediaBox().getHeight() - MARGIN;
                }
                BigDecimal valor = l.getValorCliente() != null ? l.getValorCliente() : l.getValor();
                BigDecimal assinado = l.getNatureza() == NaturezaLancamento.DEBITO ? valor.negate() : valor;
                saldo = saldo.add(assinado);
                String proc = l.getProcesso() != null && l.getProcesso().getNumeroInterno() != null
                        ? String.valueOf(l.getProcesso().getNumeroInterno())
                        : "0";
                String linha = String.format(
                        "%s | %s | %s | %s | %s | %s",
                        l.getDataLancamento() != null ? l.getDataLancamento().format(FMT_DATA) : "—",
                        pad(nvl(l.getNumeroLancamento()), 20),
                        pad(proc, 5),
                        pad(nvl(l.getDescricao()), 48),
                        pad(fmtMoeda(assinado), 13),
                        fmtMoeda(saldo));
                y = escreverLinha(cs, font, 7.5f, MARGIN, y, linha);
            }

            y -= LINE * 0.5f;
            y = escreverLinha(cs, fontBold, 11, MARGIN, y, "Saldo final: " + fmtMoeda(saldo));
            String legenda;
            // Convenção da conta de acerto: crédito = devido ao escritório; débito = devido ao cliente.
            if (saldo.abs().compareTo(new BigDecimal("0.005")) < 0) {
                legenda = "Acerto zerado.";
            } else if (saldo.signum() > 0) {
                legenda = "Saldo a favor do escritório.";
            } else {
                legenda = "Saldo a favor do cliente.";
            }
            y = escreverLinha(cs, font, 10, MARGIN, y, legenda);
            y -= LINE * 0.5f;
            escreverLinha(cs, font, 8, MARGIN, y,
                    "Gerado em " + LocalDateTime.now().format(FMT_DATA_HORA) + " por " + nvl(nomeUsuario));
            cs.close();
            doc.save(dest.toFile());
        }
        return "acertos/" + acerto.getId() + "/acerto.pdf";
    }

    public Path resolverArquivo(String rel) {
        if (rel == null || rel.isBlank()) {
            return null;
        }
        Path p = storageRoot.resolve(rel).normalize();
        if (!p.startsWith(storageRoot)) {
            return null;
        }
        return Files.isReadable(p) ? p : null;
    }

    private static float escreverLinha(
            PDPageContentStream cs, PDType1Font font, float size, float x, float y, String text)
            throws IOException {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(sanitize(text));
        cs.endText();
        return y - LINE;
    }

    /** Standard14 usa WinAnsi: remove caracteres fora do Latin-1 para não quebrar o showText. */
    private static String sanitize(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            if (c == '\t' || c == '\r' || c == '\n') {
                sb.append(' ');
            } else if (c < 32 || c > 255) {
                sb.append('?');
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    private static String pad(String s, int width) {
        String t = s.length() > width ? s.substring(0, width - 1) + "…" : s;
        return String.format("%-" + width + "s", t);
    }

    private static String nvl(String s) {
        return s != null ? s : "";
    }

    private static String fmtMoeda(BigDecimal v) {
        if (v == null) {
            return "R$ 0,00";
        }
        return String.format("R$ %,.2f", v).replace(',', 'X').replace('.', ',').replace('X', '.');
    }
}
