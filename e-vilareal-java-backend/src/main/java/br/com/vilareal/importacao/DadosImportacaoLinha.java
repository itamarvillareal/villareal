package br.com.vilareal.importacao;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Linha já validada e pronta para persistência (transação isolada por linha).
 */
public record DadosImportacaoLinha(
        int linhaExcel,
        long clientePessoaId,
        int numeroInterno,
        Optional<String> faseOpcional,
        String numeroCnjOuNull,
        String descricaoAcaoOuNull,
        List<ParteSlot> partes) {

    public record ParteSlot(String polo, int ordem, long pessoaId) {}

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
