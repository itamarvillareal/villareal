package br.com.vilareal.integracao.cora;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;

/**
 * Verificação read-only de conectividade (mTLS, token, extrato curto).
 */
public class CoraHealthService {

    private static final Logger log = LoggerFactory.getLogger(CoraHealthService.class);

    private final CoraProperties props;
    private final CoraClient coraClient;
    private final CoraTokenService tokenService;

    public CoraHealthService(CoraProperties props, CoraClient coraClient, CoraTokenService tokenService) {
        this.props = props;
        this.coraClient = coraClient;
        this.tokenService = tokenService;
    }

    public CoraHealthResult check() {
        CoraHealthResult result = new CoraHealthResult();
        result.setEnabled(true);

        try {
            CoraMtlsSslContextFactory.build(props);
            result.setMtlsOk(true);
        } catch (Exception e) {
            log.warn("[Cora] Health mTLS falhou: {}", e.getMessage());
            result.setMtlsOk(false);
            result.setTokenOk(false);
            result.setContaOk(false);
            return result;
        }

        try {
            tokenService.getToken();
            result.setTokenOk(true);
        } catch (Exception e) {
            log.warn("[Cora] Health token falhou: {}", e.getMessage());
            result.setMtlsOk(true);
            result.setTokenOk(false);
            result.setContaOk(false);
            return result;
        }

        try {
            LocalDate end = LocalDate.now();
            LocalDate start = end.minusDays(3);
            String path = "/bank-statement/statement?start=" + start + "&end=" + end;
            CoraHttpResponse extrato = coraClient.get(path);
            result.setContaOk(extrato.isSuccess());
        } catch (Exception e) {
            log.warn("[Cora] Health extrato/conta falhou: {}", e.getMessage());
            result.setMtlsOk(true);
            result.setTokenOk(true);
            result.setContaOk(false);
        }

        return result;
    }
}
