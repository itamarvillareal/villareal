package br.com.vilareal.jobrun.application;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Contexto mutável de uma execução rastreada (métricas + heartbeat).
 */
public class JobRunContext {

    private final Long runId;
    private final JobRunTracker tracker;
    private final Map<String, Object> metadata = new LinkedHashMap<>();
    private int itemsProcessed;
    private int itemsFailed;

    JobRunContext(Long runId, JobRunTracker tracker) {
        this.runId = runId;
        this.tracker = tracker;
    }

    public Long runId() {
        return runId;
    }

    public void heartbeat() {
        tracker.heartbeat(runId);
    }

    /** Heartbeat a cada {@code a cadaItens} itens processados. */
    public void heartbeatACadaItens(int contador, int aCadaItens) {
        if (aCadaItens > 0 && contador > 0 && contador % aCadaItens == 0) {
            heartbeat();
        }
    }

    public void setItemsProcessed(int itemsProcessed) {
        this.itemsProcessed = Math.max(0, itemsProcessed);
    }

    public void addItemsProcessed(int delta) {
        if (delta > 0) {
            this.itemsProcessed += delta;
        }
    }

    public void setItemsFailed(int itemsFailed) {
        this.itemsFailed = Math.max(0, itemsFailed);
    }

    public void addItemsFailed(int delta) {
        if (delta > 0) {
            this.itemsFailed += delta;
        }
    }

    public void putMetadata(String key, Object value) {
        if (key != null && value != null) {
            metadata.put(key, value);
        }
    }

    public void putMetadata(Map<String, ?> extras) {
        if (extras != null) {
            extras.forEach(this::putMetadata);
        }
    }

    public int itemsProcessed() {
        return itemsProcessed;
    }

    public int itemsFailed() {
        return itemsFailed;
    }

    public Map<String, Object> metadata() {
        return metadata;
    }

    /**
     * Executa bloco longo atualizando heartbeat periodicamente (por tempo).
     */
    public <T> T comHeartbeatPeriodico(Supplier<T> bloco) {
        return tracker.executarComHeartbeatPeriodico(runId, bloco);
    }
}
