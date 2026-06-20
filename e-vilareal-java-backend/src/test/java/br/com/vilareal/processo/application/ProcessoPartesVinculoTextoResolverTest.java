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
    void parteOpostaParaNomePasta_multiplosReus_usaPrimeiroEOutros() {
        ProcessoEntity processo = processoComPapel("REQUERENTE");
        List<ProcessoParteEntity> partes = List.of(
                parte("AUTOR", "MARIA SILVA", null),
                parte("REU", "FERNANDO MACHADO GUIMARAES", null),
                parte("REU", "VIRGILIO TOMAS GARCIA", null),
                parte("REU", "JOAO VITOR DINIZ BORGES", null));

        assertThat(ProcessoPartesVinculoTextoResolver.parteOposta(processo, partes))
                .isEqualTo("FERNANDO MACHADO GUIMARAES, VIRGILIO TOMAS GARCIA e JOAO VITOR DINIZ BORGES");
        assertThat(ProcessoPartesVinculoTextoResolver.parteOpostaParaNomePasta(processo, partes))
                .isEqualTo("FERNANDO MACHADO GUIMARAES e outros");
    }

    @Test
    void parteOpostaParaNomePasta_unicoReu_mantemNomeCompleto() {
        ProcessoEntity processo = processoComPapel("REQUERENTE");
        List<ProcessoParteEntity> partes = List.of(
                parte("AUTOR", "MARIA SILVA", null),
                parte("REU", "FERNANDO MACHADO GUIMARAES", null));

        assertThat(ProcessoPartesVinculoTextoResolver.parteOpostaParaNomePasta(processo, partes))
                .isEqualTo("FERNANDO MACHADO GUIMARAES");
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

    @Test
    void resolverPapelClienteEfetivo_usaCampoProcessoRequerido() {
        ProcessoEntity processo = processoComPapel("REQUERIDO");
        assertThat(ProcessoPartesVinculoTextoResolver.resolverPapelClienteEfetivo(processo, List.of()))
                .isEqualTo("REQUERIDO");
    }

    @Test
    void primeiraPessoaIdParteCliente_clienteRequeridoNoReu() {
        ProcessoEntity processo = processoComPapel("REQUERIDO");
        PessoaEntity pessoaCliente = new PessoaEntity();
        pessoaCliente.setId(42L);
        pessoaCliente.setNome("CONDOMINIO RESIDENCIAL TORRES DO MIRANTE");
        PessoaEntity pessoaOposta = new PessoaEntity();
        pessoaOposta.setId(99L);
        pessoaOposta.setNome("ADVERSARIO");
        List<ProcessoParteEntity> partes = List.of(
                parteComPessoa("AUTOR", pessoaOposta, null),
                parteComPessoa("REU", pessoaCliente, null));

        assertThat(ProcessoPartesVinculoTextoResolver.primeiraPessoaIdParteCliente(processo, partes))
                .isEqualTo(42L);
    }

    private static ProcessoParteEntity parteComPessoa(String polo, PessoaEntity pessoa, String qualificacao) {
        ProcessoParteEntity parte = new ProcessoParteEntity();
        parte.setPolo(polo);
        parte.setQualificacao(qualificacao);
        parte.setPessoa(pessoa);
        return parte;
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
