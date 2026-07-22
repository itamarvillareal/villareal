package br.com.vilareal.pessoa.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.TipoDocumentoPessoa;
import br.com.vilareal.pessoa.api.dto.PessoaDocumentoDriveResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaDocumentoDriveEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaDocumentoDriveRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.projudi.ProjudiAssinaturaP7sUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;

@Service
public class PessoaDocumentoDriveService {

    private static final Logger log = LoggerFactory.getLogger(PessoaDocumentoDriveService.class);

    private final PessoaRepository pessoaRepository;
    private final PessoaDocumentoDriveRepository documentoRepository;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;

    public PessoaDocumentoDriveService(
            PessoaRepository pessoaRepository,
            PessoaDocumentoDriveRepository documentoRepository,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService) {
        this.pessoaRepository = pessoaRepository;
        this.documentoRepository = documentoRepository;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
    }

    @Transactional(readOnly = true)
    public List<PessoaDocumentoDriveResponse> listar(Long pessoaId, TipoDocumentoPessoa tipo) {
        validarPessoaExiste(pessoaId);
        List<PessoaDocumentoDriveEntity> entidades = tipo != null
                ? documentoRepository.findByPessoaIdAndTipoOrderByCreatedAtDescIdDesc(
                        pessoaId, tipo.name())
                : documentoRepository.findByPessoaIdOrderByCreatedAtDescIdDesc(pessoaId);
        return entidades.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PessoaDocumentoDriveResponse> listarAssinados(Long pessoaId) {
        validarPessoaExiste(pessoaId);
        return documentoRepository
                .findByPessoaIdAndP7sDriveFileIdIsNotNullOrderByCreatedAtDescIdDesc(pessoaId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PessoaDocumentoDriveResponse registrarArquivo(
            Long pessoaId, TipoDocumentoPessoa tipo, MultipartFile arquivo) throws Exception {
        validarPessoaExiste(pessoaId);
        if (arquivo == null || arquivo.isEmpty()) {
            throw new IllegalArgumentException("arquivo é obrigatório.");
        }
        TipoDocumentoPessoa tipoEfetivo = tipo != null ? tipo : TipoDocumentoPessoa.DOCUMENTOS;
        byte[] bytes = arquivo.getBytes();
        String nomeOriginal = StringUtils.hasText(arquivo.getOriginalFilename())
                ? arquivo.getOriginalFilename().trim()
                : "documento";
        String mimeType = StringUtils.hasText(arquivo.getContentType())
                ? arquivo.getContentType().trim()
                : "application/octet-stream";

        if (nomeOriginal.toLowerCase(Locale.ROOT).endsWith(".p7s")) {
            return registrarP7s(pessoaId, tipoEfetivo, bytes, nomeOriginal);
        }

        if (!googleDriveService.isConfigurado()) {
            throw new IllegalStateException("Google Drive não configurado.");
        }
        String pastaId = documentoDrivePastaService.obterPastaDestinoPessoa(pessoaId, tipoEfetivo);
        DriveArquivoDto enviado = googleDriveService.uploadArquivo(bytes, nomeOriginal, mimeType, pastaId);
        if (enviado == null || !StringUtils.hasText(enviado.id())) {
            throw new IllegalStateException("Falha ao enviar arquivo para o Drive.");
        }

        PessoaDocumentoDriveEntity entity = new PessoaDocumentoDriveEntity();
        entity.setPessoaId(pessoaId);
        entity.setTipo(tipoEfetivo.name());
        entity.setNomeArquivo(enviado.nome() != null ? enviado.nome() : nomeOriginal);
        entity.setDriveFileId(enviado.id());
        entity.setMimeType(mimeType);
        return toResponse(documentoRepository.save(entity));
    }

    @Transactional
    public PessoaDocumentoDriveResponse registrarP7s(
            Long pessoaId, TipoDocumentoPessoa tipo, byte[] p7sBytes, String nomeOriginal) throws Exception {
        validarPessoaExiste(pessoaId);
        if (p7sBytes == null || p7sBytes.length == 0) {
            throw new IllegalArgumentException("p7sBytes é obrigatório.");
        }
        if (!googleDriveService.isConfigurado()) {
            throw new IllegalStateException("Google Drive não configurado.");
        }

        ProjudiAssinaturaP7sUtil.ValidacaoP7s validacao = ProjudiAssinaturaP7sUtil.validar(p7sBytes);
        if (!validacao.cmsValido()) {
            throw new IllegalArgumentException(
                    validacao.motivo() != null ? validacao.motivo() : "Arquivo .p7s inválido.");
        }
        if (!validacao.temConteudoEmbutido()) {
            throw new IllegalArgumentException(
                    validacao.motivo() != null ? validacao.motivo() : "Arquivo .p7s sem PDF embutido.");
        }

        TipoDocumentoPessoa tipoEfetivo = tipo != null ? tipo : TipoDocumentoPessoa.ASSINADOS;
        String pastaId = documentoDrivePastaService.obterPastaDestinoPessoa(pessoaId, tipoEfetivo);

        byte[] pdfBytes = validacao.pdfEmbutido();
        String pdfSha256 = validacao.sha256ConteudoEmbutido();
        String nomeBase = normalizarNomeP7s(nomeOriginal);
        String nomePdf = nomeBase.endsWith(".pdf") ? nomeBase : nomeBase + ".pdf";
        String nomeP7s = nomePdf + ".p7s";

        DriveArquivoDto pdfEnviado =
                googleDriveService.uploadArquivo(pdfBytes, nomePdf, "application/pdf", pastaId);
        DriveArquivoDto p7sEnviado = googleDriveService.uploadArquivo(
                p7sBytes, nomeP7s, "application/pkcs7-signature", pastaId);

        PessoaDocumentoDriveEntity entity = new PessoaDocumentoDriveEntity();
        entity.setPessoaId(pessoaId);
        entity.setTipo(tipoEfetivo.name());
        entity.setNomeArquivo(p7sEnviado != null && StringUtils.hasText(p7sEnviado.nome())
                ? p7sEnviado.nome()
                : nomeP7s);
        entity.setDriveFileId(pdfEnviado != null ? pdfEnviado.id() : null);
        entity.setP7sDriveFileId(p7sEnviado != null ? p7sEnviado.id() : null);
        entity.setPdfSha256(pdfSha256);
        entity.setP7sSha256(ProjudiAssinaturaP7sUtil.sha256(p7sBytes));
        entity.setMimeType("application/pkcs7-signature");
        return toResponse(documentoRepository.save(entity));
    }

    /**
     * Copia PDF gerado para a pasta da pessoa (além do destino do processo, se houver).
     */
    public void salvarPdfNaPastaPessoaAsync(
            Long pessoaId, TipoDocumentoPessoa tipo, byte[] pdfBytes, String nomeArquivo) {
        if (pessoaId == null || pdfBytes == null || pdfBytes.length == 0 || !googleDriveService.isConfigurado()) {
            return;
        }
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                String pastaId = documentoDrivePastaService.obterPastaDestinoPessoa(pessoaId, tipo);
                DriveArquivoDto enviado =
                        googleDriveService.uploadArquivo(pdfBytes, nomeArquivo + ".pdf", "application/pdf", pastaId);
                if (enviado == null || !StringUtils.hasText(enviado.id())) {
                    return;
                }
                PessoaDocumentoDriveEntity entity = new PessoaDocumentoDriveEntity();
                entity.setPessoaId(pessoaId);
                entity.setTipo((tipo != null ? tipo : TipoDocumentoPessoa.DOCUMENTOS).name());
                entity.setNomeArquivo(enviado.nome() != null ? enviado.nome() : nomeArquivo + ".pdf");
                entity.setDriveFileId(enviado.id());
                entity.setMimeType("application/pdf");
                entity.setPdfSha256(ProjudiAssinaturaP7sUtil.sha256(pdfBytes));
                documentoRepository.save(entity);
            } catch (Exception e) {
                log.warn("Erro ao salvar PDF na pasta Pessoas (pessoaId={}): {}", pessoaId, e.getMessage());
            }
        });
    }

    private void validarPessoaExiste(Long pessoaId) {
        if (pessoaId == null || pessoaId < 1) {
            throw new IllegalArgumentException("pessoaId inválido.");
        }
        if (!pessoaRepository.existsById(pessoaId)) {
            throw new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId);
        }
    }

    private static String normalizarNomeP7s(String nomeOriginal) {
        String nome = StringUtils.hasText(nomeOriginal) ? nomeOriginal.trim() : "documento";
        if (nome.toLowerCase(Locale.ROOT).endsWith(".pdf.p7s")) {
            nome = nome.substring(0, nome.length - 4);
        } else if (nome.toLowerCase(Locale.ROOT).endsWith(".p7s")) {
            nome = nome.substring(0, nome.length - 4);
        }
        if (!StringUtils.hasText(nome)) {
            return "documento";
        }
        return GoogleDriveService.sanitizarNomeArquivo(nome).replaceAll("(?i)\\.pdf$", "");
    }

    private PessoaDocumentoDriveResponse toResponse(PessoaDocumentoDriveEntity entity) {
        return new PessoaDocumentoDriveResponse(
                entity.getId(),
                entity.getPessoaId(),
                entity.getTipo(),
                entity.getNomeArquivo(),
                entity.getDriveFileId(),
                entity.getP7sDriveFileId(),
                entity.getPdfSha256(),
                entity.getP7sSha256(),
                entity.getMimeType(),
                entity.getCreatedAt());
    }
}
