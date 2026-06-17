package br.com.vilareal.documento;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Service
public class DocumentoPastaAssinarService {

    private static final Logger log = LoggerFactory.getLogger(DocumentoPastaAssinarService.class);

    /** Fase canónica equivalente a «Aguardando Protocolo» nos diagnósticos. */
    public static final String FASE_AGUARDANDO_PROTOCOLO = "Protocolo / Movimentação";
    static final String PASTA_ASSINAR = "Assinar";

    private final ProcessoRepository processoRepository;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;

    public DocumentoPastaAssinarService(
            ProcessoRepository processoRepository,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService) {
        this.processoRepository = processoRepository;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
    }

    @Transactional
    public DocumentoInserirPastaAssinarResponse inserirPdf(
            Long processoId, String codigoCliente, Integer numeroInterno, byte[] pdfBytes, String nomeArquivo) {
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new BusinessRuleException("PDF vazio.");
        }
        if (!googleDriveService.isConfigurado()) {
            throw new BusinessRuleException("Google Drive não está configurado.");
        }

        ProcessoEntity processo = resolverProcesso(processoId, codigoCliente, numeroInterno)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado para inserir na pasta Assinar."));

        String codigo = documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo);
        Integer numInterno = processo.getNumeroInterno();
        if (!StringUtils.hasText(codigo) || numInterno == null) {
            throw new BusinessRuleException("Processo sem cliente ou número interno para localizar pasta no Drive.");
        }

        String nome = sanitizarNome(nomeArquivo);
        try {
            DrivePastaProcessoDto pastaDto = documentoDrivePastaService.resolverPastaRaizProcesso(
                    googleDriveService, codigo.trim(), numInterno);
            if (pastaDto == null || !StringUtils.hasText(pastaDto.pastaId())) {
                throw new BusinessRuleException("Pasta do processo não encontrada no Drive (cliente/proc.).");
            }

            // Histórico em «Petições» (mesmo destino do «Gerar PDF final»).
            String pastaPeticoesId = documentoDrivePastaService.resolverPastaDestino(
                    googleDriveService, codigo.trim(), numInterno, null, TipoDocumento.PETICAO);
            DriveArquivoDto uploadPeticoes =
                    googleDriveService.uploadArquivo(pdfBytes, nome, "application/pdf", pastaPeticoesId);
            if (uploadPeticoes == null || !StringUtils.hasText(uploadPeticoes.id())) {
                throw new BusinessRuleException("Falha ao enviar PDF para a pasta Petições no Drive.");
            }

            // «Assinar»: recria pasta vazia para o trabalho imediato de assinatura/protocolo.
            String pastaAssinarId = googleDriveService.recriarSubpasta(PASTA_ASSINAR, pastaDto.pastaId());
            if (!StringUtils.hasText(pastaAssinarId)) {
                throw new BusinessRuleException("Falha ao recriar a subpasta Assinar no Drive.");
            }

            DriveArquivoDto uploadAssinar =
                    googleDriveService.uploadArquivo(pdfBytes, nome, "application/pdf", pastaAssinarId);
            if (uploadAssinar == null || !StringUtils.hasText(uploadAssinar.id())) {
                throw new BusinessRuleException("Falha ao enviar PDF para a subpasta Assinar no Drive.");
            }

            processo.setFase(FASE_AGUARDANDO_PROTOCOLO);
            processoRepository.save(processo);

            log.info(
                    "PDF inserido em Petições e Assinar (processoId={}, cnj={}, peticoes={}, assinar={})",
                    processo.getId(),
                    processo.getNumeroCnj(),
                    uploadPeticoes.id(),
                    uploadAssinar.id());

            return new DocumentoInserirPastaAssinarResponse(
                    processo.getId(),
                    FASE_AGUARDANDO_PROTOCOLO,
                    uploadAssinar.id(),
                    uploadPeticoes.id(),
                    nome);
        } catch (BusinessRuleException | ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.warn(
                    "Falha ao inserir PDF na pasta Assinar (processoId={}): {}",
                    processo.getId(),
                    e.getMessage());
            throw new BusinessRuleException("Falha ao inserir PDF na pasta Assinar: " + e.getMessage());
        }
    }

    private Optional<ProcessoEntity> resolverProcesso(
            Long processoId, String codigoCliente, Integer numeroInterno) {
        if (processoId != null && processoId > 0) {
            return processoRepository.findById(processoId);
        }
        if (StringUtils.hasText(codigoCliente) && numeroInterno != null && numeroInterno >= 0) {
            return documentoDrivePastaService.buscarProcessoEntity(codigoCliente.trim(), numeroInterno);
        }
        return Optional.empty();
    }

    private static String sanitizarNome(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return "documento_formatado.pdf";
        }
        String nome = nomeArquivo.trim().replaceAll("[^a-zA-Z0-9._\\- ]", "_");
        return nome.toLowerCase().endsWith(".pdf") ? nome : nome + ".pdf";
    }
}
