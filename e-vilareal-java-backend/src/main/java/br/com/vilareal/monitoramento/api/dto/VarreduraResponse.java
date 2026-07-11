package br.com.vilareal.monitoramento.api.dto;

import br.com.vilareal.monitoramento.infrastructure.persistence.entity.VarreduraPessoaEntity;

import java.time.Duration;
import java.time.LocalDateTime;

/** Execução de varredura para o histórico da tela (cabeçalho e modal de conferência). */
public record VarreduraResponse(
        Long id,
        Long pessoaId,
        String pessoaNome,
        String status,
        LocalDateTime inicio,
        LocalDateTime fim,
        Long duracaoSegundos,
        Integer paginasLidas,
        Integer encontrados,
        Integer novos,
        Integer qtdSegredo,
        String erroCodigo,
        String erroMensagem) {

    public static VarreduraResponse de(VarreduraPessoaEntity v) {
        Long duracao = v.getFim() != null && v.getInicio() != null
                ? Duration.between(v.getInicio(), v.getFim()).getSeconds()
                : null;
        return new VarreduraResponse(
                v.getId(),
                v.getPessoa().getId(),
                v.getPessoa().getNome(),
                v.getStatus() != null ? v.getStatus().name() : null,
                v.getInicio(),
                v.getFim(),
                duracao,
                v.getPaginasLidas(),
                v.getEncontrados(),
                v.getNovos(),
                v.getQtdSegredo(),
                v.getErroCodigo(),
                v.getErroMensagem());
    }
}
