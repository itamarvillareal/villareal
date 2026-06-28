package br.com.vilareal.projudi;

import java.util.Locale;
import java.util.Map;

final class ProjudiUfPorExtensoUtil {

    private static final Map<String, String> UF_NOME = Map.ofEntries(
            Map.entry("AC", "Acre"),
            Map.entry("AL", "Alagoas"),
            Map.entry("AP", "Amapá"),
            Map.entry("AM", "Amazonas"),
            Map.entry("BA", "Bahia"),
            Map.entry("CE", "Ceará"),
            Map.entry("DF", "Distrito Federal"),
            Map.entry("ES", "Espírito Santo"),
            Map.entry("GO", "Goiás"),
            Map.entry("MA", "Maranhão"),
            Map.entry("MT", "Mato Grosso"),
            Map.entry("MS", "Mato Grosso do Sul"),
            Map.entry("MG", "Minas Gerais"),
            Map.entry("PA", "Pará"),
            Map.entry("PB", "Paraíba"),
            Map.entry("PR", "Paraná"),
            Map.entry("PE", "Pernambuco"),
            Map.entry("PI", "Piauí"),
            Map.entry("RJ", "Rio de Janeiro"),
            Map.entry("RN", "Rio Grande do Norte"),
            Map.entry("RS", "Rio Grande do Sul"),
            Map.entry("RO", "Rondônia"),
            Map.entry("RR", "Roraima"),
            Map.entry("SC", "Santa Catarina"),
            Map.entry("SP", "São Paulo"),
            Map.entry("SE", "Sergipe"),
            Map.entry("TO", "Tocantins"));

    private ProjudiUfPorExtensoUtil() {}

    static String nomePorSigla(String uf) {
        if (uf == null || uf.isBlank()) {
            return null;
        }
        String sigla = uf.trim().toUpperCase(Locale.ROOT);
        if (sigla.length() > 2) {
            sigla = sigla.substring(0, 2);
        }
        return UF_NOME.get(sigla);
    }

    static String siglaPorNomeExtenso(String nomeExtenso) {
        if (nomeExtenso == null || nomeExtenso.isBlank()) {
            return null;
        }
        String alvo = nomeExtenso.trim();
        for (Map.Entry<String, String> e : UF_NOME.entrySet()) {
            if (e.getValue().equalsIgnoreCase(alvo)) {
                return e.getKey();
            }
        }
        return null;
    }
}
