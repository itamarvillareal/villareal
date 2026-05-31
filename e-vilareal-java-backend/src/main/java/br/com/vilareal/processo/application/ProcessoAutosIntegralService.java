package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.google.api.services.drive.model.File;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitWidthDestination;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Gera PDF único (autos integral) juntando os PDFs já existentes na pasta {@code Movimentações}
 * do processo no Google Drive — sem consultar o PROJUDI.
 */
@Service
public class ProcessoAutosIntegralService {

    private static final Logger log = LoggerFactory.getLogger(ProcessoAutosIntegralService.class);

    private static final String PASTA_MOVIMENTACOES = "Movimentações";

    /** {@code 0003 Movimentação - Arquivo 01 - Despacho.pdf} */
    private static final Pattern PADRAO_NOME_ARQUIVO = Pattern.compile(
            "^(\\d{1,4})\\s+Movimenta[çc][ãa]o\\s+-\\s+Arquivo\\s+(\\d{1,2})(?:\\s+-\\s+(.+?))?(?:\\.[^.]+)?$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final ProcessoRepository processoRepository;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;

    public ProcessoAutosIntegralService(
            ProcessoRepository processoRepository,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService) {
        this.processoRepository = processoRepository;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
    }

    public record ResultadoAutosIntegral(byte[] pdf, String nomeArquivo, List<String> avisos) {}

    @Transactional(readOnly = true)
    public ResultadoAutosIntegral gerarPdf(String numeroCnjInformado) throws Exception {
        if (!googleDriveService.isConfigurado()) {
            throw new BusinessRuleException("Google Drive não configurado.");
        }
        if (!StringUtils.hasText(numeroCnjInformado)) {
            throw new BusinessRuleException("Informe o número CNJ do processo.");
        }

        ProcessoEntity processo = resolverProcessoPorCnj(numeroCnjInformado.trim());
        String numeroCnj = StringUtils.hasText(processo.getNumeroCnj())
                ? processo.getNumeroCnj().trim()
                : numeroCnjInformado.trim();

        String pastaMovimentacoesId = resolverPastaMovimentacoesId(processo);
        if (!StringUtils.hasText(pastaMovimentacoesId)) {
            throw new ResourceNotFoundException(
                    "Pasta Movimentações não encontrada no Drive para o processo " + numeroCnj + ".");
        }

        List<ArquivoPdfOrdenado> arquivos = listarPdfsOrdenados(pastaMovimentacoesId);
        if (arquivos.isEmpty()) {
            throw new ResourceNotFoundException(
                    "Nenhum PDF encontrado na pasta Movimentações do processo " + numeroCnj + ".");
        }

        List<String> avisos = new ArrayList<>();
        List<byte[]> pdfsValidos = new ArrayList<>();
        List<MarcadorBookmark> marcadores = new ArrayList<>();
        int paginaAtual = 0;
        Integer ultimaMovimentacaoBookmark = null;

        for (ArquivoPdfOrdenado arq : arquivos) {
            byte[] bytes;
            try {
                bytes = googleDriveService.baixarBytesArquivo(arq.fileId());
            } catch (Exception e) {
                avisos.add("Falha ao baixar '" + arq.nome() + "': " + resumirErro(e));
                continue;
            }
            int paginas;
            try {
                paginas = contarPaginasPdf(bytes);
            } catch (Exception e) {
                avisos.add("PDF ignorado (corrompido/criptografado): '" + arq.nome() + "' — " + resumirErro(e));
                continue;
            }
            if (paginas <= 0) {
                avisos.add("PDF ignorado (sem páginas): '" + arq.nome() + "'");
                continue;
            }

            if (arq.seqMov() >= 0 && !Integer.valueOf(arq.seqMov()).equals(ultimaMovimentacaoBookmark)) {
                String rotulo = StringUtils.hasText(arq.rotuloMovimentacao())
                        ? arq.rotuloMovimentacao()
                        : String.format(Locale.ROOT, "Movimentação %04d", arq.seqMov());
                marcadores.add(new MarcadorBookmark(paginaAtual, rotulo));
                ultimaMovimentacaoBookmark = arq.seqMov();
            }

            pdfsValidos.add(bytes);
            paginaAtual += paginas;
        }

        if (pdfsValidos.isEmpty()) {
            throw new BusinessRuleException(
                    "Nenhum PDF válido pôde ser mesclado. Avisos: " + String.join(" | ", avisos));
        }

        byte[] pdf = mesclarPdfsComBookmarks(pdfsValidos, marcadores);
        String nomeArquivo = sanitizarNomeArquivoDownload(numeroCnj + " - Autos.pdf");
        log.info(
                "Autos integral gerado (cnj={}, arquivos={}, paginas={}, avisos={})",
                numeroCnj,
                pdfsValidos.size(),
                paginaAtual,
                avisos.size());
        return new ResultadoAutosIntegral(pdf, nomeArquivo, avisos);
    }

    private ProcessoEntity resolverProcessoPorCnj(String numeroCnjInformado) {
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(numeroCnjInformado);
        if (norm.length() < 7) {
            throw new BusinessRuleException("Número CNJ inválido (mínimo 7 dígitos).");
        }
        List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.isEmpty()) {
            throw new ResourceNotFoundException("Processo não encontrado com CNJ " + numeroCnjInformado + ".");
        }
        if (ids.size() > 1) {
            throw new BusinessRuleException(
                    "Mais de um processo cadastrado com o mesmo CNJ; use o código cliente e proc. interno.");
        }
        return processoRepository
                .findById(ids.getFirst().longValue())
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado."));
    }

    private String resolverPastaMovimentacoesId(ProcessoEntity processo) throws Exception {
        Integer numeroInterno = processo.getNumeroInterno();
        if (numeroInterno == null) {
            return null;
        }
        String codigoCliente = documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo);
        if (!StringUtils.hasText(codigoCliente)) {
            return null;
        }
        DrivePastaProcessoDto pastaDto = documentoDrivePastaService.resolverPastaRaizProcesso(
                googleDriveService, codigoCliente.trim(), numeroInterno);
        if (pastaDto == null || !StringUtils.hasText(pastaDto.pastaId())) {
            return null;
        }
        for (File filho : googleDriveService.listarFilhos(pastaDto.pastaId())) {
            if (googleDriveService.isPasta(filho)
                    && PASTA_MOVIMENTACOES.equalsIgnoreCase(filho.getName().trim())) {
                return filho.getId();
            }
        }
        return null;
    }

    private List<ArquivoPdfOrdenado> listarPdfsOrdenados(String pastaMovimentacoesId) throws Exception {
        List<ArquivoPdfOrdenado> out = new ArrayList<>();
        for (File f : googleDriveService.listarFilhos(pastaMovimentacoesId)) {
            if (googleDriveService.isPasta(f)) {
                continue;
            }
            if (!ehPdf(f)) {
                continue;
            }
            out.add(parseNomeArquivo(f.getId(), f.getName()));
        }
        out.sort(Comparator
                .comparingInt(ArquivoPdfOrdenado::seqMov)
                .thenComparingInt(ArquivoPdfOrdenado::seqArquivo)
                .thenComparing(ArquivoPdfOrdenado::nome, String.CASE_INSENSITIVE_ORDER));
        return out;
    }

    private static boolean ehPdf(File f) {
        if (f == null || !StringUtils.hasText(f.getName())) {
            return false;
        }
        String mime = f.getMimeType();
        if ("application/pdf".equalsIgnoreCase(mime)) {
            return true;
        }
        return f.getName().trim().toLowerCase(Locale.ROOT).endsWith(".pdf");
    }

    private static ArquivoPdfOrdenado parseNomeArquivo(String fileId, String nome) {
        String nomeTrim = nome == null ? "" : nome.trim();
        Matcher m = PADRAO_NOME_ARQUIVO.matcher(nomeTrim);
        if (m.matches()) {
            int seqMov = Integer.parseInt(m.group(1));
            int seqArquivo = Integer.parseInt(m.group(2));
            String rotulo = m.group(3) != null ? m.group(3).trim() : "";
            return new ArquivoPdfOrdenado(fileId, nomeTrim, seqMov, seqArquivo, rotulo);
        }
        return new ArquivoPdfOrdenado(fileId, nomeTrim, Integer.MAX_VALUE, Integer.MAX_VALUE, "");
    }

    private static int contarPaginasPdf(byte[] bytes) throws IOException {
        try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(bytes))) {
            if (doc.isEncrypted()) {
                throw new IOException("PDF criptografado");
            }
            return doc.getNumberOfPages();
        }
    }

    private static byte[] mesclarPdfsComBookmarks(List<byte[]> pdfs, List<MarcadorBookmark> marcadores)
            throws IOException {
        Path tempMerged = Files.createTempFile("autos-integral-", ".pdf");
        try {
            PDFMergerUtility merger = new PDFMergerUtility();
            merger.setDestinationFileName(tempMerged.toString());
            for (byte[] pdf : pdfs) {
                merger.addSource(new RandomAccessReadBuffer(pdf));
            }
            merger.mergeDocuments(IOUtils.createTempFileOnlyStreamCache());

            try (PDDocument merged = Loader.loadPDF(tempMerged.toFile())) {
                adicionarBookmarks(merged, marcadores);
                Path tempOut = Files.createTempFile("autos-integral-out-", ".pdf");
                try {
                    merged.save(tempOut.toFile());
                    return Files.readAllBytes(tempOut);
                } finally {
                    Files.deleteIfExists(tempOut);
                }
            }
        } finally {
            Files.deleteIfExists(tempMerged);
        }
    }

    private static void adicionarBookmarks(PDDocument doc, List<MarcadorBookmark> marcadores) {
        if (marcadores == null || marcadores.isEmpty() || doc.getNumberOfPages() == 0) {
            return;
        }
        PDDocumentOutline outline = new PDDocumentOutline();
        doc.getDocumentCatalog().setDocumentOutline(outline);
        for (MarcadorBookmark marcador : marcadores) {
            if (marcador.pageIndex() < 0 || marcador.pageIndex() >= doc.getNumberOfPages()) {
                continue;
            }
            PDOutlineItem item = new PDOutlineItem();
            item.setTitle(marcador.rotulo());
            PDPageFitWidthDestination dest = new PDPageFitWidthDestination();
            dest.setPage(doc.getPage(marcador.pageIndex()));
            item.setDestination(dest);
            outline.addLast(item);
        }
    }

    private static String resumirErro(Exception e) {
        String msg = e.getMessage();
        if (!StringUtils.hasText(msg)) {
            return e.getClass().getSimpleName();
        }
        return msg.length() > 200 ? msg.substring(0, 200) + "…" : msg;
    }

    static String sanitizarNomeArquivoDownload(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "Autos.pdf";
        }
        return nome.trim().replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ");
    }

    private record ArquivoPdfOrdenado(
            String fileId, String nome, int seqMov, int seqArquivo, String rotuloMovimentacao) {}

    private record MarcadorBookmark(int pageIndex, String rotulo) {}
}
