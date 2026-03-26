package br.com.vilareal.auth.api.dto;

public class LoginResponse {

    private String accessToken;
    private String tokenType = "Bearer";
    private UsuarioLogadoDto usuario;

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }

    public UsuarioLogadoDto getUsuario() {
        return usuario;
    }

    public void setUsuario(UsuarioLogadoDto usuario) {
        this.usuario = usuario;
    }
}
