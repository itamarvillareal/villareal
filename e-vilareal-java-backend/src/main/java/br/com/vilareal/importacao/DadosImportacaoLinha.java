package br.com.vilareal.importacao;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Linha já validada e pronta para persistência (transação isolada por linha).
 *
 * @param controleAtivoOpcional vazio = import legado (ativo só true na criação; updates não alteram ativo)
 * @param usarFaseEmAndamentoQuandoFaseVazia true = planilha clientes (L vazio → "Em Andamento")
 */
public record DadosImportacaoLinha(
        int linhaExcel,
        long clientePessoaId,
        int numeroInterno,
        Optional<String> faseOpcional,
        String numeroCnjOuNull,
        String descricaoAcaoOuNull,
        List<ParteSlot> partes,
        Optional<Boolean> controleAtivoOpcional,
        boolean usarFaseEmAndamentoQuandoFaseVazia) {

    public record ParteSlot(String polo, int ordem, long pessoaId) {}

    /** Import legado «Informacoes de processos»: fase vazia → null; grava complementar. */
    public static DadosImportacaoLinha legadoInformacoesProcessos(
            int linhaExcel,
            long clientePessoaId,
            int numeroInterno,
            Optional<String> faseOpcional,
            String numeroCnjOuNull,
            String descricaoAcaoOuNull,
            List<ParteSlot> partes) {
        return new DadosImportacaoLinha(
                linhaExcel,
                clientePessoaId,
                numeroInterno,
                faseOpcional,
                numeroCnjOuNull,
                descricaoAcaoOuNull,
                partes,
                Optional.empty(),
                false);
    }

    static List<ParteSlot> deduplicarPorPoloEPessoa(List<ParteSlot> raw) {
        record Key(String polo, long pid) {}
        Map<Key, ParteSlot> map = new LinkedHashMap<>();
        for (ParteSlot s : raw) {
            Key k = new Key(s.polo, s.pessoaId);
            ParteSlot ex = map.get(k);
            if (ex == null || s.ordem() < ex.ordem()) {
                map.put(k, s);
            }
        }
        return new ArrayList<>(map.values());
    }
}
