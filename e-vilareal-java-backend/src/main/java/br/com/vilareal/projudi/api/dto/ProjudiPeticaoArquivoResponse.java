package br.com.vilareal.projudi.api.dto;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;

import java.time.Instant;

public record ProjudiPeticaoArquivoResponse(
        Long id,
        int ordem,
        int idArquivoTipo,
        String nomeOriginal,
        String status,
        Instant criadoEm) {

    static ProjudiPeticaoArquivoResponse de(ProjudiPeticaoArquivoEntity arquivo) {
        return new ProjudiPeticaoArquivoResponse(
                arquivo.getId(),
                arquivo.getOrdem(),
                arquivo.getIdArquivoTipo(),
                arquivo.getNomeOriginal(),
                arquivo.getStatus(),
                arquivo.getCriadoEm());
    }
}
