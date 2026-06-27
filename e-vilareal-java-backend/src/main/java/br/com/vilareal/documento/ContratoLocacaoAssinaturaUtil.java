package br.com.vilareal.documento;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Montagem das linhas de assinatura do contrato de locação (locador, locatário, fiador). */
final class ContratoLocacaoAssinaturaUtil {

    private ContratoLocacaoAssinaturaUtil() {}

    record AssinaturaParte(String nome, String rotulo) {}

    static List<Map<String, String>> montarVariaveisLinhasAssinaturaLocadorLocatario(
            PessoaEntity locador, List<PessoaEntity> locatarios) {
        List<AssinaturaParte> locadores = new ArrayList<>();
        if (locador != null) {
            locadores.add(assinaturaLocador(locador));
        }
        List<AssinaturaParte> locatarioPartes = new ArrayList<>();
        if (locatarios != null) {
            for (PessoaEntity locatario : locatarios) {
                if (locatario != null) {
                    locatarioPartes.add(assinaturaLocatario(locatario));
                }
            }
        }
        return montarVariaveisLinhas(montarGruposLocadorLocatario(locadores, locatarioPartes));
    }

    static List<Map<String, String>> montarVariaveisLinhasAssinaturaLocadorLocatario(
            List<String> nomesLocador, List<String> nomesLocatario) {
        List<AssinaturaParte> locadores = new ArrayList<>();
        if (nomesLocador != null) {
            for (String nome : nomesLocador) {
                if (StringUtils.hasText(nome)) {
                    locadores.add(new AssinaturaParte(
                            normalizarNome(nome), rotuloLocadorPorNome(nome)));
                }
            }
        }
        List<AssinaturaParte> locatarioPartes = new ArrayList<>();
        if (nomesLocatario != null) {
            for (String nome : nomesLocatario) {
                if (StringUtils.hasText(nome)) {
                    locatarioPartes.add(new AssinaturaParte(
                            normalizarNome(nome), rotuloLocatarioPorNome(nome)));
                }
            }
        }
        return montarVariaveisLinhas(montarGruposLocadorLocatario(locadores, locatarioPartes));
    }

    /**
     * Uma linha por par (máx. 2 colunas); parte ímpar sozinha fica centralizada.
     * Exceção: 1 locador + 1 locatário permanecem na mesma linha, lado a lado.
     */
    static List<List<AssinaturaParte>> montarGruposLocadorLocatario(
            List<AssinaturaParte> locadores, List<AssinaturaParte> locatarios) {
        List<AssinaturaParte> loc = locadores != null ? locadores : List.of();
        List<AssinaturaParte> inq = locatarios != null ? locatarios : List.of();
        if (loc.size() == 1 && inq.size() == 1) {
            return List.of(List.of(loc.get(0), inq.get(0)));
        }
        List<List<AssinaturaParte>> grupos = new ArrayList<>();
        grupos.addAll(distribuirEmLinhas(loc));
        grupos.addAll(distribuirEmLinhas(inq));
        return grupos;
    }

    static List<List<AssinaturaParte>> distribuirEmLinhas(List<AssinaturaParte> partes) {
        if (partes == null || partes.isEmpty()) {
            return List.of();
        }
        if (partes.size() == 1) {
            return List.of(List.of(partes.get(0)));
        }
        List<List<AssinaturaParte>> linhas = new ArrayList<>();
        for (int i = 0; i < partes.size(); i += 2) {
            if (i + 1 < partes.size()) {
                linhas.add(List.of(partes.get(i), partes.get(i + 1)));
            } else {
                linhas.add(List.of(partes.get(i)));
            }
        }
        return linhas;
    }

    static List<Map<String, String>> montarVariaveisLinhas(List<List<AssinaturaParte>> linhas) {
        List<Map<String, String>> rows = new ArrayList<>();
        if (linhas == null) {
            return rows;
        }
        for (List<AssinaturaParte> linha : linhas) {
            if (linha == null || linha.isEmpty()) {
                continue;
            }
            Map<String, String> row = new HashMap<>();
            AssinaturaParte esq = linha.get(0);
            row.put("nomeEsquerda", esq.nome());
            row.put("rotuloEsquerda", esq.rotulo());
            if (linha.size() > 1) {
                AssinaturaParte dir = linha.get(1);
                row.put("centralizada", "false");
                row.put("nomeDireita", dir.nome());
                row.put("rotuloDireita", dir.rotulo());
            } else {
                row.put("centralizada", "true");
                row.put("nomeDireita", "");
                row.put("rotuloDireita", "");
            }
            rows.add(row);
        }
        return rows;
    }

    static List<Map<String, String>> montarVariaveisAssinaturaFiadores(List<PessoaEntity> fiadores) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (List<AssinaturaParte> par : montarParesAssinaturaFiadores(fiadores)) {
            rows.add(montarVariaveisLinhas(List.of(par)).get(0));
        }
        return rows;
    }

    static List<List<AssinaturaParte>> montarParesAssinaturaFiadores(List<PessoaEntity> fiadores) {
        if (fiadores == null || fiadores.isEmpty()) {
            return List.of();
        }
        List<AssinaturaParte> todos = new ArrayList<>();
        for (PessoaEntity f : fiadores) {
            if (f == null) {
                continue;
            }
            String nome = normalizarNome(f.getNome());
            boolean feminino = QualificacaoPessoaUtil.determinarFeminino(f.getNome(), null);
            String rotulo = feminino ? "Fiadora" : "Fiador";
            todos.add(new AssinaturaParte(nome, rotulo));
        }
        return distribuirEmLinhas(todos);
    }

    private static AssinaturaParte assinaturaLocador(PessoaEntity pessoa) {
        return new AssinaturaParte(normalizarNome(pessoa.getNome()), rotuloLocadorPorNome(pessoa.getNome()));
    }

    private static AssinaturaParte assinaturaLocatario(PessoaEntity pessoa) {
        return new AssinaturaParte(normalizarNome(pessoa.getNome()), rotuloLocatarioPorNome(pessoa.getNome()));
    }

    private static String rotuloLocadorPorNome(String nome) {
        boolean feminino = QualificacaoPessoaUtil.determinarFeminino(nome, null);
        return feminino ? "Locadora" : "Locador";
    }

    private static String rotuloLocatarioPorNome(String nome) {
        boolean feminino = QualificacaoPessoaUtil.determinarFeminino(nome, null);
        return feminino ? "Locatária" : "Locatário";
    }

    private static String normalizarNome(String nome) {
        return ContratoHonorariosClausulas.normalizarNomeAssinatura(Utf8MojibakeUtil.corrigir(nome));
    }
}
