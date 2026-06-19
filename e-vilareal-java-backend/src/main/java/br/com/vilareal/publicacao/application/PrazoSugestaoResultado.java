package br.com.vilareal.publicacao.application;

import java.time.LocalDate;

public record PrazoSugestaoResultado(
        boolean identificado,
        PrazoSugestaoOrigem origem,
        int dias,
        LocalDate dataBase,
        LocalDate dataFatal,
        String explicacao) {}
