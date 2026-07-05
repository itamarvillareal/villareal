package br.com.vilareal.calculo.api.dto;

public record AcordoRegistrarAndamentoRequest(
        long processoId, String origem, String titulo, String detalhe) {}
