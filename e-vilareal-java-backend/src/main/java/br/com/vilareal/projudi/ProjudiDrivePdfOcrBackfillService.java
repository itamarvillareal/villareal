package br.com.vilareal.projudi;

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.OcrService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** TEMP — backfill OCR (--skip-text ou --redo-ocr) em todos os PDFs da pasta Movimentações (Drive only). */
@Service
public class ProjudiDrivePdfOcrBackfillService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiDrivePdfOcrBackfillService.class);

    private final ProjudiDriveMovimentacoesPdfSupport pdfSupport;
    private final GoogleDriveService googleDriveService;
    private final OcrService ocrService;
    private final ProcessoRepository processoRepository;
    private final PublicacaoRepository publicacaoRepository;

    public ProjudiDrivePdfOcrBackfillService(
            ProjudiDriveMovimentacoesPdfSupport pdfSupport,
            GoogleDriveService googleDriveService,
            OcrService ocrService,
            ProcessoRepository processoRepository,
            PublicacaoRepository publicacaoRepository) {
        this.pdfSupport = pdfSupport;
        this.googleDriveService = googleDriveService;
        this.ocrService = ocrService;
        this.processoRepository = processoRepository;
        this.publicacaoRepository = publicacaoRepository;
    }

    public Map<String, Object> executar(List<String> cnjs, boolean todos, int limite, boolean redoOcr)
            throws Exception {
        List<String> alvos = resolverCnjsAlvo(cnjs, todos, limite);
        List<Map<String, Object>> relatorios = new ArrayList<>();
        int totalVerificados = 0;
        int totalRegravados = 0;
        int totalSemMudanca = 0;
        int totalErros = 0;

        for (String cnj : alvos) {
            Map<String, Object> rel = processarCnj(cnj, redoOcr);
            relatorios.add(rel);
            totalVerificados += (int) rel.getOrDefault("verificados", 0);
            totalRegravados += (int) rel.getOrDefault("regravados", 0);
            totalSemMudanca += (int) rel.getOrDefault("semMudanca", 0);
            totalErros += (int) rel.getOrDefault("erros", 0);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("redoOcr", redoOcr);
        out.put("processos", relatorios.size());
        out.put("verificados", totalVerificados);
        out.put("regravados", totalRegravados);
        out.put("semMudanca", totalSemMudanca);
        out.put("erros", totalErros);
        out.put("relatorios", relatorios);
        return out;
    }

    private List<String> resolverCnjsAlvo(List<String> cnjs, boolean todos, int limite) {
        Set<String> out = new LinkedHashSet<>();
        if (cnjs != null) {
            for (String cnj : cnjs) {
                if (StringUtils.hasText(cnj)) {
                    out.add(cnj.trim());
                }
            }
        }
        if (!out.isEmpty()) {
            return List.copyOf(out);
        }
        if (!todos) {
            throw new IllegalArgumentException(
                    "Informe ao menos um parâmetro cnj=… ou todos=true para varrer processos PROJUDI.");
        }
        int max = limite > 0 ? limite : 50;
        List<Long> ids = publicacaoRepository.findDistinctProcessoIdsComPublicacaoProjudiCnjCompleto();
        for (Long id : ids.stream().limit(max).toList()) {
            processoRepository.findById(id).ifPresent(p -> {
                if (StringUtils.hasText(p.getNumeroCnj())) {
                    out.add(p.getNumeroCnj().trim());
                }
            });
        }
        return List.copyOf(out);
    }

    private Map<String, Object> processarCnj(String cnj, boolean redoOcr) throws Exception {
        Map<String, Object> rel = new LinkedHashMap<>();
        rel.put("cnj", cnj);
        rel.put("redoOcr", redoOcr);
        rel.put("verificados", 0);
        rel.put("regravados", 0);
        rel.put("semMudanca", 0);
        rel.put("erros", 0);
        List<Map<String, Object>> arquivos = new ArrayList<>();
        rel.put("arquivos", arquivos);

        ProcessoEntity processo = pdfSupport.buscarProcessoPorCnj(cnj).orElse(null);
        if (processo == null) {
            rel.put("erro", "processo não encontrado no cadastro local");
            return rel;
        }
        String pastaId = pdfSupport.resolverPastaMovimentacoesId(processo);
        if (!StringUtils.hasText(pastaId)) {
            rel.put("erro", "pasta Movimentações não encontrada no Drive");
            return rel;
        }

        List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> pdfs =
                pdfSupport.listarPdfsOrdenados(pastaId);
        int verificados = 0;
        int regravados = 0;
        int semMudanca = 0;
        int erros = 0;

        for (var pdf : pdfs) {
            verificados++;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("nomeArquivo", pdf.nome());
            item.put("paginasOcr", 0);
            item.put("regravado", false);
            item.put("erro", null);
            arquivos.add(item);

            try {
                byte[] bytes = googleDriveService.baixarBytesArquivo(pdf.fileId());
                log.info("OCR backfill (redoOcr={}): cnj={} arquivo={}", redoOcr, cnj, pdf.nome());
                OcrService.ResultadoBackfill resultado = ocrService.processarPdfBackfill(bytes, redoOcr);
                item.put("paginasOcr", resultado.paginasOcr());

                if (resultado.erro() != null) {
                    erros++;
                    item.put("erro", resultado.erro());
                    log.warn("OCR backfill falhou (cnj={}, arquivo={}): {}",
                            cnj, pdf.nome(), resultado.erro());
                    continue;
                }
                if (!resultado.deveRegravar()) {
                    semMudanca++;
                    continue;
                }
                googleDriveService.atualizarConteudoArquivo(
                        pdf.fileId(), resultado.pdfPesquisavel(), "application/pdf");
                regravados++;
                item.put("regravado", true);
            } catch (Exception e) {
                erros++;
                item.put("erro", e.getMessage());
                log.warn("OCR backfill exceção (cnj={}, arquivo={}): {}",
                        cnj, pdf.nome(), e.getMessage());
            }
        }

        rel.put("verificados", verificados);
        rel.put("regravados", regravados);
        rel.put("semMudanca", semMudanca);
        rel.put("erros", erros);
        return rel;
    }
}
