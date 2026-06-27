package br.com.vilareal.documento;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoLocacaoAssinaturaUtilTest {

    @Test
    void umLocadorDoisLocatarios_locadorCentralizadoELocatariosLadoALado() {
        PessoaEntity locador = pessoa("VRV SOLUÇÕES LTDA");
        PessoaEntity carlos = pessoa("Carlos Ricardo de Carvalho Reimer");
        PessoaEntity marcus = pessoa("Marcus Antonio Cardoso Anacleto");

        List<Map<String, String>> linhas =
                ContratoLocacaoAssinaturaUtil.montarVariaveisLinhasAssinaturaLocadorLocatario(
                        locador, List.of(carlos, marcus));

        assertThat(linhas).hasSize(2);
        assertThat(linhas.get(0).get("centralizada")).isEqualTo("true");
        assertThat(linhas.get(0).get("nomeEsquerda")).isEqualTo("VRV SOLUÇÕES LTDA");
        assertThat(linhas.get(0).get("rotuloEsquerda")).isEqualTo("Locador");

        assertThat(linhas.get(1).get("centralizada")).isEqualTo("false");
        assertThat(linhas.get(1).get("nomeEsquerda")).isEqualTo("CARLOS RICARDO DE CARVALHO REIMER");
        assertThat(linhas.get(1).get("nomeDireita")).isEqualTo("MARCUS ANTONIO CARDOSO ANACLETO");
        assertThat(linhas.get(1).get("rotuloEsquerda")).isEqualTo("Locatário");
        assertThat(linhas.get(1).get("rotuloDireita")).isEqualTo("Locatário");
    }

    @Test
    void umLocadorUmLocatario_mesmaLinhaLadoALado() {
        List<Map<String, String>> linhas =
                ContratoLocacaoAssinaturaUtil.montarVariaveisLinhasAssinaturaLocadorLocatario(
                        pessoa("Locador Teste"), List.of(pessoa("Locatário Teste")));

        assertThat(linhas).hasSize(1);
        assertThat(linhas.get(0).get("centralizada")).isEqualTo("false");
        assertThat(linhas.get(0).get("nomeEsquerda")).isEqualTo("LOCADOR TESTE");
        assertThat(linhas.get(0).get("nomeDireita")).isEqualTo("LOCATÁRIO TESTE");
    }

    @Test
    void tresLocatarios_ultimoCentralizado() {
        List<Map<String, String>> linhas =
                ContratoLocacaoAssinaturaUtil.montarVariaveisLinhasAssinaturaLocadorLocatario(
                        pessoa("VRV SOLUÇÕES LTDA"),
                        List.of(pessoa("Carlos"), pessoa("Marcus"), pessoa("Ana Souza")));

        assertThat(linhas).hasSize(3);
        assertThat(linhas.get(0).get("centralizada")).isEqualTo("true");
        assertThat(linhas.get(1).get("centralizada")).isEqualTo("false");
        assertThat(linhas.get(2).get("centralizada")).isEqualTo("true");
        assertThat(linhas.get(2).get("nomeEsquerda")).isEqualTo("ANA SOUZA");
    }

    private static PessoaEntity pessoa(String nome) {
        PessoaEntity p = new PessoaEntity();
        p.setNome(nome);
        return p;
    }
}
