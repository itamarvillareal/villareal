package br.com.vilareal.api.monitoring.datajud;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolve índice Elasticsearch (alias CNJ) a partir do número CNJ normalizado.
 * Cobertura alinhada ao front (publicacoesCnjTribunal); expandir conforme necessidade.
 */
@Component
public class DatajudTribunalResolver {

    private static final Pattern CNJ = Pattern.compile(
            "^(\\d{7})-(\\d{2})\\.(\\d{4})\\.(\\d)\\.(\\d{2})\\.(\\d{4})$",
            Pattern.CASE_INSENSITIVE);

    private static final Map<String, DatajudTribunalInfo> TJ = Map.ofEntries(
            Map.entry("8.07", new DatajudTribunalInfo("TJDFT", "Tribunal de Justiça do DF e Territórios", "api_publica_tjdft")),
            Map.entry("8.09", new DatajudTribunalInfo("TJGO", "Tribunal de Justiça de Goiás", "api_publica_tjgo")),
            Map.entry("8.26", new DatajudTribunalInfo("TJSP", "Tribunal de Justiça de São Paulo", "api_publica_tjsp")),
            Map.entry("8.13", new DatajudTribunalInfo("TJMG", "Tribunal de Justiça de Minas Gerais", "api_publica_tjmg")),
            Map.entry("8.19", new DatajudTribunalInfo("TJRJ", "Tribunal de Justiça do Rio de Janeiro", "api_publica_tjrj")),
            Map.entry("8.05", new DatajudTribunalInfo("TJBA", "Tribunal de Justiça da Bahia", "api_publica_tjba")),
            Map.entry("8.24", new DatajudTribunalInfo("TJSC", "Tribunal de Justiça de Santa Catarina", "api_publica_tjsc")),
            Map.entry("8.43", new DatajudTribunalInfo("TJRS", "Tribunal de Justiça do Rio Grande do Sul", "api_publica_tjrs"))
    );

    public Optional<DatajudTribunalInfo> resolveByCnj(String cnjNormalizado) {
        if (cnjNormalizado == null || cnjNormalizado.isBlank()) {
            return Optional.empty();
        }
        String s = cnjNormalizado.trim().toUpperCase(Locale.ROOT);
        Matcher m = CNJ.matcher(s);
        if (!m.matches()) {
            return Optional.empty();
        }
        String j = m.group(4);
        String tr = m.group(5);
        String key = j + "." + tr;
        if ("8".equals(j)) {
            DatajudTribunalInfo tj = TJ.get(key);
            if (tj != null) {
                return Optional.of(tj);
            }
            return Optional.of(new DatajudTribunalInfo("TJ?(" + tr + ")", "TJ não mapeado para API local", null));
        }
        if ("5".equals(j)) {
            int n = Integer.parseInt(tr);
            if (n >= 1 && n <= 24) {
                String num = String.format("%02d", n);
                return Optional.of(new DatajudTribunalInfo("TRT" + num, "TRT " + num + "ª Região", "api_publica_trt" + n));
            }
        }
        return Optional.of(new DatajudTribunalInfo("J" + j + ".TR" + tr, "Segmento não mapeado", null));
    }

    /** Lista tribunais com índice configurado (para UI de preferências). */
    public List<DatajudTribunalInfo> listSupportedWithIndex() {
        List<DatajudTribunalInfo> out = new ArrayList<>(TJ.values());
        for (int n = 1; n <= 24; n++) {
            String num = String.format("%02d", n);
            out.add(new DatajudTribunalInfo("TRT" + num, "TRT " + n + "ª Região", "api_publica_trt" + n));
        }
        out.sort(Comparator.comparing(DatajudTribunalInfo::sigla));
        return out;
    }
}
