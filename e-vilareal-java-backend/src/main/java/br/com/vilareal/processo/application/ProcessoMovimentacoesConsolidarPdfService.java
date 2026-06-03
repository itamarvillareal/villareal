package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiDriveMovimentacoesPdfSupport;
import com.google.api.services.drive.model.File;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
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

    public record ResultadoConsolidado(byte[] pdf, String nomeArquivo) {}

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
        List<byte[]> partes = baixarPartesPorArquivos(pdfs);
        return finalizarConsolidado(ctx.processo(), processoId, partes, pdfs.size());
    }

    @Transactional(readOnly = true)
    public ResultadoConsolidado gerarPdf(Long processoId, List<String> fileIds) throws Exception {
        if (fileIds == null || fileIds.isEmpty()) {
            throw badRequest("Nenhum arquivo selecionado.");
        }
        ContextoProcesso ctx = carregarContexto(processoId);
        Map<String, File> porId = indexarPdfsDaPasta(ctx.pastaMovimentacoesId());
        List<byte[]> partes = new ArrayList<>();
        for (String fileId : fileIds) {
            if (!StringUtils.hasText(fileId)) {
                throw badRequest("Identificador de arquivo inválido.");
            }
            String id = fileId.trim();
            File pdf = porId.get(id);
            if (pdf == null) {
                throw badRequest("Arquivo não pertence à pasta Movimentações deste processo: " + id);
            }
            try {
                partes.add(googleDriveService.baixarBytesArquivo(id));
            } catch (Exception e) {
                log.error("Falha ao baixar PDF do Drive (nome={}, id={}): {}", pdf.getName(), id, e.getMessage());
                throw new BusinessRuleException(
                        "Falha ao baixar o arquivo '" + pdf.getName() + "': " + resumirErro(e));
            }
        }
        return finalizarConsolidado(ctx.processo(), processoId, partes, fileIds.size());
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

    private List<byte[]> baixarPartesPorArquivos(List<File> pdfs) throws Exception {
        List<byte[]> partes = new ArrayList<>();
        for (File pdf : pdfs) {
            try {
                partes.add(googleDriveService.baixarBytesArquivo(pdf.getId()));
            } catch (Exception e) {
                log.error("Falha ao baixar PDF do Drive (nome={}, id={}): {}", pdf.getName(), pdf.getId(), e.getMessage());
                throw new BusinessRuleException(
                        "Falha ao baixar o arquivo '" + pdf.getName() + "': " + resumirErro(e));
            }
        }
        return partes;
    }

    private ResultadoConsolidado finalizarConsolidado(
            ProcessoEntity processo, Long processoId, List<byte[]> partes, int qtdArquivos) throws Exception {
        byte[] consolidado = mesclarPdfs(partes);
        String rotulo = StringUtils.hasText(processo.getNumeroCnj())
                ? processo.getNumeroCnj().trim()
                : String.valueOf(processoId);
        String nomeArquivo = ProcessoAutosIntegralService.sanitizarNomeArquivoDownload(
                "Movimentacoes_Consolidado_" + rotulo + ".pdf");
        log.info(
                "PDF Movimentações consolidado (processoId={}, arquivos={}, bytes={})",
                processoId,
                qtdArquivos,
                consolidado.length);
        return new ResultadoConsolidado(consolidado, nomeArquivo);
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
