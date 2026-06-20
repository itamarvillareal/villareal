package br.com.vilareal.documento;

/** Texto do fecho (parágrafo final antes das assinaturas) conforme forma de assinatura. */
final class ContratoFechoTexto {

    private ContratoFechoTexto() {}

    static String montarFechoHonorarios(ContratoFormaAssinatura forma) {
        if (forma == ContratoFormaAssinatura.VIA_DIGITAL) {
            return "Para firmar e como prova de assim haverem contratado, por se acharem justos e contratados, "
                    + "firmam o presente Instrumento Particular em via digital, assinado pelas partes "
                    + "Contratantes, ante as duas testemunhas abaixo.";
        }
        return "Para firmar e como prova de assim haverem contratado, por se acharem justos e contratados, "
                + "firmam o presente Instrumento Particular, impresso em duas (02) vias de igual teor, assinado "
                + "pelas partes Contratantes, ante as duas testemunhas abaixo.";
    }

    static String montarFechoAluguel(ContratoFormaAssinatura forma) {
        if (forma == ContratoFormaAssinatura.VIA_DIGITAL) {
            return "E, por estarem justos e contratados, firmam o presente instrumento em via digital, "
                    + "com validade e forma legal, na presença de duas testemunhas.";
        }
        return "E, por estarem justos e contratados, firmam o presente instrumento em duas (02) vias "
                + "de igual teor e forma, na presença de duas testemunhas.";
    }
}
