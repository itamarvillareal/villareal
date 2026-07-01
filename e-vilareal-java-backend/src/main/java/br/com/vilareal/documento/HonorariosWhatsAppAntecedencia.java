package br.com.vilareal.documento;

/** Dias antes do vencimento em que a mensagem é enviada (horário fixo em Brasília). */
public enum HonorariosWhatsAppAntecedencia {
    VENCIMENTO_MENOS_3(3),
    VENCIMENTO_MENOS_1(1),
    VENCIMENTO_DIA(0);

    private final int diasAntesDoVencimento;

    HonorariosWhatsAppAntecedencia(int diasAntesDoVencimento) {
        this.diasAntesDoVencimento = diasAntesDoVencimento;
    }

    /** Data de vencimento alvo = hoje + este valor. */
    public int diasAntesDoVencimento() {
        return diasAntesDoVencimento;
    }

    public static HonorariosWhatsAppAntecedencia parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return VENCIMENTO_DIA;
        }
        try {
            return HonorariosWhatsAppAntecedencia.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return VENCIMENTO_DIA;
        }
    }
}
