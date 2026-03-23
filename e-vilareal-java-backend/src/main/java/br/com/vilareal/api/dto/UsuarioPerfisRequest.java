package br.com.vilareal.api.dto;

import java.util.ArrayList;
import java.util.List;

public class UsuarioPerfisRequest {
    private List<Long> perfilIds = new ArrayList<>();

    public List<Long> getPerfilIds() { return perfilIds; }
    public void setPerfilIds(List<Long> perfilIds) { this.perfilIds = perfilIds; }
}
