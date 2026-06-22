package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiDriveMovimentacoesPdfSupport;
import com.google.api.services.drive.model.File;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Consolida PDFs da pasta {@code Movimentações} do processo no Google Drive,
 * ordenados por nome (crescente), sem consultar o PROJUDI.
 */
@Service
public class ProcessoMovimentacoesConsolidarPdfService {

    private static final Logger log = LoggerFactory.getLogger(ProcessoMovimentacoesConsolidarPdfService.class);

    private final ProcessoRepository processoRepository;
    private final GoogleDriveService googleDriveService;
    private final ProjudiDriveMovimentacoesPdfSupport movimentacoesPdfSupport;

    public ProcessoMovimentacoesConsolidarPdfService(
            ProcessoRepository processoRepository,
            GoogleDriveService googleDriveService,
            ProjudiDriveMovimentacoesPdfSupport movimentacoesPdfSupport) {
        this.processoRepository = processoRepository;
        this.googleDriveService = googleDriveService;
        this.movimentacoesPdfSupport = movimentacoesPdfSupport;
    }

    public record ResultadoConsolidado(byte[] pdf, String nomeArquivo, List<String> avisos) {
        public ResultadoConsolidado(byte[] pdf, String nomeArquivo) {
            this(pdf, nomeArquivo, List.of());
        }
    }

    private record PartePdf(String nome, byte[] bytes) {}

    private record ContextoProcesso(ProcessoEntity processo, String pastaMovimentacoesId) {}

    @Transactional(readOnly = true)
    public List<DriveArquivoDto> listarPdfsMovimentacoes(Long processoId) throws Exception {
        if (!googleDriveService.isConfigurado() || processoId == null || processoId <= 0) {
            return List.of();
        }
        ProcessoEntity processo = processoRepository
                .findByIdWithClienteAndPessoa(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado."));
        String pastaMovimentacoesId = movimentacoesPdfSupport.resolverPastaMovimentacoesId(processo);
        if (!StringUtils.hasText(pastaMovimentacoesId)) {
            return List.of();
        }
        List<DriveArquivoDto> out = new ArrayList<>();
        for (File pdf : listarPdfsOrdenadosPorNome(pastaMovimentacoesId)) {
            out.add(mapearPdfParaDto(pdf));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public ResultadoConsolidado gerarPdf(Long processoId) throws Exception {
        ContextoProcesso ctx = carregarContexto(processoId);
        List<File> pdfs = listarPdfsOrdenadosPorNome(ctx.pastaMovimentacoesId());
        if (pdfs.isEmpty()) {
            throw new ResourceNotFoundException(
                    "Nenhum PDF encontrado na pasta Movimentações deste processo.");
        }
        List<String> avisos = new ArrayList<>();
        List<PartePdf> partes = prepararPartesValidas(pdfs, avisos);
        return finalizarConsolidado(ctx.processo(), processoId, partes, avisos);
    }

    @Transactional(readOnly = true)
    public ResultadoConsolidado gerarPdf(Long processoId, List<String> fileIds) throws Exception {
        if (fileIds == null || fileIds.isEmpty()) {
            throw badRequest("Nenhum arquivo selecionado.");
        }
        ContextoProcesso ctx = carregarContexto(processoId);
        Map<String, File> porId = indexarPdfsDaPasta(ctx.pastaMovimentacoesId());
        List<File> selecionados = new ArrayList<>();
        for (String fileId : fileIds) {
            if (!StringUtils.hasText(fileId)) {
                throw badRequest("Identificador de arquivo inválido.");
            }
            String id = fileId.trim();
            File pdf = porId.get(id);
            if (pdf == null) {
                throw badRequest("Arquivo não pertence à pasta Movimentações deste processo: " + id);
            }
            selecionados.add(pdf);
        }
        List<String> avisos = new ArrayList<>();
        List<PartePdf> partes = prepararPartesValidas(selecionados, avisos);
        return finalizarConsolidado(ctx.processo(), processoId, partes, avisos);
    }

    private ContextoProcesso carregarContexto(Long processoId) throws Exception {
        if (!googleDriveService.isConfigurado()) {
            throw new BusinessRuleException("Google Drive não configurado.");
        }
        if (processoId == null || processoId <= 0) {
            throw new BusinessRuleException("ID do processo inválido.");
        }
        ProcessoEntity processo = processoRepository
                .findByIdWithClienteAndPessoa(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado."));
        String pastaMovimentacoesId = movimentacoesPdfSupport.resolverPastaMovimentacoesId(processo);
        if (!StringUtils.hasText(pastaMovimentacoesId)) {
            throw new ResourceNotFoundException(
                    "Pasta Movimentações não encontrada no Drive para este processo.");
        }
        return new ContextoProcesso(processo, pastaMovimentacoesId);
    }

    private Map<String, File> indexarPdfsDaPasta(String pastaMovimentacoesId) throws Exception {
        Map<String, File> porId = new LinkedHashMap<>();
        for (File pdf : listarPdfsOrdenadosPorNome(pastaMovimentacoesId)) {
            if (pdf.getId() != null) {
                porId.put(pdf.getId(), pdf);
            }
        }
        return porId;
    }

    private List<PartePdf> prepararPartesValidas(List<File> arquivos, List<String> avisos) throws Exception {
        List<PartePdf> out = new ArrayList<>();
        for (File pdf : arquivos) {
            String nome = StringUtils.hasText(pdf.getName()) ? pdf.getName().trim() : pdf.getId();
            byte[] bytes;
            try {
                bytes = googleDriveService.baixarBytesArquivo(pdf.getId());
            } catch (Exception e) {
                log.error("Falha ao baixar PDF do Drive (nome={}, id={}): {}", nome, pdf.getId(), e.getMessage());
                avisos.add("Falha ao baixar '" + nome + "': " + resumirErro(e));
                continue;
            }
            try {
                int paginas = contarPaginasPdf(bytes);
                if (paginas <= 0) {
                    avisos.add("PDF ignorado (sem páginas): '" + nome + "'");
                    continue;
                }
            } catch (Exception e) {
                avisos.add("PDF ignorado (corrompido/criptografado): '" + nome + "' — " + resumirErro(e));
                continue;
            }
            out.add(new PartePdf(nome, bytes));
        }
        return out;
    }

    private ResultadoConsolidado finalizarConsolidado(
            ProcessoEntity processo, Long processoId, List<PartePdf> partes, List<String> avisos) throws Exception {
        if (partes.isEmpty()) {
            throw new BusinessRuleException(
                    avisos.isEmpty()
                            ? "Nenhum PDF válido para consolidar."
                            : "Nenhum PDF válido pôde ser mesclado. " + String.join(" | ", avisos));
        }
        List<byte[]> bytesPartes = partes.stream().map(PartePdf::bytes).toList();
        byte[] consolidado;
        try {
            consolidado = mesclarPdfs(bytesPartes);
        } catch (IOException e) {
            log.error("Falha ao mesclar PDFs (processoId={}): {}", processoId, e.getMessage());
            throw new BusinessRuleException("Falha ao mesclar PDFs: " + resumirErro(e));
        }
        String rotulo = StringUtils.hasText(processo.getNumeroCnj())
                ? processo.getNumeroCnj().trim()
                : String.valueOf(processoId);
        String nomeArquivo = ProcessoAutosIntegralService.sanitizarNomeArquivoDownload(
                "Movimentacoes_Consolidado_" + rotulo + ".pdf");
        log.info(
                "PDF Movimentações consolidado (processoId={}, arquivos={}, avisos={}, bytes={})",
                processoId,
                partes.size(),
                avisos.size(),
                consolidado.length);
        return new ResultadoConsolidado(consolidado, nomeArquivo, List.copyOf(avisos));
    }

    private static int contarPaginasPdf(byte[] bytes) throws IOException {
        try (PDDocument doc = Loader.loadPDF(new RandomAccessReadBuffer(bytes))) {
            if (doc.isEncrypted()) {
                throw new IOException("PDF criptografado");
            }
            return doc.getNumberOfPages();
        }
    }

    static DriveArquivoDto mapearPdfParaDto(File f) {
        return new DriveArquivoDto(
                f.getId(),
                f.getName(),
                "arquivo",
                f.getMimeType(),
                f.getSize(),
                f.getModifiedTime() != null ? f.getModifiedTime().toString() : null,
                null,
                null,
                null);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private List<File> listarPdfsOrdenadosPorNome(String pastaMovimentacoesId) throws Exception {
        return googleDriveService.listarPdfsNaPastaOrdenadosPorNome(pastaMovimentacoesId);
    }

    private static byte[] mesclarPdfs(List<byte[]> pdfs) throws IOException {
        Path tempMerged = Files.createTempFile("movimentacoes-consolidado-", ".pdf");
        try {
            PDFMergerUtility merger = new PDFMergerUtility();
            merger.setDestinationFileName(tempMerged.toString());
            for (byte[] pdf : pdfs) {
                merger.addSource(new RandomAccessReadBuffer(pdf));
            }
            merger.mergeDocuments(IOUtils.createTempFileOnlyStreamCache());
            return Files.readAllBytes(tempMerged);
        } finally {
            Files.deleteIfExists(tempMerged);
        }
    }

    private static String resumirErro(Exception e) {
        String msg = e.getMessage();
        if (!StringUtils.hasText(msg)) {
            return e.getClass().getSimpleName();
        }
        return msg.length() > 200 ? msg.substring(0, 200) + "…" : msg;
    }
}
