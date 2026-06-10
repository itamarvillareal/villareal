package br.com.vilareal.projudi.api.dto;

import java.util.List;

public record ValidarProtocoloResponse(
        boolean sucessoGeral,
        List<JuntadaValidacaoDto> juntadas,
        List<String> avisosGerais) {

    public record JuntadaValidacaoDto(
            long credencialId,
            String numeroProcesso,
            List<Long> peticaoIds,
            List<PreviaProtocoloResponse.ArquivoPreviaDto> arquivos,
            boolean sucesso,
            String mensagem,
            String respostaBruta) {}
}
