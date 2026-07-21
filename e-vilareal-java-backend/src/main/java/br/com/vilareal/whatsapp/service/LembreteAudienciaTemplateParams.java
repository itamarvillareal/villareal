package br.com.vilareal.whatsapp.service;

import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Monta parâmetros dos templates Meta {@code lembrete_audiencia} (3 vars) e {@code lembrete_audiencia_link} (4 vars). */
public final class LembreteAudienciaTemplateParams {

    public static final String TEMPLATE_PADRAO = "lembrete_audiencia";
    public static final String TEMPLATE_COM_LINK = "lembrete_audiencia_link";

    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");

    private LembreteAudienciaTemplateParams() {}

    public static boolean isTemplateLembreteAudiencia(String templateName) {
        if (!StringUtils.hasText(templateName)) {
            return false;
        }
        String n = templateName.trim();
        return TEMPLATE_PADRAO.equals(n) || TEMPLATE_COM_LINK.equals(n);
    }

    public static Set<String> nomesTemplates() {
        return Set.of(TEMPLATE_PADRAO, TEMPLATE_COM_LINK);
    }

    /**
     * @param nomeDestinatario nome para saudação ({{1}})
     * @param numeroProcesso CNJ ou identificador do processo
     * @param parteCliente texto da parte cliente no processo
     * @param parteAutora texto da parte autora no processo
     * @param dataAudiencia instante da audiência
     * @param linkReuniao link da reunião virtual; quando informado usa template com 4 variáveis
     */
    public static List<String> montar(
            String nomeDestinatario,
            String numeroProcesso,
            String parteCliente,
            String parteAutora,
            Instant dataAudiencia,
            String linkReuniao) {
        List<String> params = new ArrayList<>(4);
        params.add(textoOuFallback(nomeDestinatario, "Cliente"));
        params.add(formatParamProcesso(numeroProcesso, parteCliente, parteAutora));
        params.add(formatarDataHoraBR(dataAudiencia));
        if (StringUtils.hasText(linkReuniao)) {
            params.add(linkReuniao.trim());
        }
        return List.copyOf(params);
    }

    public static List<String> montar(
            String nomeDestinatario,
            String numeroProcesso,
            String parteCliente,
            String parteAutora,
            Instant dataAudiencia) {
        return montar(nomeDestinatario, numeroProcesso, parteCliente, parteAutora, dataAudiencia, null);
    }

    public static String resolverNomeTemplate(String linkReuniao) {
        return StringUtils.hasText(linkReuniao) ? TEMPLATE_COM_LINK : TEMPLATE_PADRAO;
    }

    static String formatParamProcesso(String numeroProcesso, String parteCliente, String parteAutora) {
        String cnj = StringUtils.hasText(numeroProcesso) ? numeroProcesso.trim() : "—";
        String cliente = textoOuFallback(parteCliente, "—");
        String autora = textoOuFallback(parteAutora, "—");
        return cnj + " — Cliente: " + cliente + "; Parte autora: " + autora;
    }

    private static String formatarDataHoraBR(Instant instant) {
        return DATA_HORA_BR.withZone(ZONE_BRASILIA).format(instant);
    }

    private static String textoOuFallback(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
