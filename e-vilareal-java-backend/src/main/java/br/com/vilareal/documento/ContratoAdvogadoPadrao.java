package br.com.vilareal.documento;

import br.com.vilareal.documento.tema.TemaDocumento;

/** Contratado fixo do contrato de honorários (modelo Villa Real). */
final class ContratoAdvogadoPadrao {

    static final String NOME = TemaDocumento.advogadoNomePadrao();
    static final String OAB = TemaDocumento.advogadoOabPadrao();

    private ContratoAdvogadoPadrao() {}
}
