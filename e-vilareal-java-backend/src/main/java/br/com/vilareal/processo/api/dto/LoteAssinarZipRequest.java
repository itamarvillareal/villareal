package br.com.vilareal.processo.api.dto;

import java.util.List;

public record LoteAssinarZipRequest(List<Long> peticaoIds) {}
