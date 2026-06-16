package br.com.vilareal.projudi.api.dto;

import java.util.List;

/**
 * Resposta de protocolo disparado em segundo plano. O cliente acompanha o progresso pela fila de
 * petições (status PROTOCOLANDO → PROTOCOLADA, ou volta a ASSINADA em caso de erro).
 */
public record ProtocoloAceitoResponse(List<Long> peticaoIds, int total, String status) {

    public static ProtocoloAceitoResponse de(List<Long> peticaoIds) {
        List<Long> ids = peticaoIds != null ? List.copyOf(peticaoIds) : List.of();
        return new ProtocoloAceitoResponse(ids, ids.size(), "EM_ANDAMENTO");
    }
}
