package br.com.vilareal.assinador.local;

import br.com.vilareal.assinador.local.api.JdkAssinadorApiClient;
import br.com.vilareal.assinador.local.config.AssinadorLocalConfig;
import br.com.vilareal.assinador.local.logging.AssinadorLog;
import br.com.vilareal.assinador.local.loop.AssinadorPullLoop;
import br.com.vilareal.assinador.local.signing.Pkcs11TokenSigningSessionFactory;

public final class AssinadorLocalMain {

    public static void main(String[] args) {
        AssinadorLocalConfig config = AssinadorLocalConfig.fromEnvironment();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            AssinadorLog.encerrando();
            config.zerarPin();
        }));

        AssinadorLog.iniciando(config.assinadorId(), config.apiBaseUri().getHost());

        AssinadorPullLoop loop = new AssinadorPullLoop(
                config,
                new JdkAssinadorApiClient(config),
                new Pkcs11TokenSigningSessionFactory(config));

        Runtime.getRuntime().addShutdownHook(new Thread(loop::parar));

        loop.executar();
    }

    private AssinadorLocalMain() {}
}
