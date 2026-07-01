package br.com.vilareal.documento;

import java.time.Instant;

/** Contratação vigente vinculada a um processo (fonte para PDF e recebíveis). */
public record ContratoHonorariosProcessoResponse(
        ContratoHonorariosResumoResponse resumo,
        ContratoHonorariosClausula3Dados clausula3Dados,
        ContratoHonorariosWhatsAppCobrancaConfig whatsappCobranca,
        String formaAssinatura,
        Instant criadoEm,
        Instant atualizadoEm) {}
