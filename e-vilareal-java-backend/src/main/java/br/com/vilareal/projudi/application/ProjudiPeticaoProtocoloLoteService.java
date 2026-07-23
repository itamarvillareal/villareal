package br.com.vilareal.projudi.application;

import br.com.vilareal.projudi.api.dto.PreviaProtocoloResponse;
import br.com.vilareal.projudi.api.dto.PreviaProtocoloResponse.ArquivoPreviaDto;
import br.com.vilareal.projudi.api.dto.PreviaProtocoloResponse.JuntadaPreviaDto;
import br.com.vilareal.projudi.api.dto.ValidarProtocoloResponse;
import br.com.vilareal.projudi.api.dto.ValidarProtocoloResponse.JuntadaValidacaoDto;
import br.com.vilareal.documento.DocumentoPastaAssinarService;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiPeticaoOpcoesConfirmacao;
import br.com.vilareal.projudi.ProjudiPeticaoService;
import br.com.vilareal.projudi.ProjudiPeticaoService.ArquivoPeticao;
import br.com.vilareal.projudi.ProjudiPeticaoService.ResultadoProtocoloPeticao;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class ProjudiPeticaoProtocoloLoteService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiPeticaoProtocoloLoteService.class);

    static final String RESULTADO_PROTOCOLADA = "PROTOCOLADA";
    static final String RESULTADO_ERRO = "ERRO";
    static final String RESULTADO_IGNORADA = "IGNORADA";

    // Espera curta: com a preempção, o robô cede em segundos. Se exceder, falha rápido com mensagem
    // visível na fila em vez de deixar a UI "presa" sem feedback.
    private static final Duration LOCK_PROTOCOLO_TIMEOUT = Duration.ofMinutes(2);

    private final ProjudiPeticaoRepository peticaoRepository;
    private final ProjudiPeticaoRegistroService registroService;
    private final ProjudiPeticaoService peticaoService;
    private final ProjudiPeticaoProtocoloEstadoService estadoService;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final GoogleDriveService googleDriveService;
    private final DocumentoPastaAssinarService documentoPastaAssinarService;
    private final ProjudiPeticaoProtocoloEmailService protocoloEmailService;
    private final Path storeDir;

    /**
     * Executor dedicado (1 thread) para protocolo em segundo plano. O acesso ao robô PROJUDI já é
     * serializado pelo {@link ProjudiOrquestradorGate}; a fila aqui só evita acumular trabalho e
     * libera a thread HTTP de imediato (evita 504 em proxies à frente).
     */
    private final ExecutorService protocoloExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "projudi-protocolo");
        t.setDaemon(true);
        return t;
    });

    public ProjudiPeticaoProtocoloLoteService(
            ProjudiPeticaoRepository peticaoRepository,
            ProjudiPeticaoRegistroService registroService,
            ProjudiPeticaoService peticaoService,
            ProjudiPeticaoProtocoloEstadoService estadoService,
            ProjudiOrquestradorGate orquestradorGate,
            GoogleDriveService googleDriveService,
            DocumentoPastaAssinarService documentoPastaAssinarService,
            ProjudiPeticaoProtocoloEmailService protocoloEmailService,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.peticaoRepository = peticaoRepository;
        this.registroService = registroService;
        this.peticaoService = peticaoService;
        this.estadoService = estadoService;
        this.orquestradorGate = orquestradorGate;
        this.googleDriveService = googleDriveService;
        this.documentoPastaAssinarService = documentoPastaAssinarService;
        this.protocoloEmailService = protocoloEmailService;
        this.storeDir = Path.of(storeDirConfig.trim());
    }

    public record ResultadoItemLote(Long peticaoId, String numeroProcesso, String resultado, String mensagem) {}

    public List<ResultadoItemLote> protocolarLote(List<Long> peticaoIds) {
        return protocolarLote(peticaoIds, false, null);
    }

    public List<ResultadoItemLote> protocolarLote(List<Long> peticaoIds, boolean emailResultadoAgendamento) {
        return protocolarLote(peticaoIds, emailResultadoAgendamento, null);
    }

    public List<ResultadoItemLote> protocolarLote(
            List<Long> peticaoIds, boolean emailResultadoAgendamento, String complemento) {
        return protocolarLote(peticaoIds, emailResultadoAgendamento, complemento, null, null);
    }

    public List<ResultadoItemLote> protocolarLote(
            List<Long> peticaoIds,
            boolean emailResultadoAgendamento,
            String complemento,
            Boolean pedidoUrgencia,
            Boolean pedidoLiberdade) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new IllegalArgumentException("peticaoIds é obrigatório (ao menos um id).");
        }
        validarPeticaoIdsNaoSaoInicialDistribuicao(peticaoIds);
        registroService.aplicarComplementoAntesProtocolo(peticaoIds, complemento);
        registroService.aplicarOpcoesConfirmacaoAntesProtocolo(peticaoIds, pedidoUrgencia, pedidoLiberdade);

        Optional<List<ResultadoItemLote>> resultado = orquestradorGate.executarComRetornoAguardando(
                "peticao/protocolar-lote",
                LOCK_PROTOCOLO_TIMEOUT,
                () -> executarLoteSequencial(peticaoIds, emailResultadoAgendamento));
        if (resultado.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Robô PROJUDI ocupado (consulta automática em andamento). Aguarde alguns minutos e tente novamente.");
        }
        return resultado.get();
    }

    public List<ResultadoItemLote> protocolarProcesso(String numeroProcesso) {
        List<Long> ids = idsAssinadasParaProtocolo(numeroProcesso);
        if (ids.isEmpty()) {
            return List.of();
        }
        return protocolarLote(ids);
    }

    /**
     * Dispara o protocolo em segundo plano e retorna imediatamente os ids aceitos. A UI acompanha o
     * progresso pela própria fila (status PROTOCOLANDO → PROTOCOLADA, ou volta a ASSINADA em erro),
     * evitando que a requisição HTTP fique presa e estoure timeout de proxy (504).
     */
    public List<Long> protocolarLoteAssincrono(List<Long> peticaoIds) {
        return protocolarLoteAssincrono(peticaoIds, false, null);
    }

    /**
     * @param emailResultadoAgendamento quando {@code true}, envia e-mail de sucesso/erro ao terminar
     *     (usado apenas pelo scheduler de protocolo agendado).
     */
    public List<Long> protocolarLoteAssincrono(List<Long> peticaoIds, boolean emailResultadoAgendamento) {
        return protocolarLoteAssincrono(peticaoIds, emailResultadoAgendamento, null);
    }

    public List<Long> protocolarLoteAssincrono(
            List<Long> peticaoIds, boolean emailResultadoAgendamento, String complemento) {
        return protocolarLoteAssincrono(peticaoIds, emailResultadoAgendamento, complemento, null, null);
    }

    public List<Long> protocolarLoteAssincrono(
            List<Long> peticaoIds,
            boolean emailResultadoAgendamento,
            String complemento,
            Boolean pedidoUrgencia,
            Boolean pedidoLiberdade) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new IllegalArgumentException("peticaoIds é obrigatório (ao menos um id).");
        }
        List<Long> ids = List.copyOf(peticaoIds);
        registroService.aplicarComplementoAntesProtocolo(ids, complemento);
        registroService.aplicarOpcoesConfirmacaoAntesProtocolo(ids, pedidoUrgencia, pedidoLiberdade);
        estadoService.limparEstadoFila(ids);
        protocoloExecutor.submit(() -> executarLoteEmBackground(ids, emailResultadoAgendamento));
        return ids;
    }

    /** Variante por número de processo: resolve as ASSINADA e dispara em segundo plano. */
    public List<Long> protocolarProcessoAssincrono(String numeroProcesso) {
        return protocolarProcessoAssincrono(numeroProcesso, null, null, null);
    }

    public List<Long> protocolarProcessoAssincrono(String numeroProcesso, String complemento) {
        return protocolarProcessoAssincrono(numeroProcesso, complemento, null, null);
    }

    public List<Long> protocolarProcessoAssincrono(
            String numeroProcesso, String complemento, Boolean pedidoUrgencia, Boolean pedidoLiberdade) {
        List<Long> ids = idsAssinadasParaProtocolo(numeroProcesso);
        if (ids.isEmpty()) {
            return List.of();
        }
        return protocolarLoteAssincrono(ids, false, complemento, pedidoUrgencia, pedidoLiberdade);
    }

    private void executarLoteEmBackground(List<Long> ids, boolean emailResultadoAgendamento) {
        try {
            List<ResultadoItemLote> resultado = protocolarLote(ids, emailResultadoAgendamento);
            log.info("Protocolo em segundo plano concluído {}: {}", ids, resultado);
        } catch (ResponseStatusException e) {
            String motivo = e.getReason() != null ? e.getReason() : "Robô PROJUDI ocupado.";
            log.warn("Protocolo em segundo plano não executado {} — {}", ids, motivo);
            estadoService.registrarMensagemFila(ids, motivo);
            if (emailResultadoAgendamento) {
                notificarResultadosPorEmail(criarResultadosErroLote(ids, motivo));
            }
        } catch (Exception e) {
            String msg = ProjudiPeticaoProtocoloEstadoService.truncarMensagem(descreverErroParaDiagnostico(e));
            log.error("Falha no protocolo em segundo plano {}: {}", ids, msg, e);
            estadoService.registrarMensagemFila(ids, msg);
            if (emailResultadoAgendamento) {
                notificarResultadosPorEmail(criarResultadosErroLote(ids, msg));
            }
        }
    }

    private List<ResultadoItemLote> criarResultadosErroLote(List<Long> ids, String mensagem) {
        List<ResultadoItemLote> resultados = new ArrayList<>(ids.size());
        for (Long id : ids) {
            String numero = peticaoRepository
                    .findById(id)
                    .map(ProjudiPeticaoEntity::getNumeroProcesso)
                    .orElse(null);
            resultados.add(new ResultadoItemLote(id, numero, RESULTADO_ERRO, mensagem));
        }
        return resultados;
    }

    @PreDestroy
    void encerrarExecutor() {
        protocoloExecutor.shutdown();
    }

    public void reabrirParaRetentativa(Long peticaoId) {
        estadoService.resetarParaRetentativa(peticaoId);
    }

    public PreviaProtocoloResponse previaProtocoloPorProcesso(String numeroProcesso) {
        List<Long> ids = idsAssinadasParaProtocolo(numeroProcesso);
        return montarPrevia(ids, numeroProcesso);
    }

    public PreviaProtocoloResponse previaProtocoloLote(List<Long> peticaoIds) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new IllegalArgumentException("peticaoIds é obrigatório (ao menos um id).");
        }
        return montarPrevia(peticaoIds, null);
    }

    public ValidarProtocoloResponse validarProtocoloPorProcesso(String numeroProcesso) {
        List<Long> ids = idsAssinadasParaProtocolo(numeroProcesso);
        return executarValidacaoSemConcluir(ids, numeroProcesso);
    }

    public ValidarProtocoloResponse validarProtocoloLote(List<Long> peticaoIds) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new IllegalArgumentException("peticaoIds é obrigatório (ao menos um id).");
        }
        return executarValidacaoSemConcluir(peticaoIds, null);
    }

    private List<Long> idsAssinadasParaProtocolo(String numeroProcesso) {
        if (ProjudiInicialAssinaturaService.ehChaveInicialDistribuicao(numeroProcesso)) {
            return List.of();
        }
        return registroService.listarPorProcesso(numeroProcesso).stream()
                .filter(p -> ProjudiPeticaoProtocoloEstadoService.STATUS_ASSINADA.equals(p.getStatus()))
                .map(ProjudiPeticaoEntity::getId)
                .sorted()
                .toList();
    }

    private void validarPeticaoIdsNaoSaoInicialDistribuicao(List<Long> peticaoIds) {
        for (Long id : peticaoIds) {
            if (id == null) {
                continue;
            }
            ProjudiPeticaoEntity peticao = peticaoRepository
                    .findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Petição não encontrada: " + id));
            ProjudiInicialAssinaturaService.exigirNaoEhInicialDistribuicao(peticao.getNumeroProcesso(), id);
        }
    }

    private PreviaProtocoloResponse montarPrevia(List<Long> peticaoIds, String numeroProcessoLabel) {
        List<String> avisosGerais = new ArrayList<>();
        if (peticaoIds.isEmpty()) {
            avisosGerais.add("Nenhuma petição ASSINADA pronta para protocolo.");
            return new PreviaProtocoloResponse(List.of(), 0, 0, 0, avisosGerais);
        }

        List<JuntadaPreviaDto> juntadas = new ArrayList<>();
        int totalArquivos = 0;
        for (List<Long> grupo : agruparPorJuntada(peticaoIds)) {
            PlanoJuntada plano = montarPlanoJuntada(grupo, avisosGerais);
            if (plano == null) {
                continue;
            }
            juntadas.add(plano.previa());
            totalArquivos += plano.arquivos().size();
        }

        if (juntadas.isEmpty()) {
            avisosGerais.add("Nenhuma juntada válida — verifique arquivos .p7s e status das petições.");
        }

        return new PreviaProtocoloResponse(
                juntadas,
                juntadas.size(),
                juntadas.size(),
                totalArquivos,
                List.copyOf(avisosGerais));
    }

    private ValidarProtocoloResponse executarValidacaoSemConcluir(List<Long> peticaoIds, String numeroProcessoLabel) {
        PreviaProtocoloResponse previa = montarPrevia(peticaoIds, numeroProcessoLabel);
        if (previa.juntadas().isEmpty()) {
            return new ValidarProtocoloResponse(false, List.of(), previa.avisosGerais());
        }

        Optional<List<JuntadaValidacaoDto>> resultado = orquestradorGate.executarComRetornoAguardando(
                "peticao/validar-protocolo",
                LOCK_PROTOCOLO_TIMEOUT,
                () -> validarJuntadasNoProjudi(previa.juntadas()));
        if (resultado.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Robô PROJUDI ocupado (consulta automática em andamento). Aguarde alguns minutos e tente novamente.");
        }

        List<JuntadaValidacaoDto> juntadas = resultado.get();
        boolean sucessoGeral = juntadas.stream().allMatch(JuntadaValidacaoDto::sucesso);
        return new ValidarProtocoloResponse(sucessoGeral, juntadas, previa.avisosGerais());
    }

    private List<JuntadaValidacaoDto> validarJuntadasNoProjudi(List<JuntadaPreviaDto> juntadas) {
        List<JuntadaValidacaoDto> resultados = new ArrayList<>(juntadas.size());
        for (JuntadaPreviaDto juntada : juntadas) {
            resultados.add(validarUmaJuntada(juntada));
        }
        return resultados;
    }

    private JuntadaValidacaoDto validarUmaJuntada(JuntadaPreviaDto juntada) {
        if (!juntada.avisos().isEmpty()) {
            return new JuntadaValidacaoDto(
                    juntada.credencialId(),
                    juntada.numeroProcesso(),
                    juntada.peticaoIds(),
                    juntada.arquivos(),
                    false,
                    String.join("; ", juntada.avisos()),
                    "");
        }

        List<ProjudiPeticaoEntity> peticoes = carregarPeticoesOrdenadas(juntada.peticaoIds());
        Optional<String> erroCarregamento = validarPeticoes(peticoes);
        if (erroCarregamento.isPresent()) {
            return new JuntadaValidacaoDto(
                    juntada.credencialId(),
                    juntada.numeroProcesso(),
                    juntada.peticaoIds(),
                    juntada.arquivos(),
                    false,
                    erroCarregamento.get(),
                    "");
        }

        ProjudiPeticaoEntity referencia = peticoes.getFirst();
        List<ArquivoPeticao> arquivosP7s = montarArquivosDePeticoes(peticoes);

        log.warn(
                "Validando juntada {} no PROJUDI (processo={}, {} arquivo(s)) — passo Concluir NÃO será executado.",
                juntada.peticaoIds(),
                referencia.getNumeroProcesso(),
                arquivosP7s.size());

        ResultadoProtocoloPeticao validacao = peticaoService.validarProtocoloSemConcluir(
                referencia.getCredencialId(),
                referencia.getNumeroProcesso(),
                registroService.resolverComplementoJuntada(peticoes),
                arquivosP7s);

        return new JuntadaValidacaoDto(
                juntada.credencialId(),
                juntada.numeroProcesso(),
                juntada.peticaoIds(),
                juntada.arquivos(),
                validacao.sucesso(),
                validacao.mensagem(),
                validacao.respostaBruta());
    }

    private record PlanoJuntada(JuntadaPreviaDto previa, List<ArquivoPeticao> arquivos) {}

    private PlanoJuntada montarPlanoJuntada(List<Long> peticaoIdsGrupo, List<String> avisosGerais) {
        List<Long> idsOrdenados = new ArrayList<>(peticaoIdsGrupo);
        idsOrdenados.sort(Long::compareTo);

        List<ProjudiPeticaoEntity> peticoes = new ArrayList<>();
        List<String> avisos = new ArrayList<>();
        long credencialId = -1L;
        String numeroProcesso = null;

        for (Long peticaoId : idsOrdenados) {
            Optional<ProjudiPeticaoEntity> opt = peticaoRepository.findByIdWithArquivos(peticaoId);
            if (opt.isEmpty()) {
                avisos.add("Petição #" + peticaoId + " não encontrada.");
                continue;
            }
            ProjudiPeticaoEntity peticao = opt.get();
            if (!ProjudiPeticaoProtocoloEstadoService.STATUS_ASSINADA.equals(peticao.getStatus())) {
                avisos.add(
                        "Petição #"
                                + peticaoId
                                + " ignorada (status "
                                + peticao.getStatus()
                                + ", esperado ASSINADA).");
                continue;
            }
            credencialId = peticao.getCredencialId() != null ? peticao.getCredencialId() : -1L;
            numeroProcesso = peticao.getNumeroProcesso();
            peticoes.add(peticao);
        }

        if (peticoes.isEmpty()) {
            return null;
        }

        Optional<String> erro = validarPeticoes(peticoes);
        if (erro.isPresent()) {
            avisos.add(erro.get());
        }

        List<ArquivoPreviaDto> arquivosPrevia = new ArrayList<>();
        int ordem = 1;
        for (ProjudiPeticaoEntity peticao : peticoes) {
            for (ProjudiPeticaoArquivoEntity arquivo : peticao.getArquivos()) {
                boolean encontrado = StringUtils.hasText(arquivo.getP7sRef())
                        && Files.isRegularFile(storeDir.resolve(arquivo.getP7sRef()));
                arquivosPrevia.add(new ArquivoPreviaDto(
                        ordem++,
                        peticao.getId(),
                        arquivo.getNomeOriginal(),
                        arquivo.getIdArquivoTipo(),
                        ProjudiPeticaoService.nomeTipoArquivo(arquivo.getIdArquivoTipo()),
                        encontrado));
            }
        }

        if (peticoes.size() > 1) {
            avisosGerais.add(
                    "Juntada única com petições "
                            + idsOrdenados
                            + " ("
                            + arquivosPrevia.size()
                            + " arquivo(s), 1 Concluir).");
        }

        JuntadaPreviaDto previa = new JuntadaPreviaDto(
                credencialId,
                numeroProcesso,
                peticoes.stream().map(ProjudiPeticaoEntity::getId).toList(),
                registroService.resolverComplementoJuntada(peticoes),
                arquivosPrevia,
                List.copyOf(avisos));

        List<ArquivoPeticao> arquivos = erro.isPresent() ? List.of() : montarArquivosDePeticoes(peticoes);
        return new PlanoJuntada(previa, arquivos);
    }

    private List<ProjudiPeticaoEntity> carregarPeticoesOrdenadas(List<Long> peticaoIds) {
        List<Long> ids = new ArrayList<>(peticaoIds);
        ids.sort(Long::compareTo);
        List<ProjudiPeticaoEntity> peticoes = new ArrayList<>(ids.size());
        for (Long id : ids) {
            peticoes.add(peticaoRepository
                    .findByIdWithArquivos(id)
                    .orElseThrow(() -> new IllegalStateException("Petição não encontrada: " + id)));
        }
        return peticoes;
    }

    private Optional<String> validarPeticoes(List<ProjudiPeticaoEntity> peticoes) {
        for (ProjudiPeticaoEntity peticao : peticoes) {
            Optional<String> erro = validarECarregarArquivosP7s(peticao);
            if (erro.isPresent()) {
                return erro;
            }
        }
        return Optional.empty();
    }

    private List<ArquivoPeticao> montarArquivosDePeticoes(List<ProjudiPeticaoEntity> peticoes) {
        List<ArquivoPeticao> arquivosP7s = new ArrayList<>();
        for (ProjudiPeticaoEntity peticao : peticoes) {
            arquivosP7s.addAll(montarListaArquivosP7s(peticao));
        }
        return arquivosP7s;
    }

    private List<ResultadoItemLote> executarLoteSequencial(List<Long> peticaoIds, boolean emailResultadoAgendamento) {
        List<List<Long>> grupos = agruparPorJuntada(peticaoIds);
        if (grupos.size() > 1) {
            log.info(
                    "Protocolo em lote: {} juntada(s) — sessão PROJUDI reaproveitada entre processos da mesma credencial.",
                    grupos.size());
        }
        Map<Long, ResultadoItemLote> porId = new LinkedHashMap<>();
        for (List<Long> grupo : grupos) {
            porId.putAll(processarGrupoJuntada(grupo));
        }
        List<ResultadoItemLote> resultados = new ArrayList<>(peticaoIds.size());
        for (Long id : peticaoIds) {
            resultados.add(porId.get(id));
        }
        if (emailResultadoAgendamento) {
            notificarResultadosPorEmail(resultados);
        }
        return resultados;
    }

    /**
     * Uma juntada PROJUDI = um processo + uma credencial + vários arquivos + um Concluir.
     * Agrupa por (credencial_id, numero_processo) preservando a ordem de primeira aparição.
     */
    record ChaveJuntada(long credencialId, String numeroProcesso) {}

    List<List<Long>> agruparPorJuntada(List<Long> peticaoIds) {
        LinkedHashMap<ChaveJuntada, List<Long>> grupos = new LinkedHashMap<>();
        for (Long id : peticaoIds) {
            ChaveJuntada chave = peticaoRepository
                    .findById(id)
                    .map(p -> new ChaveJuntada(
                            p.getCredencialId() != null ? p.getCredencialId() : -1L, p.getNumeroProcesso()))
                    .orElse(new ChaveJuntada(-1L, "?"));
            grupos.computeIfAbsent(chave, k -> new ArrayList<>()).add(id);
        }
        return new ArrayList<>(grupos.values());
    }

    static List<List<Long>> agruparPorJuntadaParaTeste(
            List<Long> peticaoIds, java.util.function.Function<Long, ChaveJuntada> resolver) {
        LinkedHashMap<ChaveJuntada, List<Long>> grupos = new LinkedHashMap<>();
        for (Long id : peticaoIds) {
            ChaveJuntada chave = resolver.apply(id);
            grupos.computeIfAbsent(chave, k -> new ArrayList<>()).add(id);
        }
        return new ArrayList<>(grupos.values());
    }

    private static ProjudiPeticaoOpcoesConfirmacao resolverOpcoesConfirmacao(List<ProjudiPeticaoEntity> peticoes) {
        if (peticoes == null || peticoes.isEmpty()) {
            return ProjudiPeticaoOpcoesConfirmacao.PADRAO;
        }
        return ProjudiPeticaoOpcoesConfirmacao.deFlags(
                peticoes.stream().map(ProjudiPeticaoEntity::isPedidoUrgencia).toList(),
                peticoes.stream().map(ProjudiPeticaoEntity::isPedidoLiberdade).toList());
    }

    private Map<Long, ResultadoItemLote> processarGrupoJuntada(List<Long> peticaoIdsGrupo) {
        Map<Long, ResultadoItemLote> resultados = new LinkedHashMap<>();
        List<Long> claimadas = new ArrayList<>();

        for (Long peticaoId : peticaoIdsGrupo) {
            Optional<String> motivoIgnorada = estadoService.tentarClaim(peticaoId);
            if (motivoIgnorada.isPresent()) {
                String numero = peticaoRepository
                        .findById(peticaoId)
                        .map(ProjudiPeticaoEntity::getNumeroProcesso)
                        .orElse(null);
                resultados.put(
                        peticaoId, new ResultadoItemLote(peticaoId, numero, RESULTADO_IGNORADA, motivoIgnorada.get()));
            } else {
                claimadas.add(peticaoId);
            }
        }

        if (claimadas.isEmpty()) {
            return resultados;
        }

        claimadas.sort(Long::compareTo);

        List<ProjudiPeticaoEntity> peticoes = new ArrayList<>(claimadas.size());
        for (Long peticaoId : claimadas) {
            ProjudiPeticaoEntity peticao = peticaoRepository
                    .findByIdWithArquivos(peticaoId)
                    .orElseThrow(() -> new IllegalStateException("Petição claimada não encontrada: " + peticaoId));
            peticoes.add(peticao);
        }

        Optional<String> erroCarregamento = validarPeticoes(peticoes);
        if (erroCarregamento.isPresent()) {
            String msg = erroCarregamento.get();
            for (Long id : claimadas) {
                estadoService.devolverParaProtocolar(id, msg);
                ProjudiPeticaoEntity p = peticaoRepository.findById(id).orElseThrow();
                resultados.put(id, new ResultadoItemLote(id, p.getNumeroProcesso(), RESULTADO_ERRO, msg));
            }
            return resultados;
        }

        ProjudiPeticaoEntity referencia = peticoes.getFirst();
        List<ArquivoPeticao> arquivosP7s = montarArquivosDePeticoes(peticoes);
        ProjudiPeticaoOpcoesConfirmacao opcoesConfirmacao = resolverOpcoesConfirmacao(peticoes);

        String idsLabel = claimadas.toString();
        log.warn(
                "Protocolando juntada {} (processo={}, {} arquivo(s), urgencia={}, liberdade={}) — passo Concluir é IRREVERSÍVEL.",
                idsLabel,
                referencia.getNumeroProcesso(),
                arquivosP7s.size(),
                opcoesConfirmacao.pedidoUrgencia(),
                opcoesConfirmacao.pedidoLiberdade());

        List<Long> idsGrupo = List.copyOf(claimadas);
        ResultadoProtocoloPeticao protocolo;
        try {
            protocolo = peticaoService.protocolarPeticao(
                    referencia.getCredencialId(),
                    referencia.getNumeroProcesso(),
                    registroService.resolverComplementoJuntada(peticoes),
                    arquivosP7s,
                    etapa -> estadoService.registrarEtapa(idsGrupo, etapa),
                    opcoesConfirmacao);
        } catch (RuntimeException e) {
            // Exceção (ex.: falha de OTP/sessão) não pode deixar a petição presa em PROTOCOLANDO:
            // devolve para ASSINADA (frame "2. Protocolar") para reenvio imediato.
            String msg = ProjudiPeticaoProtocoloEstadoService.truncarMensagem(
                    descreverErroParaDiagnostico(e));
            log.error("Falha ao protocolar juntada {} (processo={}): {}", idsLabel, referencia.getNumeroProcesso(), msg, e);
            for (Long peticaoId : claimadas) {
                estadoService.devolverParaProtocolar(peticaoId, msg);
                resultados.put(
                        peticaoId, new ResultadoItemLote(peticaoId, referencia.getNumeroProcesso(), RESULTADO_ERRO, msg));
            }
            return resultados;
        }

        if (protocolo.sucesso()) {
            for (Long peticaoId : claimadas) {
                estadoService.finalizarProtocolada(peticaoId, protocolo.mensagem());
                resultados.put(
                        peticaoId,
                        new ResultadoItemLote(
                                peticaoId, referencia.getNumeroProcesso(), RESULTADO_PROTOCOLADA, protocolo.mensagem()));
            }
            finalizarProcessoAposProtocolo(referencia.getNumeroProcesso());
            return resultados;
        }

        // Falha retornada (sem sucesso): devolve para ASSINADA em vez de marcar ERRO/Histórico,
        // garantindo que a petição volte para o frame "2. Protocolar".
        String msg = montarMensagemErro(protocolo);
        for (Long peticaoId : claimadas) {
            estadoService.devolverParaProtocolar(peticaoId, msg);
            resultados.put(
                    peticaoId, new ResultadoItemLote(peticaoId, referencia.getNumeroProcesso(), RESULTADO_ERRO, msg));
        }
        return resultados;
    }

    /**
     * Envia um e-mail por processo: sucesso se todas as petições do grupo protocolaram; erro caso contrário.
     */
    void notificarResultadosPorEmail(List<ResultadoItemLote> resultados) {
        if (resultados == null || resultados.isEmpty()) {
            return;
        }
        LinkedHashMap<String, List<ResultadoItemLote>> porProcesso = new LinkedHashMap<>();
        for (ResultadoItemLote item : resultados) {
            if (item == null) {
                continue;
            }
            String chave = StringUtils.hasText(item.numeroProcesso()) ? item.numeroProcesso().trim() : "?";
            porProcesso.computeIfAbsent(chave, k -> new ArrayList<>()).add(item);
        }
        for (List<ResultadoItemLote> grupo : porProcesso.values()) {
            List<Long> ids = grupo.stream().map(ResultadoItemLote::peticaoId).toList();
            String processo = grupo.getFirst().numeroProcesso();
            boolean sucesso = grupo.stream().allMatch(r -> RESULTADO_PROTOCOLADA.equals(r.resultado()));
            if (sucesso) {
                String mensagem = grupo.stream()
                        .map(ResultadoItemLote::mensagem)
                        .filter(StringUtils::hasText)
                        .findFirst()
                        .orElse("Protocolo concluído com sucesso.");
                protocoloEmailService.notificarSucessoProtocolo(processo, ids, mensagem);
            } else {
                String mensagem = grupo.stream()
                        .filter(r -> !RESULTADO_PROTOCOLADA.equals(r.resultado()))
                        .map(r -> "#" + r.peticaoId() + " (" + r.resultado() + "): " + r.mensagem())
                        .reduce((a, b) -> a + "\n" + b)
                        .orElse("Falha no protocolo.");
                protocoloEmailService.notificarErroProtocolo(processo, ids, mensagem);
            }
        }
    }

    /**
     * Descrição rica do erro para diagnóstico: tipo + mensagem, cadeia de causas e um trecho do
     * stack trace. Fica salvo em {@code protocolo_mensagem} (truncado) e aparece na UI para o
     * utilizador copiar e reportar.
     */
    static String descreverErroParaDiagnostico(Throwable e) {
        if (e == null) {
            return "Erro desconhecido (sem exceção).";
        }
        StringBuilder sb = new StringBuilder();
        sb.append(e.getClass().getName());
        if (StringUtils.hasText(e.getMessage())) {
            sb.append(": ").append(e.getMessage());
        }
        Throwable causa = e.getCause();
        int profundidade = 0;
        while (causa != null && causa != causa.getCause() && profundidade < 8) {
            sb.append("\n  Causa: ").append(causa.getClass().getName());
            if (StringUtils.hasText(causa.getMessage())) {
                sb.append(": ").append(causa.getMessage());
            }
            causa = causa.getCause();
            profundidade++;
        }
        // Raiz do problema costuma estar nas primeiras linhas do stack da exceção original.
        StackTraceElement[] frames = e.getStackTrace();
        if (frames != null && frames.length > 0) {
            sb.append("\n  Em:");
            int limite = Math.min(frames.length, 12);
            for (int i = 0; i < limite; i++) {
                sb.append("\n    ").append(frames[i].toString());
            }
            if (frames.length > limite) {
                sb.append("\n    ... (+").append(frames.length - limite).append(" linhas)");
            }
        }
        return sb.toString();
    }

    private static String montarMensagemErro(ResultadoProtocoloPeticao protocolo) {
        String msg = protocolo.mensagem();
        String bruta = protocolo.respostaBruta();
        if (StringUtils.hasText(bruta)) {
            if (bruta.toLowerCase().contains("pedido enviado mais de uma vez")) {
                msg = msg
                        + " — PROJUDI rejeitou pedido duplicado (token __Pedido__ já usado nesta sessão). "
                        + "Protocolize de novo; a sessão será renovada automaticamente.";
            } else {
                msg = msg + " | " + bruta;
            }
        }
        return ProjudiPeticaoProtocoloEstadoService.truncarMensagem(msg);
    }

    private void finalizarProcessoAposProtocolo(String numeroProcesso) {
        try {
            documentoPastaAssinarService.finalizarAposProtocoloSucesso(numeroProcesso);
        } catch (Exception e) {
            log.warn(
                    "Pós-protocolo (pasta Assinar / fase) falhou para processo {}: {}",
                    numeroProcesso,
                    e.getMessage());
        }
    }

    private Optional<String> validarECarregarArquivosP7s(ProjudiPeticaoEntity peticao) {
        for (ProjudiPeticaoArquivoEntity arquivo : peticao.getArquivos()) {
            if (!StringUtils.hasText(arquivo.getP7sRef())) {
                return Optional.of("arquivo ordem " + arquivo.getOrdem() + " sem p7s_ref");
            }
            Path p7sPath = storeDir.resolve(arquivo.getP7sRef());
            boolean localOk = Files.isRegularFile(p7sPath);
            boolean driveOk = StringUtils.hasText(arquivo.getP7sDriveFileId()) && googleDriveService.isConfigurado();
            if (!localOk && !driveOk) {
                return Optional.of(".p7s não encontrado: " + arquivo.getP7sRef());
            }
        }
        return Optional.empty();
    }

    private List<ArquivoPeticao> montarListaArquivosP7s(ProjudiPeticaoEntity peticao) {
        List<ArquivoPeticao> lista = new ArrayList<>(peticao.getArquivos().size());
        for (ProjudiPeticaoArquivoEntity arquivo : peticao.getArquivos()) {
            byte[] bytes = carregarP7s(arquivo);
            lista.add(new ArquivoPeticao(bytes, arquivo.getIdArquivoTipo(), arquivo.getNomeOriginal()));
        }
        return lista;
    }

    /**
     * Lê o .p7s do disco local; se faltar (ex.: recreate de container), baixa do Drive pelo
     * {@code p7sDriveFileId} e regrava no cache local. O Drive é a fonte durável.
     */
    private byte[] carregarP7s(ProjudiPeticaoArquivoEntity arquivo) {
        Path p7sPath = storeDir.resolve(arquivo.getP7sRef());
        if (Files.isRegularFile(p7sPath)) {
            try {
                return Files.readAllBytes(p7sPath);
            } catch (Exception e) {
                throw new IllegalStateException("Falha ao ler .p7s: " + p7sPath, e);
            }
        }
        if (StringUtils.hasText(arquivo.getP7sDriveFileId()) && googleDriveService.isConfigurado()) {
            try {
                byte[] bytes = googleDriveService.baixarBytesArquivo(arquivo.getP7sDriveFileId());
                if (bytes == null || bytes.length == 0) {
                    throw new IllegalStateException("Drive devolveu .p7s vazio (id=" + arquivo.getP7sDriveFileId() + ")");
                }
                try {
                    Files.createDirectories(storeDir);
                    Files.write(p7sPath, bytes);
                } catch (Exception cacheEx) {
                    log.warn("Falha ao regravar cache local do .p7s ({}): {}", p7sPath, cacheEx.getMessage());
                }
                log.info(".p7s recuperado do Drive (ref={}, driveFileId={})",
                        arquivo.getP7sRef(), arquivo.getP7sDriveFileId());
                return bytes;
            } catch (Exception e) {
                throw new IllegalStateException(
                        "Falha ao baixar .p7s do Drive (id=" + arquivo.getP7sDriveFileId() + ")", e);
            }
        }
        throw new IllegalStateException("Falha ao ler .p7s: " + p7sPath);
    }
}
