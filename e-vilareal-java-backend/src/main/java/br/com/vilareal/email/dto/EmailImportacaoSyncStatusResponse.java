package br.com.vilareal.email.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class EmailImportacaoSyncStatusResponse {

    private String tipo;
    private Instant ultimaSincronizacaoEm;
}
