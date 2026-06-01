package br.com.vilareal.projudi;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.OcrService;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import br.com.vilareal.publicacao.application.PublicacaoDriveAndamentosService;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Orquestrador PROJUDI — motor de consulta + arquivamento no Drive (PASSO B2a).
 *
 * <p><b>READ-ONLY no PROJUDI:</b> usa apenas {@link ProjudiTeorService#listarMovimentacoes} e
 * {@link ProjudiTeorService#baixarDocumentos}. Não abre pendências; não faz POST além
 * do já existente (busca de processo).</p>
 */
@Service
public class ProjudiOrquestradorService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiOrquestradorService.class);

    private static final int LIMITE_DEFAULT = 1;
    private static final String PASTA_MOVIMENTACOES = "Movimentações";

    private final ProjudiTeorService teorService;
    private final ProcessoRepository processoRepository;
    private final PublicacaoRepository publicacaoRepository;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;
    private final OcrService ocrService;
    private final ProjudiOrquestradorPersistenciaService persistenciaService;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final PublicacaoDriveAndamentosService publicacaoDriveAndamentosService;
    private final int intervaloHorasProximaConsulta;
    private final int passoBackfill;
    private final long delayMsDownload;

    public ProjudiOrquestradorService(ProjudiTeorService teorService,
                                       ProcessoRepository processoRepository,
                                       PublicacaoRepository publicacaoRepository,
                                       DocumentoDrivePastaService documentoDrivePastaService,
                                       GoogleDriveService googleDriveService,
                                       OcrService ocrService,
                                       ProjudiOrquestradorPersistenciaService persistenciaService,
                                       ProjudiOrquestradorGate orquestradorGate,
                                       PublicacaoDriveAndamentosService publicacaoDriveAndamentosService,
                                       @Value("${projudi.orquestrador.intervalo-horas:12}") int intervaloHorasProximaConsulta,
                                       @Value("${projudi.orquestrador.passo-backfill:10}") int passoBackfill,
                                       @Value("${projudi.orquestrador.delay-ms-download:2000}") long delayMsDownload) {
        this.teorService = teorService;
        this.processoRepository = processoRepository;
        this.publicacaoRepository = publicacaoRepository;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
        this.ocrService = ocrService;
        this.persistenciaService = persistenciaService;
        this.orquestradorGate = orquestradorGate;
        this.publicacaoDriveAndamentosService = publicacaoDriveAndamentosService;
        this.intervaloHorasProximaConsulta = intervaloHorasProximaConsulta > 0
                ? intervaloHorasProximaConsulta
                : 12;
        this.passoBackfill = passoBackfill > 0 ? passoBackfill : 10;
        this.delayMsDownload = delayMsDownload >= 0 ? delayMsDownload : 2000;
    }

    public ResultadoOrquestracao executar(Long credencialId, boolean dryRun,
                                          String numeroEspecifico, Integer limite,
                                          Integer maxMovimentacoesComDoc) {
        Optional<ResultadoOrquestracao> resultado = orquestradorGate.tryExecutarComRetorno(
                "orquestrador/run",
                () -> executarInterno(credencialId, dryRun, numeroEspecifico, limite, maxMovimentacoesComDoc));
        if (resultado.isEmpty()) {
            return new ResultadoOrquestracao(
                    0, 0, 0, 0, 0, 0, 1,
                    List.of("robô PROJUDI ocupado; tente novamente em alguns minutos."));
        }
        return resultado.get();
    }

    private ResultadoOrquestracao executarInterno(Long credencialId, boolean dryRun,
                                                  String numeroEspecifico, Integer limite,
                                                  Integer maxMovimentacoesComDoc) {
        int processos = 0;
        int movimentacoesLidas = 0;
        int movimentacoesComDoc = 0;
        int teoresNovos = 0;
        int teoresJaExistentes = 0;
        int arquivosBaixados = 0;
        int erros = 0;
        List<String> detalhes = new ArrayList<>();

        List<ItemProcesso> itens;
        if (StringUtils.hasText(numeroEspecifico)) {
            itens = resolverItemPorNumeroEspecifico(numeroEspecifico.trim(), dryRun, detalhes);
        } else {
            int limiteEfetivo = (limite != null) ? limite : LIMITE_DEFAULT;
            itens = resolverItensConsultaAutomatica(limiteEfetivo);
        }

        for (ItemProcesso item : itens) {
            try {
                processos++;
                ResultadoParcial parcial = processarProcesso(
                        credencialId, dryRun, item, maxMovimentacoesComDoc, detalhes);
                movimentacoesLidas += parcial.movimentacoesLidas();
                movimentacoesComDoc += parcial.movimentacoesComDoc();
                teoresNovos += parcial.teoresNovos();
                teoresJaExistentes += parcial.teoresJaExistentes();
                arquivosBaixados += parcial.arquivosBaixados();
                erros += parcial.erros();
            } catch (Exception e) {
                erros++;
                detalhes.add(item.rotulo() + " | ERRO: " + e.getMessage());
                log.warn("Falha ao processar processo PROJUDI ({}): {}", item.rotulo(), e.getMessage());
            }
        }

        return new ResultadoOrquestracao(
                processos, movimentacoesLidas, movimentacoesComDoc,
                teoresNovos, teoresJaExistentes, arquivosBaixados, erros, detalhes);
    }

    private List<ItemProcesso> resolverItemPorNumeroEspecifico(String cnj, boolean dryRun,
                                                               List<String> detalhes) {
        Optional<ProcessoEntity> processo = buscarProcessoPorCnj(cnj);
        if (processo.isPresent()) {
            return List.of(ItemProcesso.comEntidade(processo.get()));
        }
        if (dryRun) {
            return List.of(ItemProcesso.semEntidade(cnj));
        }
        detalhes.add(cnj + " | AVISO: ProcessoEntity não encontrado por CNJ; "
                + "Drive exige cadastro local — pulado (dryRun=false).");
        return List.of();
    }

    private List<ItemProcesso> resolverItensConsultaAutomatica(int limiteEfetivo) {
        List<ProcessoEntity> processos = processoRepository.findParaConsultaAutomaticaProjudi(
                PageRequest.of(0, limiteEfetivo));
        return processos.stream().map(ItemProcesso::comEntidade).toList();
    }

    private Optional<ProcessoEntity> buscarProcessoPorCnj(String cnj) {
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

    private ResultadoParcial processarProcesso(Long credencialId, boolean dryRun, ItemProcesso item,
                                               Integer maxMovimentacoesComDoc, List<String> detalhes) {
        int movimentacoesLidas = 0;
        int movimentacoesComDoc = 0;
        int teoresNovos = 0;
        int teoresJaExistentes = 0;
        int arquivosBaixados = 0;
        int erros = 0;
        int movComDocProcessadas = 0;

        String numeroCnj = item.numeroCnj();
        String reduzido = ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido(numeroCnj);

        List<ProjudiTeorService.MovimentacaoProjudi> movs =
                teorService.listarMovimentacoes(credencialId, reduzido);
        if (movs.isEmpty() && !reduzido.equals(numeroCnj)) {
            movs = teorService.listarMovimentacoes(credencialId, numeroCnj);
        }

        movimentacoesLidas = movs.size();

        for (ProjudiTeorService.MovimentacaoProjudi mov : movs) {
            if (!mov.temDocumento() || mov.idMovimentacaoArquivo() == null) {
                continue;
            }
            movimentacoesComDoc++;
            movComDocProcessadas++;
            if (maxMovimentacoesComDoc != null && maxMovimentacoesComDoc > 0
                    && movComDocProcessadas > maxMovimentacoesComDoc) {
                break;
            }

            String hashConteudo = sha256Hex(somenteDigitos(numeroCnj) + "|" + mov.idMovi());
            boolean hashJaExiste = publicacaoRepository.existsByHashConteudo(hashConteudo);
            log.info("PROJUDI dedup hash={} existe={}", hashConteudo, hashJaExiste);
            if (hashJaExiste) {
                teoresJaExistentes++;
                continue;
            }

            teoresNovos++;

            List<ProjudiTeorService.ArquivoTeor> arquivos =
                    teorService.baixarDocumentos(credencialId, mov.idMovimentacaoArquivo());
            arquivosBaixados += arquivos.size();

            String nomes = arquivos.stream()
                    .map(ProjudiTeorService.ArquivoTeor::nomeArquivo)
                    .collect(Collectors.joining(", "));

            if (!dryRun && !arquivos.isEmpty()) {
                if (item.processo() == null) {
                    detalhes.add(numeroCnj + " | mov " + mov.numero() + " [" + mov.tipo() + "] "
                            + mov.dataHora() + " -> " + arquivos.size()
                            + " arquivo(s): " + nomes
                            + " | AVISO: sem ProcessoEntity — Drive pulado.");
                } else if (!googleDriveService.isConfigurado()) {
                    detalhes.add(numeroCnj + " | mov " + mov.numero() + " [" + mov.tipo() + "] "
                            + mov.dataHora() + " -> " + arquivos.size()
                            + " arquivo(s): " + nomes
                            + " | AVISO: Google Drive não configurado — upload pulado.");
                } else {
                    enviarArquivosMovimentacaoAoDrive(
                            item.processo(), numeroCnj, mov, arquivos, nomes, detalhes);
                }
            } else {
                detalhes.add(numeroCnj + " | mov " + mov.numero() + " [" + mov.tipo() + "] "
                        + mov.dataHora() + " -> " + arquivos.size() + " arquivo(s): " + nomes);
            }

            if (!dryRun) {
                try {
                    salvarPublicacaoMovimentacao(item, numeroCnj, mov, hashConteudo, detalhes);
                } catch (Exception e) {
                    erros++;
                    detalhes.add(numeroCnj + " | mov " + mov.numero() + " | ERRO publicação: "
                            + e.getClass().getSimpleName() + ": " + e.getMessage());
                    log.warn("Falha ao gravar publicação PROJUDI (cnj={}, mov={}): {}",
                            numeroCnj, mov.numero(), e.getMessage(), e);
                }
            }
        }

        if (!dryRun && item.processo() != null) {
            persistenciaService.atualizarProximaConsulta(
                    item.processo().getId(), intervaloHorasProximaConsulta);
        }

        return new ResultadoParcial(
                movimentacoesLidas, movimentacoesComDoc, teoresNovos, teoresJaExistentes, arquivosBaixados, erros);
    }

    /**
     * Modo somente Drive por CNJ (processo já cadastrado). Usado pelo disparo automático por e-mail.
     */
    public ResultadoSomenteDriveProcesso executarSomenteDrivePorCnj(
            Long credencialId, String cnj, List<String> detalhes) {
        Optional<ProcessoEntity> processo = buscarProcessoPorCnj(cnj);
        if (processo.isEmpty()) {
            List<String> logDetalhes = detalhes != null ? detalhes : new ArrayList<>();
            logDetalhes.add(cnj + " | AVISO: ProcessoEntity não encontrado por CNJ.");
            return ResultadoSomenteDriveProcesso.erro(cnj, 0L, "Processo não encontrado por CNJ.", logDetalhes);
        }
        return executarSomenteDriveProgressivo(credencialId, processo.get(), detalhes);
    }

    /**
     * Modo somente Drive: regra progressiva (NOVAS_TOPO + BACKFILL) sem gravar {@code publicacoes}.
     */
    public ResultadoSomenteDriveProcesso executarSomenteDriveProgressivo(
            Long credencialId, ProcessoEntity processo, List<String> detalhes) {
        long inicioMs = System.currentTimeMillis();
        List<String> logDetalhes = detalhes != null ? detalhes : new ArrayList<>();
        String numeroCnj = processo.getNumeroCnj();
        if (!StringUtils.hasText(numeroCnj)) {
            return ResultadoSomenteDriveProcesso.erro(
                    "?", System.currentTimeMillis() - inicioMs, "Processo sem numeroCnj.", logDetalhes);
        }
        if (!googleDriveService.isConfigurado()) {
            return ResultadoSomenteDriveProcesso.erro(
                    numeroCnj,
                    System.currentTimeMillis() - inicioMs,
                    "Google Drive não configurado.",
                    logDetalhes);
        }

        try {
            String reduzido = ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido(numeroCnj);
            List<ProjudiTeorService.MovimentacaoProjudi> movs =
                    teorService.listarMovimentacoes(credencialId, reduzido);
            if (movs.isEmpty() && !reduzido.equals(numeroCnj)) {
                movs = teorService.listarMovimentacoes(credencialId, numeroCnj);
            }

            List<ProjudiTeorService.MovimentacaoProjudi> comDoc =
                    ProjudiDriveProgressivoUtil.filtrarComDocDesc(movs);
            String pastaMovimentacoesId = resolverPastaMovimentacoesId(processo, numeroCnj, logDetalhes);
            if (pastaMovimentacoesId == null) {
                return ResultadoSomenteDriveProcesso.erro(
                        numeroCnj,
                        System.currentTimeMillis() - inicioMs,
                        "Pasta Movimentações não resolvida.",
                        logDetalhes);
            }

            List<String> nomesDrive = googleDriveService.listarFilhos(pastaMovimentacoesId).stream()
                    .map(com.google.api.services.drive.model.File::getName)
                    .toList();
            Set<Integer> arquivadas = ProjudiDriveProgressivoUtil.extrairNumerosArquivados(nomesDrive);
            int jaArquivados = ProjudiDriveProgressivoUtil.contarJaArquivadasEmComDoc(comDoc, arquivadas);

            ProjudiDriveProgressivoUtil.SelecaoProgressiva selecao =
                    ProjudiDriveProgressivoUtil.selecionarMovimentacoes(comDoc, arquivadas, passoBackfill);
            logDetalhes.add(numeroCnj + " | seleção progressiva: " + selecao.resumo());

            int arquivosEnviados = 0;
            int idxMov = 0;
            for (ProjudiTeorService.MovimentacaoProjudi mov : selecao.baixar()) {
                if (idxMov > 0 && delayMsDownload > 0) {
                    Thread.sleep(delayMsDownload);
                }
                List<ProjudiTeorService.ArquivoTeor> arquivos =
                        teorService.baixarDocumentos(credencialId, mov.idMovimentacaoArquivo());
                String nomes = arquivos.stream()
                        .map(ProjudiTeorService.ArquivoTeor::nomeArquivo)
                        .collect(Collectors.joining(", "));
                arquivosEnviados += enviarArquivosMovimentacaoAoDrive(
                        processo, numeroCnj, mov, arquivos, nomes, pastaMovimentacoesId, logDetalhes);
                idxMov++;
            }

            publicacaoDriveAndamentosService.tentarMarcarAndamentosNoDrivePorCnj(
                    numeroCnj, pastaMovimentacoesId, arquivosEnviados);

            return new ResultadoSomenteDriveProcesso(
                    numeroCnj, arquivosEnviados, jaArquivados,
                    System.currentTimeMillis() - inicioMs, null, logDetalhes, selecao);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoSomenteDriveProcesso.erro(
                    numeroCnj, System.currentTimeMillis() - inicioMs, "Interrompido: " + e.getMessage(), logDetalhes);
        } catch (Exception e) {
            log.warn("Falha somente Drive PROJUDI (cnj={}): {}", numeroCnj, e.getMessage());
            return ResultadoSomenteDriveProcesso.erro(
                    numeroCnj,
                    System.currentTimeMillis() - inicioMs,
                    ProjudiOrquestradorErroUtil.mensagemResumida(e),
                    logDetalhes);
        }
    }

    private String resolverPastaMovimentacoesId(
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

    private void salvarPublicacaoMovimentacao(
            ItemProcesso item,
            String numeroCnj,
            ProjudiTeorService.MovimentacaoProjudi mov,
            String hashConteudo,
            List<String> detalhes) {
        String tipo = ProjudiTextoUtil.limparTexto(mov.tipo());
        String descricao = ProjudiTextoUtil.limparTexto(mov.descricao());
        String teor = StringUtils.hasText(descricao) ? tipo + " - " + descricao : tipo;
        LocalDate dataPublicacao = parseDataPublicacao(mov.dataHora());

        PublicacaoWriteRequest req = new PublicacaoWriteRequest();
        req.setNumeroProcessoEncontrado(numeroCnj);
        req.setDataPublicacao(dataPublicacao);
        req.setDataDisponibilizacao(dataPublicacao);
        req.setFonte("PROJUDI");
        req.setTitulo(capLen(tipo, 255));
        req.setTipoPublicacao(capLen(tipo, 80));
        req.setResumo(capLen(teor, 500));
        req.setTeor(teor);
        req.setHashTeor(sha256Hex(teor));
        req.setHashConteudo(hashConteudo);
        req.setOrigemImportacao("PROJUDI");
        req.setArquivoOrigemNome("PROJUDI mov " + mov.numero() + " [" + mov.idMovi() + "]");
        req.setStatusTratamento("PENDENTE");
        req.setLida(false);
        req.setObservacao("Importado automaticamente via PROJUDI.");

        log.info("PROJUDI salvando publicacao hash={}", hashConteudo);

        Long publicacaoId = persistenciaService.salvarPublicacaoMovimentacao(req, item.processo());
        if (publicacaoId != null) {
            detalhes.add(numeroCnj + " | mov " + mov.numero()
                    + " | publicação PROJUDI gravada (id=" + publicacaoId + ", hash=" + hashConteudo + ").");
        } else {
            detalhes.add(numeroCnj + " | mov " + mov.numero()
                    + " | AVISO publicação não gravada (hash duplicado em criarPublicacaoProjudi: "
                    + hashConteudo + ").");
        }
    }

    private static LocalDate parseDataPublicacao(String dataHora) {
        if (!StringUtils.hasText(dataHora)) {
            return LocalDate.now();
        }
        try {
            return LocalDateTime.parse(dataHora.trim(), DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))
                    .toLocalDate();
        } catch (DateTimeParseException e) {
            log.warn("PROJUDI dataHora inválida ({}): {}", dataHora, e.getMessage());
            return LocalDate.now();
        }
    }

    private static String capLen(String s, int max) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    private int enviarArquivosMovimentacaoAoDrive(
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
    private int enviarArquivosMovimentacaoAoDrive(
            ProcessoEntity processo,
            String numeroCnj,
            ProjudiTeorService.MovimentacaoProjudi mov,
            List<ProjudiTeorService.ArquivoTeor> arquivos,
            String nomes,
            String pastaMovimentacoesId,
            List<String> detalhes) {
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
                        // ocrAplicado=false quando validação rejeita saída; original já está em conteudoUpload
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

    private static int parseNumeroMov(String numero) {
        if (!StringUtils.hasText(numero)) {
            return 0;
        }
        try {
            return Integer.parseInt(numero.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String extensaoComPonto(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return "";
        }
        int ponto = nomeArquivo.lastIndexOf('.');
        if (ponto <= 0 || ponto == nomeArquivo.length() - 1) {
            return "";
        }
        return nomeArquivo.substring(ponto);
    }

    private static String mimeTypePorExtensao(String ext) {
        if (!StringUtils.hasText(ext)) {
            return "application/octet-stream";
        }
        return switch (ext.toLowerCase(Locale.ROOT)) {
            case ".pdf" -> "application/pdf";
            case ".p7s" -> "application/pkcs7-signature";
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".png" -> "image/png";
            default -> "application/octet-stream";
        };
    }

    private static String somenteDigitos(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("\\D", "");
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest((input == null ? "" : input).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Processo cadastrado ou busca direta (dry-run sem entidade local). */
    private record ItemProcesso(ProcessoEntity processo, String numeroCnj) {
        static ItemProcesso comEntidade(ProcessoEntity processo) {
            return new ItemProcesso(processo, processo.getNumeroCnj());
        }

        static ItemProcesso semEntidade(String numeroBusca) {
            return new ItemProcesso(null, numeroBusca);
        }

        String rotulo() {
            return StringUtils.hasText(numeroCnj) ? numeroCnj : "?";
        }
    }

    private record ResultadoParcial(
            int movimentacoesLidas,
            int movimentacoesComDoc,
            int teoresNovos,
            int teoresJaExistentes,
            int arquivosBaixados,
            int erros) {
    }

    public record ResultadoSomenteDriveProcesso(
            String cnj,
            int arquivosBaixados,
            int jaArquivados,
            long duracaoMs,
            String erro,
            List<String> detalhes,
            ProjudiDriveProgressivoUtil.SelecaoProgressiva selecao) {

        static ResultadoSomenteDriveProcesso erro(
                String cnj, long duracaoMs, String erro, List<String> detalhes) {
            return new ResultadoSomenteDriveProcesso(cnj, 0, 0, duracaoMs, erro, detalhes, null);
        }

        public Map<String, Object> toRelatorioMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("cnj", cnj);
            m.put("arquivosBaixados", arquivosBaixados);
            m.put("jaArquivados", jaArquivados);
            m.put("duracaoMs", duracaoMs);
            if (erro != null) {
                m.put("erro", erro);
            }
            if (selecao != null) {
                m.put("selecao", selecao.resumo());
            }
            return m;
        }
    }

    public record ResultadoOrquestracao(
            int processos,
            int movimentacoesLidas,
            int movimentacoesComDoc,
            int teoresNovos,
            int teoresJaExistentes,
            int arquivosBaixados,
            int erros,
            List<String> detalhes) {
    }
}
