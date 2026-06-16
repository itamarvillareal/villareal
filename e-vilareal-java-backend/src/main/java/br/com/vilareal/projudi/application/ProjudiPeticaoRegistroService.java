package br.com.vilareal.projudi.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiNumeroReduzidoUtil;
import br.com.vilareal.projudi.ProjudiAssinaturaP7sUtil;
import br.com.vilareal.projudi.ProjudiAssinaturaP7sUtil.ValidacaoP7s;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiCredencialRepository;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Service
public class ProjudiPeticaoRegistroService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiPeticaoRegistroService.class);

    static final String STATUS_PENDENTE_ASSINATURA = "PENDENTE_ASSINATURA";
    static final String STATUS_ARQUIVO_ASSINADO = "ASSINADO";
    static final String STATUS_PETICAO_ASSINADA = "ASSINADA";
    static final String STATUS_PETICAO_PROTOCOLANDO = "PROTOCOLANDO";
    static final String STATUS_PETICAO_PROTOCOLADA = "PROTOCOLADA";
    static final String PASTA_ASSINAR = "Assinar";
    static final int ID_MOVIMENTACAO_TIPO_PADRAO = 260;

    private final ProjudiPeticaoRepository peticaoRepository;
    private final ProjudiCredencialRepository credencialRepository;
    private final ProcessoRepository processoRepository;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;
    private final Path storeDir;

    public ProjudiPeticaoRegistroService(
            ProjudiPeticaoRepository peticaoRepository,
            ProjudiCredencialRepository credencialRepository,
            ProcessoRepository processoRepository,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.peticaoRepository = peticaoRepository;
        this.credencialRepository = credencialRepository;
        this.processoRepository = processoRepository;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
        this.storeDir = Path.of(storeDirConfig.trim());
    }

    public record ArquivoParaAssinar(byte[] pdfBytes, int idArquivoTipo, String nomeOriginal) {}

    public record ArquivoP7sRegistro(byte[] p7sBytes, int idArquivoTipo, String nomeOriginal) {}

    @Transactional
    public ProjudiPeticaoEntity registrarPeticao(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            List<ArquivoParaAssinar> arquivos) {
        if (credencialId == null) {
            throw new IllegalArgumentException("credencialId é obrigatório.");
        }
        if (!StringUtils.hasText(numeroProcesso)) {
            throw new IllegalArgumentException("numeroProcesso é obrigatório.");
        }
        if (arquivos == null || arquivos.isEmpty()) {
            throw new IllegalArgumentException("arquivos é obrigatório (ao menos um PDF).");
        }
        credencialRepository
                .findById(credencialId)
                .orElseThrow(() -> new ResourceNotFoundException("Credencial PROJUDI não encontrada: " + credencialId));

        ProjudiPeticaoEntity peticao = new ProjudiPeticaoEntity();
        peticao.setCredencialId(credencialId);
        peticao.setNumeroProcesso(numeroProcesso.trim());
        peticao.setComplemento(complemento);
        peticao.setIdMovimentacaoTipo(ID_MOVIMENTACAO_TIPO_PADRAO);
        peticao.setStatus(STATUS_PENDENTE_ASSINATURA);
        peticao = peticaoRepository.save(peticao);

        Optional<ProcessoEntity> processoOpt = processoRepository.findByNumeroCnj(numeroProcesso.trim());

        try {
            Files.createDirectories(storeDir);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao criar store-dir de petições: " + storeDir, e);
        }

        for (int i = 0; i < arquivos.size(); i++) {
            ArquivoParaAssinar item = arquivos.get(i);
            if (item == null || item.pdfBytes() == null || item.pdfBytes().length == 0) {
                throw new IllegalArgumentException("arquivos[" + i + "].pdfBytes é obrigatório.");
            }

            String pdfSha256 = sha256Hex(item.pdfBytes());
            String sha8 = pdfSha256.substring(0, 8);
            int ordem = i + 1;
            String nomeStore = peticao.getId() + "_" + ordem + "_" + sha8 + ".pdf";
            Path destino = storeDir.resolve(nomeStore);

            try {
                Files.write(destino, item.pdfBytes());
            } catch (Exception e) {
                throw new IllegalStateException("Falha ao gravar PDF local: " + destino, e);
            }

            ProjudiPeticaoArquivoEntity arquivo = new ProjudiPeticaoArquivoEntity();
            arquivo.setOrdem(ordem);
            arquivo.setIdArquivoTipo(item.idArquivoTipo());
            arquivo.setNomeOriginal(item.nomeOriginal());
            arquivo.setPdfSha256(pdfSha256);
            arquivo.setPdfRef(nomeStore);
            arquivo.setStatus(STATUS_PENDENTE_ASSINATURA);
            peticao.adicionarArquivo(arquivo);

            processoOpt.ifPresent(processo -> copiarPdfParaPastaAssinar(processo, nomeStore, item.pdfBytes(), arquivo));
        }

        return peticaoRepository.save(peticao);
    }

    @Transactional
    public ProjudiPeticaoEntity registrarPeticaoComAssinados(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            List<ArquivoP7sRegistro> arquivos) {
        if (credencialId == null) {
            throw new IllegalArgumentException("credencialId é obrigatório.");
        }
        if (!StringUtils.hasText(numeroProcesso)) {
            throw new IllegalArgumentException("numeroProcesso é obrigatório.");
        }
        if (arquivos == null || arquivos.isEmpty()) {
            throw new IllegalArgumentException("arquivos é obrigatório (ao menos um .p7s).");
        }
        credencialRepository
                .findById(credencialId)
                .orElseThrow(() -> new ResourceNotFoundException("Credencial PROJUDI não encontrada: " + credencialId));

        ProjudiPeticaoEntity peticao = new ProjudiPeticaoEntity();
        peticao.setCredencialId(credencialId);
        peticao.setNumeroProcesso(numeroProcesso.trim());
        peticao.setComplemento(complemento);
        peticao.setIdMovimentacaoTipo(ID_MOVIMENTACAO_TIPO_PADRAO);
        peticao = peticaoRepository.save(peticao);

        Optional<ProcessoEntity> processoOpt = processoRepository.findByNumeroCnj(numeroProcesso.trim());

        try {
            Files.createDirectories(storeDir);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao criar store-dir de petições: " + storeDir, e);
        }

        for (int i = 0; i < arquivos.size(); i++) {
            ArquivoP7sRegistro item = arquivos.get(i);
            if (item == null || item.p7sBytes() == null || item.p7sBytes().length == 0) {
                throw new IllegalArgumentException("arquivos[" + i + "].p7sBytes é obrigatório.");
            }

            ValidacaoP7s validacao = ProjudiAssinaturaP7sUtil.validar(item.p7sBytes());
            if (!validacao.cmsValido()) {
                throw new IllegalArgumentException(
                        "arquivos[" + i + "]: " + (validacao.motivo() != null ? validacao.motivo() : "p7s inválido"));
            }
            if (!validacao.temConteudoEmbutido()) {
                throw new IllegalArgumentException(
                        "arquivos[" + i + "]: "
                                + (validacao.motivo() != null ? validacao.motivo() : "p7s sem PDF embutido"));
            }
            if (!validacao.assinaturaConsistente()) {
                throw new IllegalArgumentException(
                        "arquivos[" + i + "]: "
                                + (validacao.motivo() != null ? validacao.motivo() : "assinatura inconsistente"));
            }

            byte[] pdfBytes = validacao.pdfEmbutido();
            String pdfSha256 = validacao.sha256ConteudoEmbutido();
            String sha8 = pdfSha256.substring(0, 8);
            int ordem = i + 1;
            String nomeStore = peticao.getId() + "_" + ordem + "_" + sha8 + ".pdf";
            String p7sRef = peticao.getId() + "_" + ordem + "_assinado.p7s";

            try {
                Files.write(storeDir.resolve(nomeStore), pdfBytes);
                Files.write(storeDir.resolve(p7sRef), item.p7sBytes());
            } catch (Exception e) {
                throw new IllegalStateException("Falha ao gravar arquivos locais (ordem=" + ordem + ")", e);
            }

            ProjudiPeticaoArquivoEntity arquivo = new ProjudiPeticaoArquivoEntity();
            arquivo.setOrdem(ordem);
            arquivo.setIdArquivoTipo(item.idArquivoTipo());
            arquivo.setNomeOriginal(item.nomeOriginal());
            arquivo.setPdfSha256(pdfSha256);
            arquivo.setPdfRef(nomeStore);
            arquivo.setP7sRef(p7sRef);
            arquivo.setP7sSha256(ProjudiAssinaturaP7sUtil.sha256(item.p7sBytes()));
            arquivo.setConteudoAssinadoSha256(pdfSha256);
            arquivo.setStatus(STATUS_ARQUIVO_ASSINADO);
            peticao.adicionarArquivo(arquivo);

            processoOpt.ifPresent(processo -> copiarPdfParaPastaAssinar(processo, nomeStore, pdfBytes, arquivo));
        }

        peticao.setStatus(STATUS_PETICAO_ASSINADA);
        return peticaoRepository.save(peticao);
    }

    @Transactional(readOnly = true)
    public List<ProjudiPeticaoEntity> listarPorStatus(String status) {
        return peticaoRepository.findByStatus(status);
    }

    @Transactional(readOnly = true)
    public List<ProjudiPeticaoEntity> listarDetalhadas(String status) {
        if (StringUtils.hasText(status)) {
            return peticaoRepository.findByStatusWithArquivos(status.trim());
        }
        return peticaoRepository.findAllWithArquivos();
    }

    @Transactional(readOnly = true)
    public List<ProjudiPeticaoEntity> listarPorProcesso(String numeroProcesso) {
        String digitos = ProjudiNumeroReduzidoUtil.somenteDigitos(numeroProcesso);
        if (!StringUtils.hasText(digitos)) {
            return List.of();
        }
        return peticaoRepository.findAllWithArquivos().stream()
                .filter(p -> digitos.equals(ProjudiNumeroReduzidoUtil.somenteDigitos(p.getNumeroProcesso())))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjudiPeticaoEntity buscarPorId(Long id) {
        return peticaoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Petição PROJUDI não encontrada: " + id));
    }

    @Transactional
    public void atualizarCredencial(Long peticaoId, Long credencialId) {
        if (credencialId == null) {
            throw new IllegalArgumentException("credencialId é obrigatório.");
        }
        ProjudiPeticaoEntity peticao = buscarPorId(peticaoId);
        if (!STATUS_PETICAO_ASSINADA.equals(peticao.getStatus()) && !"ERRO".equals(peticao.getStatus())) {
            throw new IllegalArgumentException(
                    "Só é possível alterar credencial de petição ASSINADA ou ERRO (atual: "
                            + peticao.getStatus()
                            + ").");
        }
        credencialRepository
                .findById(credencialId)
                .orElseThrow(() -> new ResourceNotFoundException("Credencial PROJUDI não encontrada: " + credencialId));
        peticao.setCredencialId(credencialId);
        peticaoRepository.save(peticao);
        log.info("Credencial da petição {} alterada para {}", peticaoId, credencialId);
    }

    @Transactional
    public void excluirPeticao(Long peticaoId) {
        ProjudiPeticaoEntity peticao = peticaoRepository
                .findByIdWithArquivos(peticaoId)
                .orElseThrow(() -> new ResourceNotFoundException("Petição PROJUDI não encontrada: " + peticaoId));
        validarPeticaoExcluivel(peticao);
        for (ProjudiPeticaoArquivoEntity arquivo : List.copyOf(peticao.getArquivos())) {
            removerArquivoPersistido(arquivo);
        }
        peticaoRepository.delete(peticao);
        log.info("Petição PROJUDI excluída (id={}, status={})", peticaoId, peticao.getStatus());
    }

    @Transactional
    public void excluirArquivo(Long peticaoId, Long arquivoId) {
        ProjudiPeticaoEntity peticao = peticaoRepository
                .findByIdWithArquivos(peticaoId)
                .orElseThrow(() -> new ResourceNotFoundException("Petição PROJUDI não encontrada: " + peticaoId));
        validarExclusivel(peticao);

        ProjudiPeticaoArquivoEntity arquivo = peticao.getArquivos().stream()
                .filter(a -> arquivoId.equals(a.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Arquivo da petição não encontrado: peticaoId=" + peticaoId + ", arquivoId=" + arquivoId));
        validarArquivoExclusivel(arquivo);
        removerArquivoPersistido(arquivo);
        peticao.getArquivos().remove(arquivo);

        if (peticao.getArquivos().isEmpty()) {
            peticaoRepository.delete(peticao);
            log.info("Petição PROJUDI excluída após remover último arquivo (id={})", peticaoId);
        } else {
            peticaoRepository.save(peticao);
            log.info("Arquivo de petição excluído (peticaoId={}, arquivoId={})", peticaoId, arquivoId);
        }
    }

    /**
     * Exclusão da petição inteira (com seus arquivos). Permitida enquanto não foi para o PROJUDI:
     * PENDENTE_ASSINATURA, ASSINADA (na fila de protocolo) ou ERRO. Bloqueada quando em protocolo
     * (PROTOCOLANDO) ou já protocolada (PROTOCOLADA).
     */
    private static void validarPeticaoExcluivel(ProjudiPeticaoEntity peticao) {
        String status = peticao.getStatus();
        if (STATUS_PETICAO_PROTOCOLANDO.equals(status) || STATUS_PETICAO_PROTOCOLADA.equals(status)) {
            throw new IllegalArgumentException(
                    "Não é possível excluir petição em protocolo ou já protocolada (atual: " + status + ").");
        }
    }

    private static void validarExclusivel(ProjudiPeticaoEntity peticao) {
        if (!STATUS_PENDENTE_ASSINATURA.equals(peticao.getStatus())) {
            throw new IllegalArgumentException(
                    "Só é possível excluir petições com status PENDENTE_ASSINATURA (atual: "
                            + peticao.getStatus()
                            + ").");
        }
    }

    private static void validarArquivoExclusivel(ProjudiPeticaoArquivoEntity arquivo) {
        if (!STATUS_PENDENTE_ASSINATURA.equals(arquivo.getStatus())) {
            throw new IllegalArgumentException(
                    "Só é possível excluir arquivos ainda não assinados (atual: " + arquivo.getStatus() + ").");
        }
    }

    private void removerArquivoPersistido(ProjudiPeticaoArquivoEntity arquivo) {
        if (StringUtils.hasText(arquivo.getPdfRef())) {
            try {
                Files.deleteIfExists(storeDir.resolve(arquivo.getPdfRef()));
            } catch (Exception e) {
                log.warn("Falha ao remover PDF local (ref={}): {}", arquivo.getPdfRef(), e.getMessage());
            }
        }
        if (StringUtils.hasText(arquivo.getP7sRef())) {
            try {
                Files.deleteIfExists(storeDir.resolve(arquivo.getP7sRef()));
            } catch (Exception e) {
                log.warn("Falha ao remover P7s local (ref={}): {}", arquivo.getP7sRef(), e.getMessage());
            }
        }
        if (StringUtils.hasText(arquivo.getDriveFileId()) && googleDriveService.isConfigurado()) {
            try {
                googleDriveService.enviarParaLixeira(arquivo.getDriveFileId());
            } catch (Exception e) {
                log.warn(
                        "Falha ao enviar arquivo Drive para lixeira (id={}): {}",
                        arquivo.getDriveFileId(),
                        e.getMessage());
            }
        }
    }

    /** Copia o PDF para a subpasta «Assinar» da pasta do processo no Drive (best-effort). */
    private void copiarPdfParaPastaAssinar(
            ProcessoEntity processo,
            String nomeArquivo,
            byte[] pdfBytes,
            ProjudiPeticaoArquivoEntity arquivoEntity) {
        try {
            Integer numeroInterno = processo.getNumeroInterno();
            String codigoCliente = documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo);
            if (numeroInterno == null || !StringUtils.hasText(codigoCliente)) {
                log.info(
                        "Drive Assinar: processo sem pasta resolvível (cnj={}, id={})",
                        processo.getNumeroCnj(),
                        processo.getId());
                return;
            }
            DrivePastaProcessoDto pastaDto = documentoDrivePastaService.resolverPastaRaizProcesso(
                    googleDriveService, codigoCliente.trim(), numeroInterno);
            if (pastaDto == null || !StringUtils.hasText(pastaDto.pastaId())) {
                log.info("Drive Assinar: pasta raiz não resolvida (cnj={})", processo.getNumeroCnj());
                return;
            }
            String pastaAssinarId =
                    googleDriveService.encontrarOuCriarPastaPublic(PASTA_ASSINAR, pastaDto.pastaId());
            DriveArquivoDto upload =
                    googleDriveService.uploadArquivo(pdfBytes, nomeArquivo, "application/pdf", pastaAssinarId);
            if (upload != null && StringUtils.hasText(upload.id())) {
                arquivoEntity.setDriveFileId(upload.id());
                log.info(
                        "Drive Assinar: PDF enviado (cnj={}, arquivo={}, driveFileId={})",
                        processo.getNumeroCnj(),
                        nomeArquivo,
                        upload.id());
            }
        } catch (Exception e) {
            log.warn(
                    "Drive Assinar: falha ao copiar PDF (cnj={}, nome={}): {}",
                    processo.getNumeroCnj(),
                    nomeArquivo,
                    e.getMessage());
        }
    }

    static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }
}
