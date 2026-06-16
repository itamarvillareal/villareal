package br.com.vilareal.projudi;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;

/**
 * Dispara o robô PROJUDI em modo somente Drive após importação de e-mail PROJUDI
 * com vínculo automático por CNJ. Assíncrono e não-fatal.
 */
@Service
public class ProjudiEmailTriggerService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiEmailTriggerService.class);

    private final boolean enabled;
    private final Long credencialIdPadrao;
    private final ProjudiOrquestradorGate gate;
    private final ProjudiOrquestradorService orquestradorService;
    private final ProjudiSessionService sessionService;
    private final ExecutorService executor;

    public ProjudiEmailTriggerService(
            @Value("${projudi.email-trigger.enabled:false}") boolean enabled,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao,
            ProjudiOrquestradorGate gate,
            ProjudiOrquestradorService orquestradorService,
            ProjudiSessionService sessionService,
            @Qualifier("projudiEmailTriggerExecutor") ExecutorService executor) {
        this.enabled = enabled;
        this.credencialIdPadrao = credencialIdPadrao;
        this.gate = gate;
        this.orquestradorService = orquestradorService;
        this.sessionService = sessionService;
        this.executor = executor;
    }

    public void registrarCnjParaDisparo(Set<String> coletados, String cnj) {
        if (!enabled || cnj == null || cnj.isBlank()) {
            return;
        }
        coletados.add(cnj.trim().toUpperCase());
    }

    public void agendarDisparoAssincrono(Set<String> cnjs) {
        if (!enabled || cnjs == null || cnjs.isEmpty()) {
            return;
        }
        Set<String> batch = Set.copyOf(cnjs);
        executor.execute(() -> executarDisparo(batch));
    }

    private void executarDisparo(Set<String> cnjs) {
        try {
            if (gate.haPrioridadeAguardando()) {
                log.info(
                        "robô PROJUDI: cedendo a operação prioritária do utilizador, adiando disparo por e-mail de {} CNJ(s)",
                        cnjs.size());
                return;
            }
            if (!gate.tryLock()) {
                for (String cnj : cnjs) {
                    log.info("robô PROJUDI ocupado, pulando CNJ {}", cnj);
                }
                return;
            }
            try {
                log.info("Disparo PROJUDI por e-mail: {} CNJ(s) distintos", cnjs.size());
                try {
                    sessionService.getSessao(credencialIdPadrao);
                } catch (Exception e) {
                    log.warn("Disparo PROJUDI por e-mail: falha ao obter sessão: {}", e.getMessage());
                }
                List<String> lista = new ArrayList<>(cnjs);
                for (int idx = 0; idx < lista.size(); idx++) {
                    String cnj = lista.get(idx);
                    // Prioridade do utilizador (ex.: protocolo): cede o robô entre CNJs em vez de
                    // segurar o lock pelo lote inteiro. Os CNJs restantes reentram no próximo ciclo.
                    if (gate.haPrioridadeAguardando()) {
                        List<String> pendentes = lista.subList(idx, lista.size());
                        log.info(
                                "Disparo PROJUDI por e-mail cedendo ao protocolo do utilizador; {} CNJ(s) reagendado(s): {}",
                                pendentes.size(),
                                pendentes);
                        break;
                    }
                    try {
                        List<String> detalhes = new ArrayList<>();
                        ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado =
                                orquestradorService.executarSomenteDrivePorCnj(
                                        credencialIdPadrao, cnj, detalhes);
                        if (resultado.erro() != null) {
                            log.warn("Disparo PROJUDI por e-mail CNJ {}: {}", cnj, resultado.erro());
                        } else {
                            log.info(
                                    "Disparo PROJUDI por e-mail CNJ {}: arquivosBaixados={}",
                                    cnj,
                                    resultado.arquivosBaixados());
                        }
                    } catch (Exception e) {
                        log.warn("Disparo PROJUDI por e-mail falhou para CNJ {}: {}", cnj, e.getMessage());
                    }
                }
            } finally {
                gate.unlock();
            }
        } catch (Exception e) {
            log.warn("Disparo PROJUDI por e-mail falhou: {}", e.getMessage());
        }
    }
}
