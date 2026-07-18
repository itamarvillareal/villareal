package br.com.vilareal.processo.application;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * Gera/atualiza {@code Movimentacoes_Consolidado_{CNJ}.pdf} na pasta pai de {@code Movimentações}
 * (pasta raiz do processo no Drive), reutilizando {@link ProcessoMovimentacoesConsolidarPdfService}.
 */
@Service
public class ProcessoMovimentacoesConsolidadoDriveAutoService {

    private static final Logger log = LoggerFactory.getLogger(ProcessoMovimentacoesConsolidadoDriveAutoService.class);

    public enum ResultadoTipo {
        IGNORADO,
        CRIADO,
        ATUALIZADO,
        ERRO
    }

    public record ResultadoConsolidadoDrive(
            ResultadoTipo tipo,
            Long processoId,
            String cnj,
            String nomeArquivo,
            String driveFileId,
            String pastaDestinoId,
            List<String> avisos,
            String mensagemErro) {

        public static ResultadoConsolidadoDrive ignorado(Long processoId, String cnj, String motivo) {
            return new ResultadoConsolidadoDrive(
                    ResultadoTipo.IGNORADO, processoId, cnj, null, null, null, List.of(), motivo);
        }

        public static ResultadoConsolidadoDrive erro(Long processoId, String cnj, String mensagem) {
            return new ResultadoConsolidadoDrive(
                    ResultadoTipo.ERRO, processoId, cnj, null, null, null, List.of(), mensagem);
        }
    }

    private final boolean autoEnabled;
    private final ProcessoRepository processoRepository;
    private final ProcessoMovimentacoesConsolidarPdfService consolidarPdfService;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;

    public ProcessoMovimentacoesConsolidadoDriveAutoService(
            @Value("${vilareal.processo.movimentacoes.consolidado.auto.enabled:true}") boolean autoEnabled,
            ProcessoRepository processoRepository,
            ProcessoMovimentacoesConsolidarPdfService consolidarPdfService,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService) {
        this.autoEnabled = autoEnabled;
        this.processoRepository = processoRepository;
        this.consolidarPdfService = consolidarPdfService;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
    }

    /** Chamado após arquivamento PROJUDI — não-fatal. */
    public void tentarAposArquivamento(ProcessoEntity processo, int arquivosEnviadosNestaPassada) {
        if (!autoEnabled || processo == null || arquivosEnviadosNestaPassada <= 0) {
            return;
        }
        try {
            ResultadoConsolidadoDrive r = atualizarConsolidadoNoDrive(processo.getId(), false);
            if (r.tipo() == ResultadoTipo.ERRO) {
                log.warn(
                        "Consolidado Drive automático falhou (processoId={}, cnj={}): {}",
                        processo.getId(),
                        processo.getNumeroCnj(),
                        r.mensagemErro());
            } else if (r.tipo() == ResultadoTipo.CRIADO || r.tipo() == ResultadoTipo.ATUALIZADO) {
                log.info(
                        "Consolidado Drive automático {} (processoId={}, cnj={}, fileId={})",
                        r.tipo(),
                        processo.getId(),
                        processo.getNumeroCnj(),
                        r.driveFileId());
            }
        } catch (Exception e) {
            log.warn(
                    "Consolidado Drive automático exceção (processoId={}, cnj={}): {}",
                    processo.getId(),
                    processo.getNumeroCnj(),
                    e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public ResultadoConsolidadoDrive atualizarConsolidadoNoDrive(Long processoId, boolean forcarSemNovosArquivos) {
        if (processoId == null || processoId <= 0) {
            return ResultadoConsolidadoDrive.erro(processoId, null, "processoId inválido");
        }
        if (!autoEnabled && !forcarSemNovosArquivos) {
            return ResultadoConsolidadoDrive.ignorado(processoId, null, "consolidação automática desabilitada");
        }
        if (!googleDriveService.isConfigurado()) {
            return ResultadoConsolidadoDrive.ignorado(processoId, null, "Google Drive não configurado");
        }

        ProcessoEntity processo =
                processoRepository.findByIdWithClienteAndPessoa(processoId).orElse(null);
        if (processo == null) {
            return ResultadoConsolidadoDrive.erro(processoId, null, "Processo não encontrado");
        }
        String cnj = StringUtils.hasText(processo.getNumeroCnj()) ? processo.getNumeroCnj().trim() : null;

        String tramitacao = ProcessoTramitacaoService.normalizarTramitacao(processo.getTramitacao());
        if (!ProcessoTramitacaoService.ehProjudi(tramitacao)) {
            return ResultadoConsolidadoDrive.ignorado(
                    processoId, cnj, "tramitação não é Projudi: " + (tramitacao != null ? tramitacao : "(vazia)"));
        }

        String pastaDestinoId;
        try {
            pastaDestinoId = resolverPastaDestinoConsolidado(processo);
        } catch (Exception e) {
            return ResultadoConsolidadoDrive.erro(processoId, cnj, "Falha ao resolver pasta destino: " + e.getMessage());
        }
        if (!StringUtils.hasText(pastaDestinoId)) {
            return ResultadoConsolidadoDrive.erro(processoId, cnj, "Pasta raiz do processo não encontrada no Drive");
        }

        ProcessoMovimentacoesConsolidarPdfService.ResultadoConsolidado gerado;
        try {
            gerado = consolidarPdfService.gerarPdf(processoId);
        } catch (Exception e) {
            return ResultadoConsolidadoDrive.erro(processoId, cnj, e.getMessage());
        }

        try {
            DriveArquivoDto existente =
                    googleDriveService.buscarArquivoPorNomeNaPasta(pastaDestinoId, gerado.nomeArquivo());
            if (existente != null && StringUtils.hasText(existente.id())) {
                googleDriveService.atualizarConteudoArquivo(
                        existente.id(), gerado.pdf(), "application/pdf");
                return new ResultadoConsolidadoDrive(
                        ResultadoTipo.ATUALIZADO,
                        processoId,
                        cnj,
                        gerado.nomeArquivo(),
                        existente.id(),
                        pastaDestinoId,
                        gerado.avisos(),
                        null);
            }
            DriveArquivoDto upload = googleDriveService.uploadArquivo(
                    gerado.pdf(), gerado.nomeArquivo(), "application/pdf", pastaDestinoId);
            if (upload == null || !StringUtils.hasText(upload.id())) {
                return ResultadoConsolidadoDrive.erro(
                        processoId, cnj, "Falha ao enviar consolidado ao Drive (upload retornou vazio)");
            }
            return new ResultadoConsolidadoDrive(
                    ResultadoTipo.CRIADO,
                    processoId,
                    cnj,
                    gerado.nomeArquivo(),
                    upload.id(),
                    pastaDestinoId,
                    gerado.avisos(),
                    null);
        } catch (Exception e) {
            return ResultadoConsolidadoDrive.erro(processoId, cnj, "Falha ao gravar no Drive: " + e.getMessage());
        }
    }

    private String resolverPastaDestinoConsolidado(ProcessoEntity processo) throws Exception {
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
        return pastaDto != null ? pastaDto.pastaId() : null;
    }
}
