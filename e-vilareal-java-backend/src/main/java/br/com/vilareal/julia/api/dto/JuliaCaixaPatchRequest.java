package br.com.vilareal.julia.api.dto;

import java.time.LocalDate;

public record JuliaCaixaPatchRequest(String statusCaixa, String categoria, LocalDate postergarAte) {}
