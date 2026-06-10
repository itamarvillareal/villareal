package br.com.vilareal.projudi.api.dto;

import java.util.List;

public record PreviaProtocoloResponse(
        List<JuntadaPreviaDto> juntadas,
        int quantidadeJuntadas,
        int quantidadeConcluir,
        int quantidadeArquivos,
        List<String> avisosGerais) {

    public record JuntadaPreviaDto(
            long credencialId,
            String numeroProcesso,
            List<Long> peticaoIds,
            List<ArquivoPreviaDto> arquivos,
            List<String> avisos) {}

    public record ArquivoPreviaDto(
            int ordemNaJuntada,
            long peticaoId,
            String nomeOriginal,
            int idArquivoTipo,
            String tipoLabel,
            boolean p7sEncontrado) {}
}
