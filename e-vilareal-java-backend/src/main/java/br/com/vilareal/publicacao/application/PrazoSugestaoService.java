package br.com.vilareal.publicacao.application;

import br.com.vilareal.julia.domain.JuliaPrazoDateUtil;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Motor determinístico de sugestão de prazo fatal a partir do teor da publicação. */
@Service
public class PrazoSugestaoService {

    private static final int DIAS_PADRAO = 5;
    private static final DateTimeFormatter FMT_DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_DATA_BR_CURTO = DateTimeFormatter.ofPattern("dd/MM");

    private static final Pattern PAT_DIAS_UTEIS =
            Pattern.compile("(\\d+)\\s*dias?\\s*(?:úteis|uteis)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern PAT_HORAS = Pattern.compile("(\\d+)\\s*horas?", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_CONTAR_DE = Pattern.compile(
            "(?:a\\s+contar\\s+de|a\\s+partir\\s+de)\\s*(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}))?",
            Pattern.CASE_INSENSITIVE);

    public PrazoSugestaoResultado sugerir(String teor, LocalDate dataBase) {
        if (dataBase == null) {
            throw new IllegalArgumentException("dataBase é obrigatória.");
        }
        String texto = teor != null ? teor : "";

        Matcher diasMatcher = PAT_DIAS_UTEIS.matcher(texto);
        if (diasMatcher.find()) {
            int dias = Integer.parseInt(diasMatcher.group(1));
            LocalDate base = resolverDataBaseNoTeor(texto, dataBase);
            LocalDate fatal = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(JuliaPrazoDateUtil.somarDiasUteis(base, dias));
            String explicacao = dias
                    + " dias úteis a contar de "
                    + base.format(FMT_DATA_BR_CURTO)
                    + " → "
                    + fatal.format(FMT_DATA_BR_CURTO);
            return new PrazoSugestaoResultado(true, PrazoSugestaoOrigem.DIAS_UTEIS, dias, base, fatal, explicacao);
        }

        Matcher horasMatcher = PAT_HORAS.matcher(texto);
        if (horasMatcher.find()) {
            int horas = Integer.parseInt(horasMatcher.group(1));
            int dias = (int) Math.round(horas / 24.0);
            if (dias < 1) {
                dias = 1;
            }
            LocalDate base = dataBase;
            LocalDate fatal = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(JuliaPrazoDateUtil.somarDiasUteis(base, dias));
            String explicacao =
                    horas + " horas → " + dias + " dias úteis (fatal em " + fatal.format(FMT_DATA_BR) + ")";
            return new PrazoSugestaoResultado(true, PrazoSugestaoOrigem.HORAS, dias, base, fatal, explicacao);
        }

        int dias = DIAS_PADRAO;
        LocalDate base = dataBase;
        LocalDate fatal = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(JuliaPrazoDateUtil.somarDiasUteis(base, dias));
        String explicacao =
                "Prazo não identificado no teor — " + dias + " dias úteis (padrão) → " + fatal.format(FMT_DATA_BR_CURTO);
        return new PrazoSugestaoResultado(false, PrazoSugestaoOrigem.DEFAULT, dias, base, fatal, explicacao);
    }

    private LocalDate resolverDataBaseNoTeor(String texto, LocalDate dataBaseFallback) {
        Matcher m = PAT_CONTAR_DE.matcher(texto);
        if (!m.find()) {
            return dataBaseFallback;
        }
        int dia = Integer.parseInt(m.group(1));
        int mes = Integer.parseInt(m.group(2));
        int ano = StringUtils.hasText(m.group(3)) ? Integer.parseInt(m.group(3)) : dataBaseFallback.getYear();
        try {
            return LocalDate.of(ano, mes, dia);
        } catch (Exception e) {
            return dataBaseFallback;
        }
    }
}
