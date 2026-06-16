package br.com.vilareal.projudi.api.dto;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;

import java.time.Instant;
import java.util.List;

public record ProjudiPeticaoDetailResponse(
        Long id,
        Long credencialId,
        String numeroProcesso,
        String complemento,
        String status,
        Instant criadoEm,
        Instant protocoladoEm,
        String protocoloMensagem,
        String protocoloEtapa,
        List<ProjudiPeticaoArquivoResponse> arquivos) {

    public static ProjudiPeticaoDetailResponse de(ProjudiPeticaoEntity peticao) {
        List<ProjudiPeticaoArquivoResponse> arquivos = peticao.getArquivos().stream()
                .map(ProjudiPeticaoArquivoResponse::de)
                .toList();
        return new ProjudiPeticaoDetailResponse(
                peticao.getId(),
                peticao.getCredencialId(),
                peticao.getNumeroProcesso(),
                peticao.getComplemento(),
                peticao.getStatus(),
                peticao.getCriadoEm(),
                peticao.getProtocoladoEm(),
                peticao.getProtocoloMensagem(),
                peticao.getProtocoloEtapa(),
                arquivos);
    }
}
