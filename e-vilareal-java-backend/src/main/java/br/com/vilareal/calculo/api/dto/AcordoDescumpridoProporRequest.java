package br.com.vilareal.calculo.api.dto;

public record AcordoDescumpridoProporRequest(
        String codigoCliente, int numeroProcesso, int dimensaoAcordo, boolean registrarHistorico) {}
