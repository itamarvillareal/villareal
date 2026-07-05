package br.com.vilareal.assinatura.keystore;

import java.util.Locale;

/**
 * Classifica exceções do SunPKCS11/SafeSign em {@link Pkcs11TokenException} com código estável.
 */
final class Pkcs11TokenErroUtil {

    /** PKCS#11 CKR_DEVICE_ERROR */
    private static final long CKR_DEVICE_ERROR = 0x00000030L;
    /** PKCS#11 CKR_TOKEN_NOT_PRESENT */
    private static final long CKR_TOKEN_NOT_PRESENT = 0x000000E0L;
    /** PKCS#11 CKR_PIN_INCORRECT */
    private static final long CKR_PIN_INCORRECT = 0x000000A0L;
    /** PKCS#11 CKR_PIN_LOCKED */
    private static final long CKR_PIN_LOCKED = 0x000000A4L;
    /** PKCS#11 CKR_SESSION_CLOSED */
    private static final long CKR_SESSION_CLOSED = 0x000000B0L;
    /** PKCS#11 CKR_USER_ALREADY_LOGGED_IN */
    private static final long CKR_USER_ALREADY_LOGGED_IN = 0x00000103L;
    /** PKCS#11 CKR_SESSION_COUNT */
    private static final long CKR_SESSION_COUNT = 0x000001B1L;
    /** PKCS#11 CKR_CRYPTOKI_NOT_INITIALIZED */
    private static final long CKR_CRYPTOKI_NOT_INITIALIZED = 0x00000190L;

    private Pkcs11TokenErroUtil() {}

    static Pkcs11TokenException classificar(Throwable falha) {
        if (falha instanceof Pkcs11TokenException pte) {
            return pte;
        }

        Pkcs11TokenException.Codigo codigo = resolverCodigo(falha);
        String mensagem = mensagemPara(codigo, falha);
        return new Pkcs11TokenException(codigo, mensagem, falha);
    }

    private static Pkcs11TokenException.Codigo resolverCodigo(Throwable falha) {
        if (contemCodigoPkcs11(
                falha,
                CKR_DEVICE_ERROR,
                CKR_SESSION_CLOSED,
                CKR_USER_ALREADY_LOGGED_IN,
                CKR_SESSION_COUNT,
                CKR_CRYPTOKI_NOT_INITIALIZED)) {
            return Pkcs11TokenException.Codigo.TOKEN_OCUPADO;
        }
        if (contemCodigoPkcs11(falha, CKR_TOKEN_NOT_PRESENT)) {
            return Pkcs11TokenException.Codigo.TOKEN_NAO_PRESENTE;
        }
        if (contemCodigoPkcs11(falha, CKR_PIN_INCORRECT, CKR_PIN_LOCKED)) {
            return Pkcs11TokenException.Codigo.PIN_INCORRETO;
        }

        String texto = textoCompleto(falha);
        if (textoContem(texto, "ckr_device_error", "ckr_session_count", "ckr_user_already_logged_in")
                || textoContem(
                        texto,
                        "device error",
                        "session count",
                        "already logged in",
                        "unable to communicate",
                        "token in use",
                        "busy")) {
            return Pkcs11TokenException.Codigo.TOKEN_OCUPADO;
        }
        if (textoContem(texto, "ckr_token_not_present", "token not present", "no token present")) {
            return Pkcs11TokenException.Codigo.TOKEN_NAO_PRESENTE;
        }
        if (textoContem(texto, "ckr_pin_incorrect", "pin incorrect", "ckr_pin_locked", "pin locked")) {
            return Pkcs11TokenException.Codigo.PIN_INCORRETO;
        }
        if (textoContem(texto, "sunpkcs11", "pkcs11") && textoContem(texto, "not found", "not available")) {
            return Pkcs11TokenException.Codigo.PROVIDER_INDISPONIVEL;
        }
        return Pkcs11TokenException.Codigo.OUTRO;
    }

    private static String mensagemPara(Pkcs11TokenException.Codigo codigo, Throwable falha) {
        return switch (codigo) {
            case TOKEN_OCUPADO -> Pkcs11TokenException.MENSAGEM_TOKEN_OCUPADO;
            case TOKEN_NAO_PRESENTE -> "Token USB não detectado. Conecte o token e tente novamente.";
            case PIN_INCORRETO -> "PIN do token incorreto ou bloqueado. Verifique "
                    + AssinaturaTokenConstantes.ENV_TOKEN_PIN + ".";
            case PROVIDER_INDISPONIVEL -> "Provider SunPKCS11 indisponível — use JDK 21 completo no Windows.";
            case OUTRO -> {
                String msg = falha.getMessage();
                yield msg != null && !msg.isBlank()
                        ? "Falha ao acessar o token PKCS#11: " + msg
                        : "Falha ao acessar o token PKCS#11.";
            }
        };
    }

    private static boolean contemCodigoPkcs11(Throwable falha, long... codigos) {
        Throwable atual = falha;
        while (atual != null) {
            Long codigo = extrairCodigoPkcs11(atual);
            if (codigo != null) {
                for (long esperado : codigos) {
                    if (codigo == esperado) {
                        return true;
                    }
                }
            }
            atual = atual.getCause();
        }
        return false;
    }

    private static Long extrairCodigoPkcs11(Throwable falha) {
        if (!"sun.security.pkcs11.wrapper.PKCS11Exception".equals(falha.getClass().getName())) {
            return null;
        }
        try {
            Object valor = falha.getClass().getMethod("getErrorCode").invoke(falha);
            if (valor instanceof Number numero) {
                return numero.longValue();
            }
        } catch (ReflectiveOperationException ignored) {
            // best-effort
        }
        return null;
    }

    private static String textoCompleto(Throwable falha) {
        StringBuilder sb = new StringBuilder();
        Throwable atual = falha;
        while (atual != null) {
            if (atual.getMessage() != null) {
                if (!sb.isEmpty()) {
                    sb.append(' ');
                }
                sb.append(atual.getMessage());
            }
            atual = atual.getCause();
        }
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    private static boolean textoContem(String texto, String... termos) {
        for (String termo : termos) {
            if (texto.contains(termo)) {
                return true;
            }
        }
        return false;
    }
}
