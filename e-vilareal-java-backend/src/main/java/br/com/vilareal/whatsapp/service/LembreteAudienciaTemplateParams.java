package br.com.vilareal.whatsapp.service;

import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Monta parâmetros do template Meta {@code lembrete_audiencia} (3 variáveis). */
public final class LembreteAudienciaTemplateParams {

    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");

    private LembreteAudienciaTemplateParams() {}

    /**
     * @param nomeDestinatario nome para saudação ({{1}})
     * @param numeroProcesso CNJ ou identificador do processo
     * @param parteCliente texto da parte cliente no processo
     * @param parteAutora texto da parte autora no processo
     * @param dataAudiencia instante da audiência
     */
    public static List<String> montar(
            String nomeDestinatario,
            String numeroProcesso,
            String parteCliente,
            String parteAutora,
            Instant dataAudiencia) {
        return List.of(
                textoOuFallback(nomeDestinatario, "Cliente"),
                formatParamProcesso(numeroProcesso, parteCliente, parteAutora),
                formatarDataHoraBR(dataAudiencia));
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
