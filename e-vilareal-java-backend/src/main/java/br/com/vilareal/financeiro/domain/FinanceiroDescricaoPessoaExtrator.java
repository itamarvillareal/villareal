package br.com.vilareal.financeiro.domain;

import org.springframework.util.StringUtils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrai CPF e nome de descrições bancárias no padrão brasileiro
 * (ex.: «Pagamento recebido - Fulano de Tal - 123.456.789-00»).
 */
public final class FinanceiroDescricaoPessoaExtrator {

    private static final Pattern CPF_FORMATADO_FIM =
            Pattern.compile("(\\d{3})\\.(\\d{3})\\.(\\d{3})-(\\d{2})\\s*$");
    private static final Pattern CPF_ONZE_DIGITOS_FIM = Pattern.compile("(\\d{11})\\s*$");
    private static final Pattern NOME_ENTRE_TRACOS =
            Pattern.compile("[-–—]\\s*([^-–—\\d][^-–—]{2,}?)\\s*[-–—]\\s*\\d{3}");
    /** Ex.: «Transf Pix recebida - Fulano de Tal» (sem CPF). */
    private static final Pattern NOME_APOS_TRACO_FINAL =
            Pattern.compile("[-–—]\\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\\s'.]{7,})\\s*$");

    private FinanceiroDescricaoPessoaExtrator() {}

    public static FinanceiroDescricaoPessoaExtracao extrair(String descricao, String descricaoDetalhada) {
        String texto = ((descricao != null ? descricao : "") + " " + (descricaoDetalhada != null ? descricaoDetalhada : ""))
                .trim();
        if (!StringUtils.hasText(texto)) {
            return new FinanceiroDescricaoPessoaExtracao(null, null);
        }
        String cpf = extrairCpfDigitos(texto);
        String nome = extrairNome(texto, cpf);
        return new FinanceiroDescricaoPessoaExtracao(cpf, nome);
    }

    private static String extrairCpfDigitos(String texto) {
        Matcher mf = CPF_FORMATADO_FIM.matcher(texto);
        if (mf.find()) {
            return mf.group(1) + mf.group(2) + mf.group(3) + mf.group(4);
        }
        Matcher m11 = CPF_ONZE_DIGITOS_FIM.matcher(texto);
        if (m11.find()) {
            String d = m11.group(1);
            if (!todosDigitosIguais(d)) {
                return d;
            }
        }
        Matcher emTexto = Pattern.compile("(\\d{3})\\.(\\d{3})\\.(\\d{3})-(\\d{2})").matcher(texto);
        if (emTexto.find()) {
            return emTexto.group(1) + emTexto.group(2) + emTexto.group(3) + emTexto.group(4);
        }
        return null;
    }

    private static String extrairNome(String texto, String cpfDigitos) {
        Matcher m = NOME_ENTRE_TRACOS.matcher(texto);
        String candidato = null;
        while (m.find()) {
            String trecho = m.group(1).trim();
            if (trecho.length() >= 3 && !pareceSoNumeros(trecho)) {
                candidato = trecho;
            }
        }
        if (StringUtils.hasText(candidato)) {
            return candidato;
        }
        Matcher mFinal = NOME_APOS_TRACO_FINAL.matcher(texto);
        if (mFinal.find()) {
            String trecho = mFinal.group(1).trim();
            if (trecho.length() >= 8 && !pareceSoNumeros(trecho)) {
                return trecho;
            }
        }
        if (cpfDigitos != null) {
            int idx = texto.indexOf(cpfDigitos.substring(0, 3));
            if (idx < 0) {
                idx = texto.lastIndexOf('.');
            }
            if (idx > 0) {
                String antes = texto.substring(0, idx).trim();
                int dash = antes.lastIndexOf('-');
                if (dash >= 0 && dash < antes.length() - 1) {
                    String nome = antes.substring(dash + 1).trim();
                    if (nome.length() >= 3) {
                        return nome;
                    }
                }
            }
        }
        return null;
    }

    private static boolean pareceSoNumeros(String s) {
        return s.replaceAll("\\D", "").length() >= s.length() / 2;
    }

    private static boolean todosDigitosIguais(String d) {
        if (d == null || d.isEmpty()) {
            return true;
        }
        char c = d.charAt(0);
        for (int i = 1; i < d.length(); i++) {
            if (d.charAt(i) != c) {
                return false;
            }
        }
        return true;
    }
}
