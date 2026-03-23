package br.com.vilareal.api.context;

/**
 * Identidade do usuário e IP da requisição atual (preenchido por filtro HTTP).
 */
public final class UsuarioContext {

    private static final ThreadLocal<String> USUARIO_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> USUARIO_NOME = new ThreadLocal<>();
    private static final ThreadLocal<String> IP_ORIGEM = new ThreadLocal<>();

    private UsuarioContext() {
    }

    public static void set(String usuarioId, String usuarioNome, String ipOrigem) {
        USUARIO_ID.set(usuarioId);
        USUARIO_NOME.set(usuarioNome);
        IP_ORIGEM.set(ipOrigem);
    }

    public static void clear() {
        USUARIO_ID.remove();
        USUARIO_NOME.remove();
        IP_ORIGEM.remove();
    }

    public static String getUsuarioId() {
        return USUARIO_ID.get();
    }

    public static String getUsuarioNome() {
        return USUARIO_NOME.get();
    }

    public static String getIpOrigem() {
        return IP_ORIGEM.get();
    }
}
