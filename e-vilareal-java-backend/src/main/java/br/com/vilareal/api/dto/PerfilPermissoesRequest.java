package br.com.vilareal.api.dto;

import java.util.ArrayList;
import java.util.List;

public class PerfilPermissoesRequest {
    private List<Long> permissaoIds = new ArrayList<>();

    public List<Long> getPermissaoIds() { return permissaoIds; }
    public void setPermissaoIds(List<Long> permissaoIds) { this.permissaoIds = permissaoIds; }
}
