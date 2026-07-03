package br.com.vilareal.imovel.application;

import java.util.List;
import java.util.Set;

/** Critérios OR para localizar lançamentos da conta I de um nº de planilha. */
public record ImovelLancamentoFiltroCriteria(
        String numeroPlanilha,
        Set<Long> processoIds,
        Set<Long> lancamentoFinanceiroIds,
        List<String> obsPrefixos) {

    public boolean isEmpty() {
        return (numeroPlanilha == null || numeroPlanilha.isBlank())
                && (processoIds == null || processoIds.isEmpty())
                && (lancamentoFinanceiroIds == null || lancamentoFinanceiroIds.isEmpty())
                && (obsPrefixos == null || obsPrefixos.isEmpty());
    }
}
