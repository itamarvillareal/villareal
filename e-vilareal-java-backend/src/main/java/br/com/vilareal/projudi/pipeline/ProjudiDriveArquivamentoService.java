package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.OcrService;
import br.com.vilareal.processo.application.rag.RagArquivoDriveEnviado;
import br.com.vilareal.processo.application.rag.RagIndexacaoService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiHtmlDocumentoUtil;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTextoUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Resolução da pasta Movimentações e upload progressivo de arquivos PROJUDI no Google Drive.
 */
@Component
public class ProjudiDriveArquivamentoService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiDriveArquivamentoService.class);

    static final String PASTA_MOVIMENTACOES = "Movimentações";

    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;
    private final OcrService ocrService;

    public ProjudiDriveArquivamentoService(
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService,
            OcrService ocrService) {
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
        this.ocrService = ocrService;
    }

    public String resolverPastaMovimentacoesId(
            ProcessoEntity processo, String numeroCnj, List<String> detalhes) throws Exception {
        Integer numeroInterno = processo.getNumeroInterno();
        if (numeroInterno == null) {
            detalhes.add(numeroCnj + " | AVISO Drive: sem numeroInterno.");
            return null;
        }
        String codigoCliente = documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo);
        if (!StringUtils.hasText(codigoCliente)) {
            detalhes.add(numeroCnj + " | AVISO Drive: codigoCliente não resolvido.");
            return null;
        }
        DrivePastaProcessoDto pastaDto = documentoDrivePastaService.resolverPastaRaizProcesso(
                googleDriveService, codigoCliente.trim(), numeroInterno);
        if (pastaDto == null || !StringUtils.hasText(pastaDto.pastaId())) {
            detalhes.add(numeroCnj + " | AVISO Drive: pasta-folha não resolvida.");
            return null;
        }
        return googleDriveService.encontrarOuCriarPastaPublic(PASTA_MOVIMENTACOES, pastaDto.pastaId());
    }

    public int enviarArquivosMovimentacaoAoDrive(
            ProcessoEntity processo,
            String numeroCnj,
            ProjudiTeorService.MovimentacaoProjudi mov,
            List<ProjudiTeorService.ArquivoTeor> arquivos,
            String nomes,
            List<String> detalhes) {
        try {
            String pastaId = resolverPastaMovimentacoesId(processo, numeroCnj, detalhes);
            return enviarArquivosMovimentacaoAoDrive(
                    processo, numeroCnj, mov, arquivos, nomes, pastaId, detalhes);
        } catch (Exception e) {
            detalhes.add(numeroCnj + " | mov " + mov.numero() + " | ERRO Drive: " + e.getMessage());
            return 0;
        }
    }

    /** @return quantidade de arquivos efetivamente enviados ao Drive nesta movimentação */
    public int enviarArquivosMovimentacaoAoDrive(
            ProcessoEntity processo,
            String numeroCnj,
            ProjudiTeorService.MovimentacaoProjudi mov,
            List<ProjudiTeorService.ArquivoTeor> arquivos,
            String nomes,
            String pastaMovimentacoesId,
            List<String> detalhes) {
        return enviarArquivosMovimentacaoAoDrive(
                processo, numeroCnj, mov, arquivos, nomes, pastaMovimentacoesId, detalhes, null);
    }

    /**
     * @param coletorRag quando não nulo, recebe metadados dos arquivos novos enviados (indexação RAG).
     */
    public int enviarArquivosMovimentacaoAoDrive(
            ProcessoEntity processo,
            String numeroCnj,
            ProjudiTeorService.MovimentacaoProjudi mov,
            List<ProjudiTeorService.ArquivoTeor> arquivos,
            String nomes,
            String pastaMovimentacoesId,
            List<String> detalhes,
            List<RagArquivoDriveEnviado> coletorRag) {
        String prefixo = numeroCnj + " | mov " + mov.numero() + " [" + mov.tipo() + "] "
                + mov.dataHora() + " -> " + arquivos.size() + " arquivo(s): " + nomes;

        if (pastaMovimentacoesId == null) {
            return 0;
        }

        try {
            int seqMov = parseNumeroMov(mov.numero());
            List<String> uploads = new ArrayList<>();
            for (int i = 0; i < arquivos.size(); i++) {
                ProjudiTeorService.ArquivoTeor arquivo = arquivos.get(i);
                String ext = extensaoComPonto(arquivo.nomeArquivo());
                String nomeDrive = ProjudiTextoUtil.montarNomeArquivoMovimentacaoDrive(
                        seqMov, i + 1, ext, mov);
                ProjudiHtmlDocumentoUtil.PreparacaoUploadDrive prep =
                        ProjudiHtmlDocumentoUtil.prepararParaUploadDrive(
                                arquivo.conteudo(), nomeDrive, arquivo.nomeArquivo(), arquivo.arquivoTipo());
                if (googleDriveService.existeArquivoComNomeNaPasta(pastaMovimentacoesId, prep.nomeDrive())) {
                    detalhes.add("já existe no Drive, pulado: " + prep.nomeDrive());
                    continue;
                }
                if (prep.avisoDetalhe() != null) {
                    detalhes.add(prep.avisoDetalhe());
                }
                byte[] conteudoUpload = prep.conteudo();
                String mimeUpload = prep.mimeType();
                boolean ehPdf = (mimeUpload != null && mimeUpload.toLowerCase(Locale.ROOT).contains("pdf"))
                        || prep.nomeDrive().toLowerCase(Locale.ROOT).endsWith(".pdf");
                if (ehPdf) {
                    try {
                        OcrService.ResultadoOcr ocr = ocrService.processarPdfSeNecessario(conteudoUpload);
                        if (ocr.ocrAplicado()) {
                            conteudoUpload = ocr.pdfPesquisavel();
                            mimeUpload = "application/pdf";
                            detalhes.add("OCR aplicado antes do upload: " + prep.nomeDrive());
                        } else if (ocr.erro() != null) {
                            log.warn(
                                    "OCR ignorado, upload do PDF original (cnj={}, arquivo={}): {}",
                                    numeroCnj, prep.nomeDrive(), ocr.erro());
                        }
                    } catch (Exception ocrEx) {
                        log.warn(
                                "OCR falhou, upload do PDF original (cnj={}, arquivo={}): {}",
                                numeroCnj, prep.nomeDrive(), ocrEx.getMessage());
                    }
                }
                var uploadDto = googleDriveService.uploadArquivo(
                        conteudoUpload, prep.nomeDrive(), mimeUpload, pastaMovimentacoesId);
                if (uploadDto != null) {
                    uploads.add(prep.nomeDrive());
                    if (coletorRag != null && StringUtils.hasText(uploadDto.id())) {
                        coletorRag.add(new RagArquivoDriveEnviado(
                                uploadDto.id(),
                                prep.nomeDrive(),
                                RagIndexacaoService.normalizarTipoPeca(mov.tipo()),
                                RagIndexacaoService.extrairDataMovIso(mov.dataHora()),
                                mov.idMovimentacaoArquivo()));
                    }
                } else {
                    detalhes.add(prefixo + " | ERRO Drive: falha ao enviar " + prep.nomeDrive()
                            + " (verifique permissões/quota do Google Drive).");
                }
            }
            detalhes.add(prefixo + " -> " + uploads.size() + " arquivo(s) em "
                    + PASTA_MOVIMENTACOES + ": " + String.join(", ", uploads)
                    + " (pasta " + pastaMovimentacoesId + ")");
            return uploads.size();
        } catch (Exception e) {
            log.warn("Falha ao enviar arquivos ao Drive (cnj={}, mov={}): {}",
                    numeroCnj, mov.numero(), e.getMessage());
            detalhes.add(prefixo + " | ERRO Drive: " + e.getMessage());
            return 0;
        }
    }

    static int parseNumeroMov(String numero) {
        if (!StringUtils.hasText(numero)) {
            return 0;
        }
        try {
            return Integer.parseInt(numero.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    static String extensaoComPonto(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return "";
        }
        int ponto = nomeArquivo.lastIndexOf('.');
        if (ponto <= 0 || ponto == nomeArquivo.length() - 1) {
            return "";
        }
        return nomeArquivo.substring(ponto);
    }
}
