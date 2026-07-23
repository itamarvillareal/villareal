package br.com.vilareal.processo.copiaidle.application;

import br.com.vilareal.jobrun.application.JobRunContext;
import br.com.vilareal.pje.application.PjeCopiaIntegralPorProcessoService;
import br.com.vilareal.pje.application.PjeCopiaIntegralResult;
import br.com.vilareal.pje.application.PjeTribunalCnjResolver;
import br.com.vilareal.processo.api.dto.ProcessoProjudiMovimentacoesDriveResponse;
import br.com.vilareal.processo.application.ProcessoProjudiMovimentacoesDriveService;
import br.com.vilareal.processo.application.ProcessoTramitacaoService;
import br.com.vilareal.processo.copiaidle.config.CopiaMovimentacoesClienteIdleProperties;
import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesCampanhaStatus;
import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesItemStatus;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity.CopiaMovimentacoesClienteCampanhaEntity;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity.CopiaMovimentacoesClienteItemEntity;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.repository.CopiaMovimentacoesClienteItemRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiSessionService;
import br.com.vilareal.robot.RobotGlobalLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Campanha de cópia de movimentações por cliente: <b>só executa com robôs ociosos</b>
 * (PROJUDI + PJe), um processo por tick, retomável ao longo de vários dias.
 */
@Service
public class CopiaMovimentacoesClienteIdleService {

    private static final Logger log = LoggerFactory.getLogger(CopiaMovimentacoesClienteIdleService.class);

    private final CopiaMovimentacoesClienteIdleProperties properties;
    private final CopiaMovimentacoesClienteIdleStore store;
    private final CopiaMovimentacoesClienteItemRepository itemRepository;
    private final ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService;
    private final PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService;
    private final ProjudiOrquestradorGate projudiGate;
    private final RobotGlobalLock robotGlobalLock;
    private final ProjudiSessionService sessionService;
    private final Clock clock;
    private final Long credencialIdPadrao;

    public CopiaMovimentacoesClienteIdleService(
            CopiaMovimentacoesClienteIdleProperties properties,
            CopiaMovimentacoesClienteIdleStore store,
            CopiaMovimentacoesClienteItemRepository itemRepository,
            ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService,
            PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService,
            ProjudiOrquestradorGate projudiGate,
            RobotGlobalLock robotGlobalLock,
            ProjudiSessionService sessionService,
            Clock clock,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao) {
        this.properties = properties;
        this.store = store;
        this.itemRepository = itemRepository;
        this.projudiMovimentacoesDriveService = projudiMovimentacoesDriveService;
        this.pjeCopiaIntegralPorProcessoService = pjeCopiaIntegralPorProcessoService;
        this.projudiGate = projudiGate;
        this.robotGlobalLock = robotGlobalLock;
        this.sessionService = sessionService;
        this.clock = clock;
        this.credencialIdPadrao = credencialIdPadrao;
    }

    public boolean estaNaJanelaMadrugada() {
        ZoneId zone = zone();
        LocalTime agora = LocalTime.now(clock.withZone(zone));
        int hora = agora.getHour();
        int inicio = properties.getHoraInicio();
        int fim = properties.getHoraFim();
        if (inicio == fim) {
            return true;
        }
        if (inicio < fim) {
            return hora >= inicio && hora < fim;
        }
        return hora >= inicio || hora < fim;
    }

    /** Sistema idle: ambos os locks livres e sem prioridade de utilizador. */
    public boolean sistemaOcioso() {
        return projudiGate.estaOcioso() && robotGlobalLock.estaOcioso();
    }

    /**
     * Um tick: sincroniza fila, processa no máximo 1 item se idle, e envia e-mail se concluiu.
     */
    public void executarTick(JobRunContext jobCtx) {
        String codigo = normalizarCodigoCliente(properties.getCodigoCliente());
        if (!StringUtils.hasText(codigo)) {
            log.warn("Cópia idle: codigo-cliente vazio — tick ignorado.");
            return;
        }
        if (!estaNaJanelaMadrugada()) {
            return;
        }
        if (!sistemaOcioso()) {
            log.debug("Cópia idle: sistema ocupado — tick pulado.");
            return;
        }

        CopiaMovimentacoesClienteCampanhaEntity campanha = store.garantirCampanhaComItens(codigo);
        if (campanha.getStatus() == CopiaMovimentacoesCampanhaStatus.CONCLUIDA) {
            if (campanha.getEmailEnviadoEm() == null) {
                store.tentarEnviarEmailConclusao(campanha.getId());
            }
            return;
        }

        Optional<CopiaMovimentacoesClienteItemEntity> proximo =
                itemRepository
                        .findProximosPorStatus(
                                campanha.getId(),
                                List.of(CopiaMovimentacoesItemStatus.PENDENTE),
                                PageRequest.of(0, 1))
                        .stream()
                        .findFirst();

        if (proximo.isEmpty()) {
            concluirENotificar(campanha.getId());
            return;
        }

        if (!sistemaOcioso()) {
            log.debug("Cópia idle: sistema ocupou-se antes do item — tick pulado.");
            return;
        }

        CopiaMovimentacoesClienteItemEntity item = proximo.get();
        if (jobCtx != null) {
            jobCtx.putMetadata("processoId", item.getProcesso().getId());
            jobCtx.putMetadata("codigoCliente", codigo);
        }

        processarUmItemComGate(item);

        if (jobCtx != null) {
            jobCtx.setItemsProcessed(1);
        }

        store.atualizarContadores(campanha.getId());
        long pendentes =
                itemRepository.countByCampanha_IdAndStatus(
                        campanha.getId(), CopiaMovimentacoesItemStatus.PENDENTE);
        if (pendentes == 0) {
            concluirENotificar(campanha.getId());
        }
    }

    private void concluirENotificar(Long campanhaId) {
        store.marcarCampanhaConcluida(campanhaId);
        store.tentarEnviarEmailConclusao(campanhaId);
    }

    private void processarUmItemComGate(CopiaMovimentacoesClienteItemEntity itemRef) {
        Long itemId = itemRef.getId();
        ProcessoEntity processo = itemRef.getProcesso();
        String tram = ProcessoTramitacaoService.normalizarTramitacao(processo.getTramitacao());
        boolean pje = ProcessoTramitacaoService.ehPje(tram)
                || (tram == null
                        && StringUtils.hasText(processo.getNumeroCnj())
                        && PjeTribunalCnjResolver.cnjEhTrt18(processo.getNumeroCnj().trim()));

        if (pje) {
            AtomicReference<Optional<PjeCopiaIntegralResult>> resultado = new AtomicReference<>();
            boolean pegou = robotGlobalLock.tryExecutar(
                    "copia-movimentacoes-cliente-idle-pje",
                    () -> {
                        if (!projudiGate.estaOcioso()) {
                            return;
                        }
                        resultado.set(pjeCopiaIntegralPorProcessoService.executarPorCnj(
                                processo.getNumeroCnj().trim(), processo.getPjeGrau()));
                    });
            if (!pegou) {
                log.debug("Cópia idle: PJe lock ocupado — item {} adiado.", itemId);
                return;
            }
            if (resultado.get() == null) {
                log.debug("Cópia idle: passagem PJe abortada (não-idle) — item {} adiado.", itemId);
                return;
            }
            store.aplicarResultadoPje(itemId, resultado.get());
            return;
        }

        AtomicReference<ProcessoProjudiMovimentacoesDriveResponse> resposta = new AtomicReference<>();
        boolean pegou = projudiGate.tryExecutar(
                "copia-movimentacoes-cliente-idle-projudi",
                () -> {
                    if (!robotGlobalLock.estaOcioso() || projudiGate.haPrioridadeAguardando()) {
                        return;
                    }
                    try {
                        sessionService.getSessao(credencialIdPadrao);
                    } catch (Exception e) {
                        log.warn("Cópia idle: falha ao aquecer sessão PROJUDI: {}", e.getMessage());
                    }
                    if (projudiGate.haPrioridadeAguardando()) {
                        return;
                    }
                    resposta.set(projudiMovimentacoesDriveService.executar(processo.getId()));
                });
        if (!pegou) {
            log.debug("Cópia idle: PROJUDI lock ocupado — item {} adiado.", itemId);
            return;
        }
        if (resposta.get() == null) {
            log.debug("Cópia idle: passagem Projudi abortada (não-idle) — item {} adiado.", itemId);
            return;
        }
        store.aplicarResultadoProjudi(itemId, resposta.get());
    }

    static String normalizarCodigoCliente(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String digits = raw.trim().replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return null;
        }
        if (digits.length() >= 8) {
            return digits.substring(digits.length() - 8);
        }
        return String.format("%8s", digits).replace(' ', '0');
    }

    private ZoneId zone() {
        return ZoneId.of(StringUtils.hasText(properties.getZone()) ? properties.getZone() : "America/Sao_Paulo");
    }
}
