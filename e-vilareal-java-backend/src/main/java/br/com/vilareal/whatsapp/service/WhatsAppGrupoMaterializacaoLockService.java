package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppGrupoMaterializacaoResultDTO;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Serializa materialização de grupos WhatsApp (tick agendado e disparo manual) via ShedLock.
 */
@Service
public class WhatsAppGrupoMaterializacaoLockService {

    public static final String LOCK_NAME = "whatsapp-grupos-materializacao";
    static final Duration LOCK_AT_MOST = Duration.ofMinutes(10);
    static final Duration LOCK_AT_LEAST = Duration.ofSeconds(30);

    private final LockingTaskExecutor lockingTaskExecutor;
    private final WhatsAppGrupoMaterializacaoService materializacaoService;

    public WhatsAppGrupoMaterializacaoLockService(
            LockingTaskExecutor lockingTaskExecutor, WhatsAppGrupoMaterializacaoService materializacaoService) {
        this.lockingTaskExecutor = lockingTaskExecutor;
        this.materializacaoService = materializacaoService;
    }

    /**
     * Executa uma rodada se o lock estiver livre. Retorna vazio quando outra execução (tick ou manual)
     * já detém o lock — sem bloquear.
     */
    public Optional<WhatsAppGrupoMaterializacaoResultDTO> executarRodadaComLock() {
        try {
            LockingTaskExecutor.TaskResult<WhatsAppGrupoMaterializacaoResultDTO> result =
                    lockingTaskExecutor.executeWithLock(
                            materializacaoService::executarRodada, lockConfiguration());
            if (!result.wasExecuted()) {
                return Optional.empty();
            }
            return Optional.ofNullable(result.getResult());
        } catch (RuntimeException e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Falha ao materializar grupos WhatsApp", e);
        }
    }

    private static LockConfiguration lockConfiguration() {
        return new LockConfiguration(Instant.now(), LOCK_NAME, LOCK_AT_MOST, LOCK_AT_LEAST);
    }
}
