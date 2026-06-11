package br.com.vilareal.pje.application;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigInteger;
import java.util.List;

/**
 * Upload da cópia integral PJe na pasta {@code Movimentações} do processo no Google Drive
 * (mesmo destino usado pelo arquivamento Projudi, sem acoplar ao pacote projudi).
 */
@Service
public class PjeDriveArquivamentoService {

    private static final Logger log = LoggerFactory.getLogger(PjeDriveArquivamentoService.class);

    public static final String PASTA_MOVIMENTACOES = "Movimentações";

    private final ProcessoRepository processoRepository;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;

    public PjeDriveArquivamentoService(
            ProcessoRepository processoRepository,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService) {
        this.processoRepository = processoRepository;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
    }

    public record ResultadoUpload(String driveFileId, String nomeArquivo, String pastaMovimentacoesId) {}

    public ResultadoUpload enviarCopiaIntegral(ProcessoEntity processo, String numeroCnj, byte[] pdf, String nomeArquivo) {
        if (!googleDriveService.isConfigurado()) {
            throw new IllegalStateException("Google Drive não configurado.");
        }
        if (pdf == null || pdf.length == 0) {
            throw new IllegalArgumentException("PDF da cópia integral vazio.");
        }
        String pastaId = resolverPastaMovimentacoesId(processo, numeroCnj);

        try {
            List<String> existentes = googleDriveService.buscarFileIdsPorNomeNaPasta(pastaId, nomeArquivo);
            if (!existentes.isEmpty()) {
                String manter = existentes.getFirst();
                try {
                    googleDriveService.atualizarConteudoArquivo(manter, pdf, "application/pdf");
                    log.info(
                            "PJe: cópia integral atualizada no Drive (processo={}, arquivo={}, fileId={})",
                            numeroCnj,
                            nomeArquivo,
                            manter);
                    enviarDuplicatasParaLixeira(existentes, 1, numeroCnj, nomeArquivo);
                    return new ResultadoUpload(manter, nomeArquivo, pastaId);
                } catch (Exception e) {
                    log.warn(
                            "PJe: falha ao atualizar cópia integral existente (processo={}, arquivo={}, fileId={}): {}",
                            numeroCnj,
                            nomeArquivo,
                            manter,
                            e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn(
                    "PJe: falha ao buscar cópias anteriores no Drive (processo={}, arquivo={}): {}",
                    numeroCnj,
                    nomeArquivo,
                    e.getMessage());
        }

        DriveArquivoDto dto = googleDriveService.uploadArquivo(pdf, nomeArquivo, "application/pdf", pastaId);
        if (dto == null || !StringUtils.hasText(dto.id())) {
            throw new IllegalStateException("Upload da cópia integral ao Drive falhou.");
        }
        log.info(
                "PJe: cópia integral enviada ao Drive (processo={}, arquivo={}, fileId={})",
                numeroCnj,
                nomeArquivo,
                dto.id());
        return new ResultadoUpload(dto.id(), nomeArquivo, pastaId);
    }

    private void enviarDuplicatasParaLixeira(
            List<String> existentes, int fromIndex, String numeroCnj, String nomeArquivo) {
        for (int i = fromIndex; i < existentes.size(); i++) {
            String duplicataId = existentes.get(i);
            try {
                googleDriveService.enviarParaLixeira(duplicataId);
                log.info(
                        "PJe: duplicata enviada à lixeira (processo={}, arquivo={}, fileId={})",
                        numeroCnj,
                        nomeArquivo,
                        duplicataId);
            } catch (Exception e) {
                log.warn(
                        "PJe: falha ao enviar duplicata à lixeira (processo={}, arquivo={}, fileId={}): {}",
                        numeroCnj,
                        nomeArquivo,
                        duplicataId,
                        e.getMessage());
            }
        }
    }

    public ProcessoEntity resolverProcessoPorCnj(String numeroCnj) {
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(numeroCnj);
        if (norm.isEmpty()) {
            throw new IllegalArgumentException("CNJ inválido.");
        }
        List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.isEmpty()) {
            throw new IllegalArgumentException("Processo não cadastrado localmente para CNJ " + numeroCnj);
        }
        return processoRepository.findById(ids.getFirst().longValue()).orElseThrow();
    }

    private String resolverPastaMovimentacoesId(ProcessoEntity processo, String numeroCnj) {
        Integer numeroInterno = processo.getNumeroInterno();
        if (numeroInterno == null) {
            throw new IllegalStateException(numeroCnj + " | sem numeroInterno para pasta Drive.");
        }
        String codigoCliente = documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo);
        if (!StringUtils.hasText(codigoCliente)) {
            throw new IllegalStateException(numeroCnj + " | codigoCliente não resolvido.");
        }
        try {
            DrivePastaProcessoDto pastaDto = documentoDrivePastaService.resolverPastaRaizProcesso(
                    googleDriveService, codigoCliente.trim(), numeroInterno);
            if (pastaDto == null || !StringUtils.hasText(pastaDto.pastaId())) {
                throw new IllegalStateException(numeroCnj + " | pasta-folha do processo não resolvida.");
            }
            return googleDriveService.encontrarOuCriarPastaPublic(PASTA_MOVIMENTACOES, pastaDto.pastaId());
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao resolver pasta Movimentações: " + e.getMessage(), e);
        }
    }
}
