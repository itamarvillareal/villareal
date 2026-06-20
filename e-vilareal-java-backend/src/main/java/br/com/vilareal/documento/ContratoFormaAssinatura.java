package br.com.vilareal.documento;

/** Forma de formalização/assinatura do contrato (fecho do instrumento). */
public enum ContratoFormaAssinatura {
    DUAS_VIAS,
    VIA_DIGITAL;

    public static ContratoFormaAssinatura resolver(String valor) {
        if (valor == null || valor.isBlank()) {
            return DUAS_VIAS;
        }
        String norm = valor.trim().toUpperCase().replace('-', '_');
        if ("VIA_DIGITAL".equals(norm) || "DIGITAL".equals(norm)) {
            return VIA_DIGITAL;
        }
        return DUAS_VIAS;
    }
}
