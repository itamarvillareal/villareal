package br.com.vilareal.projudi.api.dto;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;

import java.time.Instant;

public record ProjudiPeticaoResumoResponse(
        Long peticaoId,
        Long credencialId,
        String numeroProcesso,
        String status,
        int quantidadeArquivos,
        Instant criadoEm) {

    public static ProjudiPeticaoResumoResponse de(ProjudiPeticaoEntity peticao) {
        return new ProjudiPeticaoResumoResponse(
                peticao.getId(),
                peticao.getCredencialId(),
                peticao.getNumeroProcesso(),
                peticao.getStatus(),
                peticao.getArquivos().size(),
                peticao.getCriadoEm());
    }
}
