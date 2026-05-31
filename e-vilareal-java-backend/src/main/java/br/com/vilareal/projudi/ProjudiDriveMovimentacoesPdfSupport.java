package br.com.vilareal.projudi;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.google.api.services.drive.model.File;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Catálogo read-only de PDFs na pasta Movimentações do Drive (compartilhado por diagnóstico e OCR backfill). */
@Component
public class ProjudiDriveMovimentacoesPdfSupport {

    public static final String PASTA_MOVIMENTACOES = "Movimentações";

    private static final Pattern PADRAO_NUMERO_ARQUIVO_DRIVE =
            Pattern.compile("^(\\d{1,4})\\s+Movimenta[çc][ãa]o\\s+-\\s+Arquivo\\b", Pattern.CASE_INSENSITIVE);

    private static final Pattern PADRAO_NOME_ARQUIVO = Pattern.compile(
            "^(\\d{1,4})\\s+Movimenta[çc][ãa]o\\s+-\\s+Arquivo\\s+(\\d{1,2})(?:\\s+-\\s+(.+?))?(?:\\.[^.]+)?$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final ProcessoRepository processoRepository;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;

    public ProjudiDriveMovimentacoesPdfSupport(
            ProcessoRepository processoRepository,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService) {
        this.processoRepository = processoRepository;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
    }

    public Optional<ProcessoEntity> buscarProcessoPorCnj(String cnj) {
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.isEmpty()) {
            return Optional.empty();
        }
        List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.isEmpty()) {
            return Optional.empty();
        }
        return processoRepository.findByIdWithClienteAndPessoa(ids.getFirst().longValue());
    }

    public String resolverPastaMovimentacoesId(ProcessoEntity processo) throws Exception {
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
        return googleDriveService.encontrarPastaExistente(PASTA_MOVIMENTACOES, pastaDto.pastaId());
    }

    public List<PdfMovimentacaoDrive> listarPdfsOrdenados(String pastaMovimentacoesId) throws Exception {
        List<PdfMovimentacaoDrive> out = new ArrayList<>();
        for (File f : googleDriveService.listarFilhos(pastaMovimentacoesId)) {
            if (googleDriveService.isPasta(f) || !ehPdf(f)) {
                continue;
            }
            out.add(parseNomeArquivo(f.getId(), f.getName()));
        }
        out.sort(Comparator
                .comparingInt(PdfMovimentacaoDrive::seqMov)
                .thenComparingInt(PdfMovimentacaoDrive::seqArquivo)
                .thenComparing(PdfMovimentacaoDrive::nome, String.CASE_INSENSITIVE_ORDER));
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

    static PdfMovimentacaoDrive parseNomeArquivo(String fileId, String nome) {
        String nomeTrim = nome == null ? "" : nome.trim();
        Matcher m = PADRAO_NOME_ARQUIVO.matcher(nomeTrim);
        if (m.matches()) {
            return new PdfMovimentacaoDrive(
                    fileId,
                    nomeTrim,
                    Integer.parseInt(m.group(1)),
                    Integer.parseInt(m.group(2)));
        }
        Matcher prefixo = PADRAO_NUMERO_ARQUIVO_DRIVE.matcher(nomeTrim);
        int seqMov = prefixo.find() ? Integer.parseInt(prefixo.group(1)) : Integer.MAX_VALUE;
        return new PdfMovimentacaoDrive(fileId, nomeTrim, seqMov, Integer.MAX_VALUE);
    }

    public record PdfMovimentacaoDrive(String fileId, String nome, int seqMov, int seqArquivo) {}
}
