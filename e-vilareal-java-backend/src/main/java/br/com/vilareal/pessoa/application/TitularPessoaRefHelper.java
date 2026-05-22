package br.com.vilareal.pessoa.application;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;

public final class TitularPessoaRefHelper {

    private TitularPessoaRefHelper() {}

    public static Long titularPessoaId(
            ProcessoEntity processo, PessoaEntity pessoaRefLegado, ClienteEntity cliente) {
        if (processo != null && processo.getPessoa() != null) {
            return processo.getPessoa().getId();
        }
        if (pessoaRefLegado != null) {
            return pessoaRefLegado.getId();
        }
        if (cliente != null && cliente.getPessoa() != null) {
            return cliente.getPessoa().getId();
        }
        return null;
    }
}
