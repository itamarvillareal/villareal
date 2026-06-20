package br.com.vilareal.documento;

/** Gênero e número do(s) contratante(s) para concordância na Cláusula 3ª. */
public record ContratoContratanteFlexao(FlexaoUtil.Genero genero, FlexaoUtil.Numero numero) {

    public static ContratoContratanteFlexao padrao() {
        return new ContratoContratanteFlexao(FlexaoUtil.Genero.MASCULINO, FlexaoUtil.Numero.SINGULAR);
    }

    public static ContratoContratanteFlexao from(PoloFlexao polo) {
        return new ContratoContratanteFlexao(polo.genero(), polo.numero());
    }

    /** Ex.: «receberá do Contratante», «receberá da Contratante», «receberá dos Contratantes». */
    public String receberaDeContratante() {
        String prep = FlexaoUtil.adequar("do", genero, numero);
        String rotulo = numero == FlexaoUtil.Numero.PLURAL ? "Contratantes" : "Contratante";
        return "receberá " + prep + " " + rotulo;
    }
}
