package br.com.vilareal.documento;

import java.util.List;

/** Corpo do preview da Cláusula 3ª (dados + contratante(s) para flexão). */
public record ContratoHonorariosClausula3TextoRequest(
        ContratoHonorariosClausula3Dados dados,
        Long pessoaId,
        List<Long> contratantePessoaIds) {}
