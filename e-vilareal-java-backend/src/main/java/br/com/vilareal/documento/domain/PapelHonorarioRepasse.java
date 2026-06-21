package br.com.vilareal.documento.domain;

/** Papel de um lançamento financeiro no ciclo alvará × repasse de honorários. */
public enum PapelHonorarioRepasse {
    /** Crédito de alvará / depósito recebido no processo. */
    ALVARA,
    /** Débito de repasse ao contratante (parte cliente). */
    REPASSE
}
