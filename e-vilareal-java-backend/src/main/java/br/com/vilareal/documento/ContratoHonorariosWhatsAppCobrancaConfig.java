package br.com.vilareal.documento;

import java.util.List;

/**
 * Cobrança WhatsApp de parcelas de honorários.
 *
 * @param antecedencia {@code VENCIMENTO_DIA}, {@code VENCIMENTO_MENOS_1} ou {@code VENCIMENTO_MENOS_3}
 */
public record ContratoHonorariosWhatsAppCobrancaConfig(
        Boolean ativo,
        String horarioEnvio,
        String antecedencia,
        List<String> telefonesExtras) {}
