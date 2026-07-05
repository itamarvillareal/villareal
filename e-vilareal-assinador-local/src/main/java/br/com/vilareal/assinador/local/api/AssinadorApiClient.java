package br.com.vilareal.assinador.local.api;

import java.util.List;
import java.util.Optional;

public interface AssinadorApiClient {

    /**
     * Long-poll do próximo lote. {@link Optional#empty()} quando a API retorna 204 (timeout sem lote).
     *
     * @throws AssinadorApiException se a API estiver inacessível ou retornar erro inesperado
     */
    Optional<LotePendente> longPollProximoLote(int timeoutSegundos) throws AssinadorApiException;

    byte[] baixarPdf(long loteId, long arquivoId) throws AssinadorApiException;

    void concluirLote(long loteId, List<ArquivoAssinado> arquivosP7s) throws AssinadorApiException;

    void registrarFalha(long loteId, String codigo, String mensagem) throws AssinadorApiException;

    record ArquivoAssinado(String nomeCanonicoP7s, byte[] conteudoP7s) {}
}
