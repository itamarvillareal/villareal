package br.com.vilareal.whatsapp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Parâmetros globais de cobrança WhatsApp — valem para qualquer cliente/condomínio.
 */
@ConfigurationProperties(prefix = "whatsapp.cobranca")
public class CobrancaWhatsAppProperties {

    /**
     * Cálculo com {@code meta.dataCalculo} anterior a este limite (em meses) exige revisão
     * antes da pré-seleção automática no front.
     */
    private int mesesCalculoDesatualizado = 12;

    public int getMesesCalculoDesatualizado() {
        return mesesCalculoDesatualizado;
    }

    public void setMesesCalculoDesatualizado(int mesesCalculoDesatualizado) {
        this.mesesCalculoDesatualizado = Math.max(1, mesesCalculoDesatualizado);
    }
}
