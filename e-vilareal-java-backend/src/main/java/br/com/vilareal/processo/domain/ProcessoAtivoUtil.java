package br.com.vilareal.processo.domain;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;

/** Critério de processo «Status Ativo/Inativo» ({@code processo.ativo}) — não confundir com {@code fase}. */
public final class ProcessoAtivoUtil {

    private ProcessoAtivoUtil() {}

    /**
     * Status Ativo na UI = {@code ativo=true}. Inativo/arquivado = {@code ativo=false} (ou null legado).
     * A fase processual pode estar desatualizada; não usar {@code fase} para este guard.
     */
    public static boolean processoEstaAtivo(ProcessoEntity processo) {
        return processo != null && Boolean.TRUE.equals(processo.getAtivo());
    }
}
