package br.com.vilareal.assinador.local.logging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Logs estruturados — sem PIN, segredo, CN ou CPF. */
public final class AssinadorLog {

    private static final Logger LOG = LoggerFactory.getLogger("assinador_local");

    private AssinadorLog() {}

    public static void iniciando(String assinadorId, String apiHost) {
        LOG.info("event=assinador_iniciando assinadorId={} apiHost={}", assinadorId, apiHost);
    }

    public static void longPollAguardando(int timeoutSegundos) {
        LOG.debug("event=long_poll_aguardando timeoutSeg={}", timeoutSegundos);
    }

    public static void loteRecebido(long loteId, int arquivos, long credencialId) {
        LOG.info("event=lote_recebido loteId={} arquivos={} credencialId={}", loteId, arquivos, credencialId);
    }

    public static void tokenSessaoAbrindo(long loteId) {
        LOG.info("event=token_sessao_abrindo loteId={} pinSource=env", loteId);
    }

    public static void arquivoAssinado(long loteId, long arquivoId, int ordem) {
        LOG.info("event=arquivo_assinado loteId={} arquivoId={} ordem={}", loteId, arquivoId, ordem);
    }

    public static void loteConcluido(long loteId, int arquivos) {
        LOG.info("event=lote_concluido loteId={} arquivos={}", loteId, arquivos);
    }

    public static void loteFalha(long loteId, String codigo, String mensagem) {
        LOG.warn("event=lote_falha loteId={} codigo={} mensagem={}", loteId, codigo, mensagem);
    }

    public static void apiInacessivel(String mensagem, long backoffMs) {
        LOG.warn("event=api_inacessivel mensagem={} proximoRetryMs={}", mensagem, backoffMs);
    }

    public static void erroInesperado(String contexto, Throwable erro) {
        LOG.error("event=erro_inesperado contexto={} tipo={} mensagem={}", contexto, erro.getClass().getSimpleName(), erro.getMessage());
    }

    public static void encerrando() {
        LOG.info("event=assinador_encerrando");
    }
}
