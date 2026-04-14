package br.com.vilareal.condominio.planilha;

import br.com.vilareal.condominio.api.dto.PlanilhaEnderecoDto;
import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImportSupport;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Normalização de unidade e endereço (planilha de condomínio). */
public final class UnidadesProprietariosPlanilhaSupport {

    private static final Pattern TRAIL_UF = Pattern.compile("\\s*-\\s*([A-Za-z]{2})\\s*$");

    private UnidadesProprietariosPlanilhaSupport() {}

    /**
     * Torre + 3–4 dígitos → maiúsculas e 4 dígitos (ex.: {@code a-103} → {@code A-0103}), alinhado ao PDF.
     */
    public static String normalizarCodigoUnidade(String raw) {
        if (raw == null) {
            return "";
        }
        String t = raw.trim().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("^([A-ZÀ-Ü]+)-(\\d{3,4})$");
        Matcher m = p.matcher(t);
        if (m.matches()) {
            int v = Integer.parseInt(m.group(2), 10);
            return m.group(1) + "-" + String.format("%04d", v);
        }
        return t;
    }

    public static PlanilhaEnderecoDto montarEndereco(
            String cepBruto,
            String logradouro,
            String numero,
            String bairro,
            String complemento,
            String cidadeUfBruto) {
        String cep = CadastroPessoasPlanilhaImportSupport.normalizeCep(cepBruto);
        String log = CadastroPessoasPlanilhaImportSupport.truncate(safe(logradouro), 255);
        String num = CadastroPessoasPlanilhaImportSupport.truncate(safe(numero), 40);
        String bai = CadastroPessoasPlanilhaImportSupport.truncate(safe(bairro), 120);
        String comp = CadastroPessoasPlanilhaImportSupport.truncate(safe(complemento), 120);
        String cidadeUf = safe(cidadeUfBruto).trim();
        String cidade = "";
        String uf = "";
        if (!cidadeUf.isEmpty()) {
            Matcher mu = TRAIL_UF.matcher(cidadeUf);
            if (mu.find()) {
                uf = mu.group(1).toUpperCase(Locale.ROOT);
                cidade = cidadeUf.substring(0, mu.start()).trim();
            } else if (cidadeUf.length() >= 2) {
                uf = cidadeUf.substring(cidadeUf.length() - 2).toUpperCase(Locale.ROOT);
                if (uf.chars().allMatch(Character::isLetter)) {
                    cidade = cidadeUf.substring(0, cidadeUf.length() - 2).replaceAll("[-\\s]+$", "").trim();
                } else {
                    cidade = cidadeUf;
                    uf = "";
                }
            } else {
                cidade = cidadeUf;
            }
        }
        cidade = CadastroPessoasPlanilhaImportSupport.truncate(cidade, 120);
        uf = CadastroPessoasPlanilhaImportSupport.normalizeUf(uf);
        return new PlanilhaEnderecoDto(cep, log, num, bai, comp, cidadeUfBruto, cidade, uf);
    }

    /** {@code rua} = logradouro + ", " + número quando número preenchido; complemento em campo próprio. */
    public static String montarRuaParaPersistencia(PlanilhaEnderecoDto e) {
        String log = safe(e.logradouro());
        String num = safe(e.numero());
        if (!num.isEmpty()) {
            if (log.isEmpty()) {
                return CadastroPessoasPlanilhaImportSupport.truncate(num, 255);
            }
            return CadastroPessoasPlanilhaImportSupport.truncate(log + ", " + num, 255);
        }
        return CadastroPessoasPlanilhaImportSupport.truncate(log, 255);
    }

    public static List<String> splitEmailsOuVazio(String celula) {
        if (celula == null || celula.isBlank()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String part : celula.split(";")) {
            String e = CadastroPessoasPlanilhaImportSupport.normalizeEmailForStorage(part);
            if (!e.isBlank()) {
                out.add(e);
            }
        }
        return out;
    }

    public static List<String> splitTelefonesOuVazio(String... celulas) {
        List<String> out = new ArrayList<>();
        for (String celula : celulas) {
            if (celula == null || celula.isBlank()) {
                continue;
            }
            for (String part : celula.split(";")) {
                String t = CadastroPessoasPlanilhaImportSupport.truncate(part.trim(), 40);
                if (!t.isBlank()) {
                    out.add(t);
                }
            }
        }
        return out;
    }

    private static String safe(String s) {
        return s == null ? "" : s.trim();
    }
}
