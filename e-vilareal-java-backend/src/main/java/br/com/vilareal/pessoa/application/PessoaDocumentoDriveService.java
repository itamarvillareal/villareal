package br.com.vilareal.pessoa.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DocumentoNomeNumeracaoUtil;
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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

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
        return listarP7sNoDrive(pessoaId).stream().map(item -> toResponseDrive(item, pessoaId)).toList();
    }

    /**
     * Lista .p7s diretamente nas pastas Pessoas via Google Drive API:
     * Assinados, Documentos, Assinar (legado/manual) e demais subpastas imediatas + raiz.
     */
    public List<PessoaP7sDriveItem> listarP7sNoDrive(Long pessoaId) {
        validarPessoaExiste(pessoaId);
        if (!googleDriveService.isConfigurado()) {
            return List.of();
        }
        Map<String, PessoaP7sDriveItem> porDriveId = new LinkedHashMap<>();
        try {
            coletarP7sDaPasta(pessoaId, TipoDocumentoPessoa.ASSINADOS, porDriveId);
            coletarP7sDaPasta(pessoaId, TipoDocumentoPessoa.DOCUMENTOS, porDriveId);
            String pastaRaizId = documentoDrivePastaService.resolverPastaPessoa(pessoaId).pastaId();
            coletarP7sEmPasta(pastaRaizId, TipoDocumentoPessoa.ASSINADOS.name(), porDriveId);
            coletarP7sEmSubpastasImediatas(pastaRaizId, porDriveId);
        } catch (Exception e) {
            log.warn("Falha ao listar .p7s no Drive (pessoaId={}): {}", pessoaId, e.getMessage());
            return List.of();
        }
        return porDriveId.values().stream()
                .sorted(Comparator.comparingInt(
                                (PessoaP7sDriveItem item) ->
                                        DocumentoNomeNumeracaoUtil.extrairPrefixoNumerico(item.nomeArquivo()))
                        .thenComparing(PessoaP7sDriveItem::nomeArquivo))
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
            return registrarP7s(pessoaId, TipoDocumentoPessoa.ASSINADOS, bytes, nomeOriginal);
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

        TipoDocumentoPessoa tipoEfetivo = TipoDocumentoPessoa.ASSINADOS;
        String pastaId = documentoDrivePastaService.obterPastaDestinoPessoa(pessoaId, tipoEfetivo);

        byte[] pdfBytes = validacao.pdfEmbutido();
        String pdfSha256 = validacao.sha256ConteudoEmbutido();

        int prefixoExistente = DocumentoNomeNumeracaoUtil.extrairPrefixoNumerico(nomeOriginal);
        int numero;
        if (prefixoExistente >= 2) {
            numero = prefixoExistente;
        } else {
            List<String> nomesExistentes = new ArrayList<>();
            documentoRepository
                    .findByPessoaIdAndTipoOrderByCreatedAtDescIdDesc(pessoaId, TipoDocumentoPessoa.ASSINADOS.name())
                    .stream()
                    .map(PessoaDocumentoDriveEntity::getNomeArquivo)
                    .forEach(nomesExistentes::add);
            listarP7sNoDrive(pessoaId).stream()
                    .map(PessoaP7sDriveItem::nomeArquivo)
                    .forEach(nomesExistentes::add);
            numero = DocumentoNomeNumeracaoUtil.calcularProximoNumeroPessoaAssinados(nomesExistentes);
        }
        String descricao = DocumentoNomeNumeracaoUtil.extrairDescricaoBase(nomeOriginal);
        String nomePdf = DocumentoNomeNumeracaoUtil.formatarNomePessoaAssinadoPdf(numero, descricao);
        String nomeP7s = DocumentoNomeNumeracaoUtil.formatarNomePessoaAssinado(numero, descricao);

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
                log.debug(
                        "PDF salvo na pasta Pessoas (pessoaId={}, tipo={}, arquivo={})",
                        pessoaId,
                        (tipo != null ? tipo : TipoDocumentoPessoa.DOCUMENTOS).name(),
                        enviado.nome());
            } catch (Exception e) {
                log.warn("Erro ao salvar PDF na pasta Pessoas (pessoaId={}): {}", pessoaId, e.getMessage());
            }
        });
    }

    private void coletarP7sDaPasta(Long pessoaId, TipoDocumentoPessoa tipo, Map<String, PessoaP7sDriveItem> acumulado)
            throws Exception {
        String pastaId = documentoDrivePastaService.obterPastaDestinoPessoa(pessoaId, tipo);
        coletarP7sEmPasta(pastaId, tipo.name(), acumulado);
    }

    /**
     * Varre subpastas imediatas da raiz Pessoas (ex.: «Assinar», pastas legadas) para achar .p7s
     * que não estejam só em Assinados/Documentos.
     */
    private void coletarP7sEmSubpastasImediatas(String pastaRaizId, Map<String, PessoaP7sDriveItem> acumulado)
            throws Exception {
        if (!StringUtils.hasText(pastaRaizId)) {
            return;
        }
        List<DriveArquivoDto> filhos = googleDriveService.listarConteudo(pastaRaizId);
        for (DriveArquivoDto filho : filhos) {
            if (filho == null || !"pasta".equals(filho.tipo()) || !StringUtils.hasText(filho.id())) {
                continue;
            }
            String nomePasta = StringUtils.hasText(filho.nome()) ? filho.nome().trim() : "Pasta";
            String tipoJaCoberto = tipoPastaPadraoPessoa(nomePasta);
            if (tipoJaCoberto != null) {
                // Assinados/Documentos já foram coletados via obterPastaDestinoPessoa
                continue;
            }
            coletarP7sEmPasta(filho.id(), nomePasta.toUpperCase(Locale.ROOT), acumulado);
        }
    }

    private static String tipoPastaPadraoPessoa(String nomePasta) {
        if (!StringUtils.hasText(nomePasta)) {
            return null;
        }
        for (TipoDocumentoPessoa tipo : TipoDocumentoPessoa.values()) {
            if (tipo.getPasta().equalsIgnoreCase(nomePasta.trim()) || tipo.name().equalsIgnoreCase(nomePasta.trim())) {
                return tipo.name();
            }
        }
        return null;
    }

    private void coletarP7sEmPasta(String pastaId, String tipoPasta, Map<String, PessoaP7sDriveItem> acumulado)
            throws Exception {
        if (!StringUtils.hasText(pastaId)) {
            return;
        }
        List<DriveArquivoDto> arquivos = googleDriveService.listarConteudo(pastaId);
        for (DriveArquivoDto arquivo : arquivos) {
            if (!ehArquivoP7s(arquivo) || !StringUtils.hasText(arquivo.id())) {
                continue;
            }
            acumulado.putIfAbsent(
                    arquivo.id(),
                    new PessoaP7sDriveItem(
                            arquivo.id(),
                            StringUtils.hasText(arquivo.nome()) ? arquivo.nome().trim() : "documento.p7s",
                            localizarPdfCorrespondente(arquivo, arquivos),
                            tipoPasta));
        }
    }

    private static String localizarPdfCorrespondente(DriveArquivoDto p7sArquivo, List<DriveArquivoDto> mesmaPasta) {
        if (p7sArquivo == null || !StringUtils.hasText(p7sArquivo.nome())) {
            return null;
        }
        String nomePdf = nomePdfCorrespondente(p7sArquivo.nome().trim());
        return mesmaPasta.stream()
                .filter(a -> a != null && StringUtils.hasText(a.nome()))
                .filter(a -> nomePdf.equalsIgnoreCase(a.nome().trim()))
                .map(DriveArquivoDto::id)
                .findFirst()
                .orElse(null);
    }

    static boolean ehArquivoP7s(DriveArquivoDto arquivo) {
        if (arquivo == null || !StringUtils.hasText(arquivo.nome())) {
            return false;
        }
        String nome = arquivo.nome().trim().toLowerCase(Locale.ROOT);
        if (nome.endsWith(".p7s")) {
            return true;
        }
        String mime = StringUtils.hasText(arquivo.mimeType()) ? arquivo.mimeType().trim().toLowerCase(Locale.ROOT) : "";
        return mime.contains("pkcs7") || mime.contains("p7s");
    }

    private static String nomePdfCorrespondente(String nomeP7s) {
        String nome = StringUtils.hasText(nomeP7s) ? nomeP7s.trim() : "documento.p7s";
        if (nome.toLowerCase(Locale.ROOT).endsWith(".pdf.p7s")) {
            return nome.substring(0, nome.length() - 4);
        }
        if (nome.toLowerCase(Locale.ROOT).endsWith(".p7s")) {
            return nome.substring(0, nome.length() - 4) + ".pdf";
        }
        return nome + ".pdf";
    }

    private void validarPessoaExiste(Long pessoaId) {
        if (pessoaId == null || pessoaId < 1) {
            throw new IllegalArgumentException("pessoaId inválido.");
        }
        if (!pessoaRepository.existsById(pessoaId)) {
            throw new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId);
        }
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

    private PessoaDocumentoDriveResponse toResponseDrive(PessoaP7sDriveItem item, Long pessoaId) {
        return new PessoaDocumentoDriveResponse(
                null,
                pessoaId,
                item.tipoPasta(),
                item.nomeArquivo(),
                item.pdfDriveFileId(),
                item.p7sDriveFileId(),
                null,
                null,
                "application/pkcs7-signature",
                null);
    }
}
