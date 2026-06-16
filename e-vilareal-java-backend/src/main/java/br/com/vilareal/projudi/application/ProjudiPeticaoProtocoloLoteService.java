package br.com.vilareal.projudi.application;

import br.com.vilareal.projudi.api.dto.PreviaProtocoloResponse;
import br.com.vilareal.projudi.api.dto.PreviaProtocoloResponse.ArquivoPreviaDto;
import br.com.vilareal.projudi.api.dto.PreviaProtocoloResponse.JuntadaPreviaDto;
import br.com.vilareal.projudi.api.dto.ValidarProtocoloResponse;
import br.com.vilareal.projudi.api.dto.ValidarProtocoloResponse.JuntadaValidacaoDto;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiPeticaoService;
import br.com.vilareal.projudi.ProjudiPeticaoService.ArquivoPeticao;
import br.com.vilareal.projudi.ProjudiPeticaoService.ResultadoProtocoloPeticao;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
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

@Service
public class ProjudiPeticaoProtocoloLoteService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiPeticaoProtocoloLoteService.class);

    static final String RESULTADO_PROTOCOLADA = "PROTOCOLADA";
    static final String RESULTADO_ERRO = "ERRO";
    static final String RESULTADO_IGNORADA = "IGNORADA";

    private static final Duration LOCK_PROTOCOLO_TIMEOUT = Duration.ofMinutes(5);

    private final ProjudiPeticaoRepository peticaoRepository;
    private final ProjudiPeticaoRegistroService registroService;
    private final ProjudiPeticaoService peticaoService;
    private final ProjudiPeticaoProtocoloEstadoService estadoService;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final Path storeDir;

    public ProjudiPeticaoProtocoloLoteService(
            ProjudiPeticaoRepository peticaoRepository,
            ProjudiPeticaoRegistroService registroService,
            ProjudiPeticaoService peticaoService,
            ProjudiPeticaoProtocoloEstadoService estadoService,
            ProjudiOrquestradorGate orquestradorGate,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.peticaoRepository = peticaoRepository;
        this.registroService = registroService;
        this.peticaoService = peticaoService;
        this.estadoService = estadoService;
        this.orquestradorGate = orquestradorGate;
        this.storeDir = Path.of(storeDirConfig.trim());
    }

    public record ResultadoItemLote(Long peticaoId, String numeroProcesso, String resultado, String mensagem) {}

    public List<ResultadoItemLote> protocolarLote(List<Long> peticaoIds) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new IllegalArgumentException("peticaoIds é obrigatório (ao menos um id).");
        }

        Optional<List<ResultadoItemLote>> resultado = orquestradorGate.executarComRetornoAguardando(
                "peticao/protocolar-lote", LOCK_PROTOCOLO_TIMEOUT, () -> executarLoteSequencial(peticaoIds));
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
        return registroService.listarPorProcesso(numeroProcesso).stream()
                .filter(p -> ProjudiPeticaoProtocoloEstadoService.STATUS_ASSINADA.equals(p.getStatus()))
                .map(ProjudiPeticaoEntity::getId)
                .sorted()
                .toList();
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
                referencia.getComplemento(),
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

    private List<ResultadoItemLote> executarLoteSequencial(List<Long> peticaoIds) {
        Map<Long, ResultadoItemLote> porId = new LinkedHashMap<>();
        for (List<Long> grupo : agruparPorJuntada(peticaoIds)) {
            porId.putAll(processarGrupoJuntada(grupo));
        }
        List<ResultadoItemLote> resultados = new ArrayList<>(peticaoIds.size());
        for (Long id : peticaoIds) {
            resultados.add(porId.get(id));
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

        String idsLabel = claimadas.toString();
        log.warn(
                "Protocolando juntada {} (processo={}, {} arquivo(s)) — passo Concluir é IRREVERSÍVEL.",
                idsLabel,
                referencia.getNumeroProcesso(),
                arquivosP7s.size());

        ResultadoProtocoloPeticao protocolo;
        try {
            protocolo = peticaoService.protocolarPeticao(
                    referencia.getCredencialId(),
                    referencia.getNumeroProcesso(),
                    referencia.getComplemento(),
                    arquivosP7s);
        } catch (RuntimeException e) {
            // Exceção (ex.: falha de OTP/sessão) não pode deixar a petição presa em PROTOCOLANDO:
            // devolve para ASSINADA (frame "2. Protocolar") para reenvio imediato.
            String msg = ProjudiPeticaoProtocoloEstadoService.truncarMensagem(
                    e.getClass().getSimpleName() + ": " + e.getMessage());
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

    private static String montarMensagemErro(ResultadoProtocoloPeticao protocolo) {
        String msg = protocolo.mensagem();
        String bruta = protocolo.respostaBruta();
        if (StringUtils.hasText(bruta)) {
            if (bruta.toLowerCase().contains("pedido enviado mais de uma vez")) {
                msg = msg
                        + " — PROJUDI rejeitou pedido duplicado (segunda juntada no mesmo processo). "
                        + "Se parte dos arquivos já entrou, reabra só as pendentes e protocolize novamente.";
            } else {
                msg = msg + " | " + bruta;
            }
        }
        return ProjudiPeticaoProtocoloEstadoService.truncarMensagem(msg);
    }

    private Optional<String> validarECarregarArquivosP7s(ProjudiPeticaoEntity peticao) {
        for (ProjudiPeticaoArquivoEntity arquivo : peticao.getArquivos()) {
            if (!StringUtils.hasText(arquivo.getP7sRef())) {
                return Optional.of("arquivo ordem " + arquivo.getOrdem() + " sem p7s_ref");
            }
            Path p7sPath = storeDir.resolve(arquivo.getP7sRef());
            if (!Files.isRegularFile(p7sPath)) {
                return Optional.of(".p7s não encontrado: " + arquivo.getP7sRef());
            }
        }
        return Optional.empty();
    }

    private List<ArquivoPeticao> montarListaArquivosP7s(ProjudiPeticaoEntity peticao) {
        List<ArquivoPeticao> lista = new ArrayList<>(peticao.getArquivos().size());
        for (ProjudiPeticaoArquivoEntity arquivo : peticao.getArquivos()) {
            Path p7sPath = storeDir.resolve(arquivo.getP7sRef());
            try {
                byte[] bytes = Files.readAllBytes(p7sPath);
                lista.add(new ArquivoPeticao(bytes, arquivo.getIdArquivoTipo(), arquivo.getNomeOriginal()));
            } catch (Exception e) {
                throw new IllegalStateException("Falha ao ler .p7s: " + p7sPath, e);
            }
        }
        return lista;
    }
}
