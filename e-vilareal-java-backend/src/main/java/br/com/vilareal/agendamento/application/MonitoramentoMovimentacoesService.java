package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.NovaMovimentacaoMonitoradaResponse;
import br.com.vilareal.agendamento.api.dto.ResultadoMonitoramentoResponse;
import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.ConsultaProcessoExecucaoEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.ConsultaProcessoExecucaoRepository;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.MovimentacaoMonitoradaRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import br.com.vilareal.notificacao.api.dto.NotificacaoResultado;
import br.com.vilareal.notificacao.application.NotificacaoMovimentacaoService;
import br.com.vilareal.notificacao.domain.NotificacaoEnvioStatus;
import br.com.vilareal.projudi.pipeline.ProjudiMovimentacoesListagemService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Monitor de movimentações PROJUDI (Fase 3): somente listagem F3, sem download/Drive/publicações.
 */
@Service
public class MonitoramentoMovimentacoesService {

    private static final Logger log = LoggerFactory.getLogger(MonitoramentoMovimentacoesService.class);

    private static final DateTimeFormatter DATA_HORA_PROJUDI =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private final ProjudiMovimentacoesListagemService listagemService;
    private final MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository;
    private final ProcessoRepository processoRepository;
    private final ConsultaProcessoExecucaoRepository consultaProcessoExecucaoRepository;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final NotificacaoMovimentacaoService notificacaoMovimentacaoService;
    private final br.com.vilareal.citacao.application.CitacaoAutoLinkService citacaoAutoLinkService;
    private final Clock clock;
    private final Long credencialIdPadrao;

    public MonitoramentoMovimentacoesService(
            ProjudiMovimentacoesListagemService listagemService,
            MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository,
            ProcessoRepository processoRepository,
            ConsultaProcessoExecucaoRepository consultaProcessoExecucaoRepository,
            ProjudiOrquestradorGate orquestradorGate,
            NotificacaoMovimentacaoService notificacaoMovimentacaoService,
            br.com.vilareal.citacao.application.CitacaoAutoLinkService citacaoAutoLinkService,
            Clock clock,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao) {
        this.listagemService = listagemService;
        this.movimentacaoMonitoradaRepository = movimentacaoMonitoradaRepository;
        this.processoRepository = processoRepository;
        this.consultaProcessoExecucaoRepository = consultaProcessoExecucaoRepository;
        this.orquestradorGate = orquestradorGate;
        this.notificacaoMovimentacaoService = notificacaoMovimentacaoService;
        this.citacaoAutoLinkService = citacaoAutoLinkService;
        this.clock = clock;
        this.credencialIdPadrao = credencialIdPadrao;
    }

    @Transactional
    public ResultadoMonitoramentoResponse monitorarProcesso(Long processoId) {
        LocalDateTime iniciada = agora();
        ProcessoEntity processo = carregarProcesso(processoId);

        Optional<ResultadoMonitoramentoResponse> resultado = orquestradorGate.tryExecutarComRetorno(
                "monitorar-processo-" + processoId,
                () -> executarMonitoramento(processo, OrigemConsulta.MANUAL, null));
        if (resultado.isEmpty()) {
            return registrarPuladaOcupado(processo, iniciada, OrigemConsulta.MANUAL, null);
        }
        return resultado.get();
    }

    /**
     * Núcleo do monitor (sem gate): listagem F3, baseline/novidade, execução e persistência.
     */
    @Transactional
    public ResultadoMonitoramentoResponse executarMonitoramento(
            ProcessoEntity processo, OrigemConsulta origem, Long agendamentoId) {
        validarProcessoComCnj(processo);
        // Recarrega o processo anexado à transação atual (com cliente+pessoa). No caminho agendado, o
        // scheduler passa um proxy de outra sessão já fechada; sem isto, montar o e-mail de novidade
        // estoura LazyInitializationException ("could not initialize proxy [Cliente#...] - no session")
        // e a movimentação fica "Com novidade" mas o e-mail não sai.
        if (processo.getId() != null) {
            processo = processoRepository
                    .findByIdWithClienteAndPessoa(processo.getId())
                    .orElse(processo);
        }
        LocalDateTime iniciada = agora();
        Long processoId = processo.getId();
        String numeroCnj = processo.getNumeroCnj().trim();
        boolean baseline = movimentacaoMonitoradaRepository.countByProcessoId(processoId) == 0;
        LocalDateTime dataConsulta = agora();

        List<MovimentacaoProjudi> movs;
        try {
            movs = listagemService.listarMovimentacoesComFallbackReduzido(credencialIdPadrao, numeroCnj);
        } catch (Exception e) {
            return registrarErro(processo, iniciada, baseline, origem, agendamentoId, e);
        }

        Set<String> idMoviVistos = new HashSet<>();
        for (MovimentacaoMonitoradaEntity existente : movimentacaoMonitoradaRepository.findByProcessoId(processoId)) {
            if (StringUtils.hasText(existente.getIdMovi())) {
                idMoviVistos.add(existente.getIdMovi().trim());
            }
        }

        List<MovimentacaoProjudi> novasParaPersistir = new ArrayList<>();
        for (MovimentacaoProjudi mov : movs) {
            String idMovi = idMoviNormalizado(mov);
            if (idMovi == null || idMoviVistos.contains(idMovi)) {
                continue;
            }
            novasParaPersistir.add(mov);
            idMoviVistos.add(idMovi);
        }

        List<NovaMovimentacaoMonitoradaResponse> novasDto = new ArrayList<>();
        List<MovimentacaoMonitoradaEntity> novasPersistidas = new ArrayList<>();
        for (MovimentacaoProjudi mov : novasParaPersistir) {
            MovimentacaoMonitoradaEntity entity = new MovimentacaoMonitoradaEntity();
            entity.setProcesso(processo);
            entity.setIdMovi(idMoviNormalizado(mov));
            entity.setNumero(parseNumero(mov.numero()));
            entity.setLegenda(montarLegenda(mov.tipo(), mov.descricao()));
            entity.setDataMovimentacao(parseDataHoraProjudi(mov.dataHora()));
            entity.setDataConsulta(dataConsulta);
            movimentacaoMonitoradaRepository.save(entity);
            novasPersistidas.add(entity);

            if (!baseline) {
                citacaoAutoLinkService.processarNovaMovimentacao(entity.getId());
            }

            if (!baseline) {
                novasDto.add(NovaMovimentacaoMonitoradaResponse.builder()
                        .numero(mov.numero())
                        .legenda(entity.getLegenda())
                        .dataMovimentacao(entity.getDataMovimentacao())
                        .idMovi(entity.getIdMovi())
                        .build());
            }
        }

        int totalListadas = movs.size();
        int novasReais = baseline ? 0 : novasParaPersistir.size();
        StatusExecucao status = resolverStatus(baseline, novasReais);
        LocalDateTime finalizada = agora();
        String detalhes = montarDetalhes(totalListadas, novasReais, baseline);

        NotificacaoResultado notificacao = NotificacaoResultado.naoAplicavel();
        LocalDateTime notificacaoEm = null;
        if (!baseline && novasReais > 0) {
            notificacao = notificacaoMovimentacaoService.notificarNovidade(processo, novasPersistidas);
            notificacaoEm = agora();
        }

        ConsultaProcessoExecucaoEntity execucao = gravarExecucao(
                processo,
                iniciada,
                finalizada,
                status,
                novasReais,
                totalListadas - novasReais,
                null,
                detalhes,
                origem,
                agendamentoId,
                notificacao,
                notificacaoEm);

        return ResultadoMonitoramentoResponse.builder()
                .processoId(processoId)
                .numeroCnj(numeroCnj)
                .totalListadas(totalListadas)
                .baseline(baseline)
                .novas(novasReais)
                .novasMovimentacoes(List.copyOf(novasDto))
                .status(status)
                .execucaoId(execucao.getId())
                .build();
    }

    /**
     * Registra falha sem listagem PROJUDI (ex.: warm-up/login da rodada agendada).
     */
    @Transactional
    public ResultadoMonitoramentoResponse registrarFalhaAgendada(
            ProcessoEntity processo, Long agendamentoId, String mensagemErro) {
        validarProcessoComCnj(processo);
        LocalDateTime iniciada = agora();
        LocalDateTime finalizada = agora();
        String msg = mensagemErro != null ? mensagemErro : "erro desconhecido";
        String detalhes = "Monitor: falha no login/warm-up: " + msg;
        ConsultaProcessoExecucaoEntity execucao = gravarExecucao(
                processo,
                iniciada,
                finalizada,
                StatusExecucao.ERRO,
                0,
                0,
                msg,
                detalhes,
                OrigemConsulta.AGENDADA,
                agendamentoId,
                NotificacaoResultado.naoAplicavel(),
                null);
        return ResultadoMonitoramentoResponse.builder()
                .processoId(processo.getId())
                .numeroCnj(processo.getNumeroCnj().trim())
                .totalListadas(0)
                .baseline(false)
                .novas(0)
                .novasMovimentacoes(List.of())
                .status(StatusExecucao.ERRO)
                .execucaoId(execucao.getId())
                .erro(msg)
                .build();
    }

    private ResultadoMonitoramentoResponse registrarPuladaOcupado(
            ProcessoEntity processo,
            LocalDateTime iniciada,
            OrigemConsulta origem,
            Long agendamentoId) {
        LocalDateTime finalizada = agora();
        ConsultaProcessoExecucaoEntity execucao = gravarExecucao(
                processo,
                iniciada,
                finalizada,
                StatusExecucao.PULADA_OCUPADO,
                0,
                0,
                null,
                "Monitor: robô PROJUDI ocupado (single-flight).",
                origem,
                agendamentoId,
                NotificacaoResultado.naoAplicavel(),
                null);

        return ResultadoMonitoramentoResponse.builder()
                .processoId(processo.getId())
                .numeroCnj(processo.getNumeroCnj())
                .totalListadas(0)
                .baseline(false)
                .novas(0)
                .novasMovimentacoes(List.of())
                .status(StatusExecucao.PULADA_OCUPADO)
                .execucaoId(execucao.getId())
                .build();
    }

    private ResultadoMonitoramentoResponse registrarErro(
            ProcessoEntity processo,
            LocalDateTime iniciada,
            boolean baseline,
            OrigemConsulta origem,
            Long agendamentoId,
            Exception e) {
        LocalDateTime finalizada = agora();
        String mensagem = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        ConsultaProcessoExecucaoEntity execucao = gravarExecucao(
                processo,
                iniciada,
                finalizada,
                StatusExecucao.ERRO,
                0,
                0,
                mensagem,
                "Monitor: falha na listagem PROJUDI (baseline=" + baseline + ").",
                origem,
                agendamentoId,
                NotificacaoResultado.naoAplicavel(),
                null);

        return ResultadoMonitoramentoResponse.builder()
                .processoId(processo.getId())
                .numeroCnj(processo.getNumeroCnj())
                .totalListadas(0)
                .baseline(baseline)
                .novas(0)
                .novasMovimentacoes(List.of())
                .status(StatusExecucao.ERRO)
                .execucaoId(execucao.getId())
                .erro(mensagem)
                .build();
    }

    private ConsultaProcessoExecucaoEntity gravarExecucao(
            ProcessoEntity processo,
            LocalDateTime iniciada,
            LocalDateTime finalizada,
            StatusExecucao status,
            int teoresNovos,
            int teoresJaExistentes,
            String erro,
            String detalhes,
            OrigemConsulta origem,
            Long agendamentoId,
            NotificacaoResultado notificacao,
            LocalDateTime notificacaoEm) {
        ConsultaProcessoExecucaoEntity execucao = new ConsultaProcessoExecucaoEntity();
        execucao.setProcesso(processo);
        if (agendamentoId != null) {
            AgendamentoConsultaEntity agRef = new AgendamentoConsultaEntity();
            agRef.setId(agendamentoId);
            execucao.setAgendamento(agRef);
        } else {
            execucao.setAgendamento(null);
        }
        execucao.setOrigem(origem != null ? origem : OrigemConsulta.MANUAL);
        execucao.setIniciadaEm(iniciada);
        execucao.setFinalizadaEm(finalizada);
        execucao.setDuracaoMs(Duration.between(iniciada, finalizada).toMillis());
        execucao.setStatus(status);
        execucao.setTeoresNovos(teoresNovos);
        execucao.setTeoresJaExistentes(teoresJaExistentes);
        execucao.setArquivosBaixados(0);
        execucao.setErro(erro);
        execucao.setDetalhes(detalhes);
        if (notificacao != null) {
            execucao.setNotificacaoStatus(notificacao.status());
            execucao.setNotificacaoDestinatarios(notificacao.destinatarios());
            execucao.setNotificacaoErro(notificacao.erro());
            if (notificacao.status() != NotificacaoEnvioStatus.NAO_APLICAVEL) {
                execucao.setNotificacaoEm(notificacaoEm);
            }
        }
        return consultaProcessoExecucaoRepository.save(execucao);
    }

    private ProcessoEntity carregarProcesso(Long processoId) {
        ProcessoEntity processo = processoRepository
                .findByIdWithClienteAndPessoa(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        validarProcessoComCnj(processo);
        return processo;
    }

    private static void validarProcessoComCnj(ProcessoEntity processo) {
        if (!StringUtils.hasText(processo.getNumeroCnj())) {
            throw new BusinessRuleException("Processo sem número CNJ — não é possível consultar o PROJUDI.");
        }
    }

    private LocalDateTime agora() {
        return clock.instant().atZone(clock.getZone()).toLocalDateTime();
    }

    private static StatusExecucao resolverStatus(boolean baseline, int novasReais) {
        if (baseline || novasReais == 0) {
            return StatusExecucao.SUCESSO_SEM_NOVIDADE;
        }
        return StatusExecucao.SUCESSO_COM_NOVIDADE;
    }

    private static String montarDetalhes(int totalListadas, int novasReais, boolean baseline) {
        return "Monitor: " + totalListadas + " listadas, " + novasReais + " novas, baseline=" + baseline;
    }

    private static String idMoviNormalizado(MovimentacaoProjudi mov) {
        if (!StringUtils.hasText(mov.idMovi())) {
            return null;
        }
        return mov.idMovi().trim();
    }

    private static Integer parseNumero(String numero) {
        if (!StringUtils.hasText(numero)) {
            return null;
        }
        try {
            return Integer.parseInt(numero.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String montarLegenda(String tipo, String descricao) {
        String t = StringUtils.hasText(tipo) ? tipo.trim() : "";
        String d = StringUtils.hasText(descricao) ? descricao.trim() : "";
        String legenda;
        if (!t.isEmpty() && !d.isEmpty()) {
            legenda = t + " - " + d;
        } else if (!t.isEmpty()) {
            legenda = t;
        } else if (!d.isEmpty()) {
            legenda = d;
        } else {
            return null;
        }
        return legenda.length() <= 1000 ? legenda : legenda.substring(0, 1000);
    }

    private static LocalDateTime parseDataHoraProjudi(String dataHora) {
        if (!StringUtils.hasText(dataHora)) {
            return null;
        }
        try {
            return LocalDateTime.parse(dataHora.trim(), DATA_HORA_PROJUDI);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
