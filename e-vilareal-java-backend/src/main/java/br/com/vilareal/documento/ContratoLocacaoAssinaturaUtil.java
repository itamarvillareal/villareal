package br.com.vilareal.documento;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Montagem de linhas de assinatura de fiadores no contrato de locação. */
final class ContratoLocacaoAssinaturaUtil {

    private ContratoLocacaoAssinaturaUtil() {}

    record AssinaturaFiador(String nome, String rotulo) {}

    static List<List<AssinaturaFiador>> montarParesAssinaturaFiadores(List<PessoaEntity> fiadores) {
        if (fiadores == null || fiadores.isEmpty()) {
            return List.of();
        }
        List<AssinaturaFiador> todos = new ArrayList<>();
        for (PessoaEntity f : fiadores) {
            if (f == null) {
                continue;
            }
            String nome = ContratoHonorariosClausulas.normalizarNomeAssinatura(Utf8MojibakeUtil.corrigir(f.getNome()));
            boolean feminino = QualificacaoPessoaUtil.determinarFeminino(f.getNome(), null);
            String rotulo = feminino ? "Fiadora" : "Fiador";
            todos.add(new AssinaturaFiador(nome, rotulo));
        }
        List<List<AssinaturaFiador>> pares = new ArrayList<>();
        for (int i = 0; i < todos.size(); i += 2) {
            List<AssinaturaFiador> par = new ArrayList<>();
            par.add(todos.get(i));
            if (i + 1 < todos.size()) {
                par.add(todos.get(i + 1));
            }
            pares.add(List.copyOf(par));
        }
        return List.copyOf(pares);
    }

    static List<Map<String, String>> montarVariaveisAssinaturaFiadores(List<PessoaEntity> fiadores) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (List<AssinaturaFiador> par : montarParesAssinaturaFiadores(fiadores)) {
            Map<String, String> row = new HashMap<>();
            AssinaturaFiador esq = par.get(0);
            row.put("nomeEsquerda", esq.nome());
            row.put("rotuloEsquerda", esq.rotulo());
            if (par.size() > 1) {
                AssinaturaFiador dir = par.get(1);
                row.put("nomeDireita", dir.nome());
                row.put("rotuloDireita", dir.rotulo());
            } else {
                row.put("nomeDireita", "");
                row.put("rotuloDireita", "");
            }
            rows.add(row);
        }
        return rows;
    }
}
