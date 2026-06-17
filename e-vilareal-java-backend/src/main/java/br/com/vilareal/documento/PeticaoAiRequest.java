package br.com.vilareal.documento;

import java.time.LocalDate;
import java.util.List;

public record PeticaoAiRequest(
        String enderecamento,
        String numeroProcesso,
        String tipoPeca,
        String nomeAutor,
        String qualificacaoAutor,
        String nomeReu,
        String qualificacaoReu,
        String fatos,
        String fundamentacaoAdicional,
        String valorCausa,
        List<String> pedidosEspecificos,
        String modeloBase,
        String instrucoesAdicionais,
        String cidadeEstado,
        LocalDate data,
        String codigoCliente,
        Integer numeroInterno,
        Long processoId
) {
}
