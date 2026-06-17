package br.com.vilareal.processo.api.dto;

import java.util.List;

public record PrepararAssinarResultado(
        List<Long> peticaoIds, List<ResumoProcessoPrepararAssinar> resumo, int totalArquivos) {

    public record ResumoProcessoPrepararAssinar(
            String cnj,
            String codigoCliente,
            int registradas,
            int reutilizadas,
            int ignoradasJaAssinadas,
            boolean semArquivos) {}
}
