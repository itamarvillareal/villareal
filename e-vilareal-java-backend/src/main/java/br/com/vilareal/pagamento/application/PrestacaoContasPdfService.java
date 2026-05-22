package br.com.vilareal.pagamento.application;

import br.com.vilareal.pagamento.api.dto.prestacao.PrestacaoContasGrupoImovelDetailDto;
import br.com.vilareal.pagamento.api.dto.prestacao.PrestacaoContasPagamentoItemDto;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PrestacaoContasEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
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

@Service
public class PrestacaoContasPdfService {

    private static final float MARGIN = 50f;
    private static final float LINE = 14f;
    private static final DateTimeFormatter FMT_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final Path storageRoot;

    public PrestacaoContasPdfService(
            @Value("${vilareal.pagamentos.storage-dir:${java.io.tmpdir}/vilareal-pagamentos}") String storageDir) {
        this.storageRoot = Path.of(storageDir).toAbsolutePath().normalize();
    }

    public String gerarESalvar(
            PrestacaoContasEntity prestacao,
            List<PrestacaoContasGrupoImovelDetailDto> grupos,
            String nomeUsuario)
            throws IOException {
        Path dir = storageRoot.resolve("prestacoes").resolve(String.valueOf(prestacao.getId())).normalize();
        if (!dir.startsWith(storageRoot)) {
            throw new IOException("Caminho inválido.");
        }
        Files.createDirectories(dir);
        Path dest = dir.resolve("prestacao.pdf").normalize();
        if (!dest.startsWith(dir)) {
            throw new IOException("Nome de arquivo inválido.");
        }
        try (PDDocument doc = new PDDocument()) {
            PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            float y = page.getMediaBox().getHeight() - MARGIN;
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            y = escreverLinha(cs, fontBold, 16, MARGIN, y, "Villa Real — Prestação de Contas");
            y -= LINE;
            ClienteEntity cli = prestacao.getCliente();
            PessoaEntity pessoa = cli != null ? cli.getPessoa() : null;
            String nome = pessoa != null ? nvl(pessoa.getNome()) : nvl(cli != null ? cli.getNomeReferencia() : "");
            String docPessoa = pessoa != null ? nvl(pessoa.getCpf()) : nvl(cli != null ? cli.getDocumentoReferencia() : "");
            y = escreverLinha(cs, font, 11, MARGIN, y, "Cliente: " + nome + " — CPF/CNPJ: " + docPessoa);
            y = escreverLinha(
                    cs,
                    font,
                    11,
                    MARGIN,
                    y,
                    "Código cliente: " + (cli != null ? nvl(cli.getCodigoCliente()) : ""));
            y = escreverLinha(
                    cs,
                    font,
                    11,
                    MARGIN,
                    y,
                    "Período: "
                            + fmt(prestacao.getPeriodoInicio())
                            + " a "
                            + fmt(prestacao.getPeriodoFim()));
            y -= LINE * 0.5f;

            for (PrestacaoContasGrupoImovelDetailDto grupo : grupos) {
                if (y < 120) {
                    cs.close();
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    y = page.getMediaBox().getHeight() - MARGIN;
                }
                String tituloImovel = tituloImovel(grupo);
                y = escreverLinha(cs, fontBold, 12, MARGIN, y, tituloImovel);
                y = escreverLinha(
                        cs,
                        fontBold,
                        9,
                        MARGIN,
                        y,
                        "Data Pgto | Categoria | Descrição | Mês Ref | Boleto | Pago | Dif.");
                for (PrestacaoContasPagamentoItemDto pg : grupo.getPagamentos()) {
                    if (y < 80) {
                        cs.close();
                        page = new PDPage(PDRectangle.A4);
                        doc.addPage(page);
                        cs = new PDPageContentStream(doc, page);
                        y = page.getMediaBox().getHeight() - MARGIN;
                    }
                    String linha = String.format(
                            "%s | %s | %s | %s | %s | %s | %s",
                            fmt(pg.getDataPagamentoEfetivo() != null ? pg.getDataPagamentoEfetivo() : pg.getDataVencimento()),
                            trunc(nvl(pg.getCategoria()), 10),
                            trunc(nvl(pg.getDescricao()), 28),
                            trunc(nvl(pg.getMesReferencia()), 7),
                            fmtMoeda(pg.getValor()),
                            fmtMoeda(pg.getValorPagoBanco() != null ? pg.getValorPagoBanco() : pg.getValor()),
                            fmtMoeda(pg.getValorDiferenca()));
                    y = escreverLinha(cs, font, 8, MARGIN, y, linha);
                }
                y = escreverLinha(
                        cs,
                        fontBold,
                        10,
                        MARGIN,
                        y,
                        "Subtotal imóvel: " + fmtMoeda(grupo.getSubtotal()));
                y -= LINE * 0.3f;
            }

            if (y < 140) {
                cs.close();
                page = new PDPage(PDRectangle.A4);
                doc.addPage(page);
                cs = new PDPageContentStream(doc, page);
                y = page.getMediaBox().getHeight() - MARGIN;
            }
            y -= LINE;
            y = escreverLinha(
                    cs, fontBold, 11, MARGIN, y, "Total de pagamentos: " + fmtMoeda(prestacao.getValorTotalPagamentos()));
            if (prestacao.getTaxaAdministracaoPercentual() != null
                    && prestacao.getTaxaAdministracaoValor() != null) {
                y = escreverLinha(
                        cs,
                        font,
                        11,
                        MARGIN,
                        y,
                        "Taxa de administração: "
                                + prestacao.getTaxaAdministracaoPercentual().stripTrailingZeros().toPlainString()
                                + "% = "
                                + fmtMoeda(prestacao.getTaxaAdministracaoValor()));
            }
            y = escreverLinha(cs, fontBold, 11, MARGIN, y, "Valor líquido: " + fmtMoeda(prestacao.getValorLiquido()));
            if (prestacao.getObservacoes() != null && !prestacao.getObservacoes().isBlank()) {
                y -= LINE * 0.3f;
                y = escreverLinha(cs, font, 10, MARGIN, y, "Observações: " + prestacao.getObservacoes().trim());
            }
            y -= LINE;
            y = escreverLinha(
                    cs,
                    font,
                    9,
                    MARGIN,
                    y,
                    "Gerado em " + LocalDateTime.now().format(FMT_DATA_HORA) + " por " + nvl(nomeUsuario));
            cs.close();
            doc.save(dest.toFile());
        }
        return "prestacoes/" + prestacao.getId() + "/prestacao.pdf";
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

    private static String tituloImovel(PrestacaoContasGrupoImovelDetailDto grupo) {
        if (grupo.getImovel() == null || grupo.getImovel().getId() == null) {
            return "Imóvel: Sem imóvel vinculado";
        }
        return "Imóvel: "
                + nvl(grupo.getImovel().getNumeroPlanilha())
                + " — "
                + trunc(nvl(grupo.getImovel().getEndereco()), 60);
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

    private static String sanitize(String s) {
        if (s == null) return "";
        return s.replace('\t', ' ').replace('\r', ' ').replace('\n', ' ');
    }

    private static String trunc(String s, int max) {
        if (s.length() <= max) return s;
        return s.substring(0, max - 1) + "…";
    }

    private static String nvl(String s) {
        return s != null ? s : "";
    }

    private static String fmt(java.time.LocalDate d) {
        return d != null ? d.format(FMT_DATA) : "—";
    }

    private static String fmtMoeda(BigDecimal v) {
        if (v == null) return "R$ 0,00";
        return String.format("R$ %,.2f", v).replace(',', 'X').replace('.', ',').replace('X', '.');
    }
}
