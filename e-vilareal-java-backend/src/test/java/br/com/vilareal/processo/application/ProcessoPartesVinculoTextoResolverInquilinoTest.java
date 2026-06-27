package br.com.vilareal.processo.application;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessoPartesVinculoTextoResolverInquilinoTest {

    @Test
    void listarPessoaIdsParteOposta_porQualificacao() {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setPapelCliente("REQUERENTE");

        ProcessoParteEntity cliente = parte(1228L, "AUTOR", "Parte cliente", 0);
        ProcessoParteEntity inq1 = parte(6631L, "REU", "Parte oposta", 0);
        ProcessoParteEntity inq2 = parte(766L, "REU", "Parte oposta", 1);
        ProcessoParteEntity inq3 = parte(98L, "REU", "Parte oposta", 2);

        List<Long> ids = ProcessoPartesVinculoTextoResolver.listarPessoaIdsParteOposta(
                processo, List.of(cliente, inq1, inq2, inq3));

        assertThat(ids).containsExactly(6631L, 766L, 98L);
    }

    private static ProcessoParteEntity parte(Long pessoaId, String polo, String qualificacao, int ordem) {
        ProcessoParteEntity p = new ProcessoParteEntity();
        p.setPolo(polo);
        p.setQualificacao(qualificacao);
        p.setOrdem(ordem);
        br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity pe =
                new br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity();
        pe.setId(pessoaId);
        pe.setNome("Pessoa " + pessoaId);
        p.setPessoa(pe);
        return p;
    }
}
