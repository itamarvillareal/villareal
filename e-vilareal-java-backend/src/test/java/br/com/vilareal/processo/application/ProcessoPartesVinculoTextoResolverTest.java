package br.com.vilareal.processo.application;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessoPartesVinculoTextoResolverTest {

    @Test
    void parteOposta_clienteRequeridoNoReu_retornaAutor() {
        ProcessoEntity processo = processoComPapel("REQUERIDO");
        List<ProcessoParteEntity> partes = List.of(
                parte("AUTOR", "VIVIAN GARCIA CARRIJO MATIAS SOCIEDADE INDIVIDUAL DE ADVOCACIA", null),
                parte("REU", "CONDOMINIO RESIDENCIAL TORRES DO MIRANTE", null));

        assertThat(ProcessoPartesVinculoTextoResolver.parteCliente(processo, partes))
                .isEqualTo("CONDOMINIO RESIDENCIAL TORRES DO MIRANTE");
        assertThat(ProcessoPartesVinculoTextoResolver.parteOposta(processo, partes))
                .isEqualTo("VIVIAN GARCIA CARRIJO MATIAS SOCIEDADE INDIVIDUAL DE ADVOCACIA");
    }

    @Test
    void parteOposta_clienteRequerenteNoAutor_retornaReu() {
        ProcessoEntity processo = processoComPapel("REQUERENTE");
        List<ProcessoParteEntity> partes = List.of(
                parte("AUTOR", "MARIA SILVA", null),
                parte("REU", "JOAO SANTOS", null));

        assertThat(ProcessoPartesVinculoTextoResolver.parteCliente(processo, partes))
                .isEqualTo("MARIA SILVA");
        assertThat(ProcessoPartesVinculoTextoResolver.parteOposta(processo, partes))
                .isEqualTo("JOAO SANTOS");
    }

    @Test
    void parteOposta_qualificacaoExplicita_prevaleceSobrePolo() {
        ProcessoEntity processo = processoComPapel("REQUERIDO");
        List<ProcessoParteEntity> partes = List.of(
                parte("AUTOR", "ADVERSARIO", "Parte Oposta"),
                parte("REU", "CLIENTE CONTRATANTE", "Parte Cliente"));

        assertThat(ProcessoPartesVinculoTextoResolver.parteCliente(processo, partes))
                .isEqualTo("CLIENTE CONTRATANTE");
        assertThat(ProcessoPartesVinculoTextoResolver.parteOposta(processo, partes))
                .isEqualTo("ADVERSARIO");
    }

    private static ProcessoEntity processoComPapel(String papelCliente) {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setPapelCliente(papelCliente);
        return processo;
    }

    private static ProcessoParteEntity parte(String polo, String nome, String qualificacao) {
        ProcessoParteEntity parte = new ProcessoParteEntity();
        parte.setPolo(polo);
        parte.setQualificacao(qualificacao);
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(1L);
        pessoa.setNome(nome);
        parte.setPessoa(pessoa);
        return parte;
    }
}
