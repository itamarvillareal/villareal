package br.com.vilareal.assinador.local.loop;

import br.com.vilareal.assinador.local.api.AssinadorApiClient;
import br.com.vilareal.assinador.local.api.AssinadorApiException;
import br.com.vilareal.assinador.local.api.LotePendente;
import br.com.vilareal.assinador.local.config.AssinadorLocalConfig;
import br.com.vilareal.assinador.local.logging.AssinadorLog;
import br.com.vilareal.assinador.local.signing.TokenSigningSession;
import br.com.vilareal.assinador.local.signing.TokenSigningSessionFactory;
import br.com.vilareal.assinatura.keystore.Pkcs11TokenException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Loop pull: long-poll → baixa PDFs → assina em sessão por lote → conclui ou registra falha.
 * Sobrevive a quedas de rede (backoff) e nunca derruba o processo por erro de token.
 */
public final class AssinadorPullLoop {

    private final AssinadorLocalConfig config;
    private final AssinadorApiClient apiClient;
    private final TokenSigningSessionFactory sessionFactory;
    private final AtomicBoolean running = new AtomicBoolean(true);
    private final Sleeper sleeper;

    public AssinadorPullLoop(
            AssinadorLocalConfig config,
            AssinadorApiClient apiClient,
            TokenSigningSessionFactory sessionFactory) {
        this(config, apiClient, sessionFactory, Thread::sleep);
    }

    AssinadorPullLoop(
            AssinadorLocalConfig config,
            AssinadorApiClient apiClient,
            TokenSigningSessionFactory sessionFactory,
            Sleeper sleeper) {
        this.config = config;
        this.apiClient = apiClient;
        this.sessionFactory = sessionFactory;
        this.sleeper = sleeper;
    }

    public void executar() {
        long backoffMs = config.backoffInicialMs();
        while (running.get()) {
            try {
                AssinadorLog.longPollAguardando(config.longPollTimeoutSegundos());
                Optional<LotePendente> lote =
                        apiClient.longPollProximoLote(config.longPollTimeoutSegundos());
                backoffMs = config.backoffInicialMs();
                if (lote.isPresent()) {
                    processarLote(lote.get());
                }
            } catch (AssinadorApiException e) {
                if (e.rede()) {
                    AssinadorLog.apiInacessivel(e.getMessage(), backoffMs);
                    dormir(backoffMs);
                    backoffMs = Math.min(config.backoffMaxMs(), backoffMs * 2);
                } else {
                    AssinadorLog.erroInesperado("api", e);
                    dormir(config.backoffInicialMs());
                }
            } catch (Exception e) {
                AssinadorLog.erroInesperado("loop", e);
                dormir(config.backoffInicialMs());
            }
        }
    }

    public void parar() {
        running.set(false);
    }

    void processarLote(LotePendente lote) {
        AssinadorLog.loteRecebido(lote.loteId(), lote.arquivos().size(), lote.credencialId());
        TokenSigningSession sessao = null;
        try {
            AssinadorLog.tokenSessaoAbrindo(lote.loteId());
            sessao = sessionFactory.abrirSessao();
            List<AssinadorApiClient.ArquivoAssinado> assinados = new ArrayList<>(lote.arquivos().size());
            for (LotePendente.ArquivoPendente arquivo : lote.arquivos()) {
                byte[] pdf = apiClient.baixarPdf(lote.loteId(), arquivo.arquivoId());
                byte[] p7s = sessao.assinarPdf(pdf);
                assinados.add(new AssinadorApiClient.ArquivoAssinado(arquivo.nomeCanonicoP7s(), p7s));
                AssinadorLog.arquivoAssinado(lote.loteId(), arquivo.arquivoId(), arquivo.ordem());
            }
            apiClient.concluirLote(lote.loteId(), assinados);
            AssinadorLog.loteConcluido(lote.loteId(), assinados.size());
        } catch (Pkcs11TokenException e) {
            registrarFalhaSegura(lote.loteId(), e.codigo().name(), e.getMessage());
        } catch (Exception e) {
            if (e.getCause() instanceof Pkcs11TokenException pte) {
                registrarFalhaSegura(lote.loteId(), pte.codigo().name(), pte.getMessage());
            } else {
                registrarFalhaSegura(lote.loteId(), "OUTRO", mensagemSegura(e));
                AssinadorLog.erroInesperado("processar_lote", e);
            }
        } finally {
            fecharSessao(sessao, lote.loteId());
        }
    }

    private void registrarFalhaSegura(long loteId, String codigo, String mensagem) {
        AssinadorLog.loteFalha(loteId, codigo, mensagem);
        try {
            apiClient.registrarFalha(loteId, codigo, mensagem);
        } catch (AssinadorApiException e) {
            AssinadorLog.erroInesperado("registrar_falha", e);
        }
    }

    private static void fecharSessao(TokenSigningSession sessao, long loteId) {
        if (sessao == null) {
            return;
        }
        try {
            sessao.close();
        } catch (Exception e) {
            AssinadorLog.erroInesperado("token_close loteId=" + loteId, e);
        }
    }

    private static String mensagemSegura(Exception e) {
        String msg = e.getMessage();
        if (msg == null || msg.isBlank()) {
            return e.getClass().getSimpleName();
        }
        return msg.length() > 500 ? msg.substring(0, 500) : msg;
    }

    private void dormir(long ms) {
        try {
            sleeper.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            running.set(false);
        }
    }

    @FunctionalInterface
    interface Sleeper {
        void sleep(long ms) throws InterruptedException;
    }
}
