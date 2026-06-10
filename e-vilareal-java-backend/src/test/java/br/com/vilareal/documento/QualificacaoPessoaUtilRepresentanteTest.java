package br.com.vilareal.documento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import br.com.vilareal.pessoa.api.dto.PessoaComplementarPayload;
import br.com.vilareal.pessoa.api.dto.PessoaEnderecoItemResponse;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Testes da qualificação de PJ com representante vinculado ({@code pessoa.responsavel_id}), reusando o
 * mesmo núcleo de qualificação de pessoa. Foca na concordância de gênero do sufixo.
 */
@ExtendWith(MockitoExtension.class)
class QualificacaoPessoaUtilRepresentanteTest {

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private PessoaApplicationService pessoaApplicationService;

    @InjectMocks
    private QualificacaoPessoaUtil util;

    /** Stub completo de uma pessoa (entidade + complementar + endereços + contatos). */
    private PessoaEntity stubPessoa(
            long id, String nome, String cpfOuCnpj, String genero,
            String estadoCivil, String rg, String orgaoExpedidor, PessoaEntity responsavel) {
        PessoaEntity p = new PessoaEntity();
        p.setId(id);
        p.setNome(nome);
        p.setCpf(cpfOuCnpj);
        p.setResponsavel(responsavel);

        lenient().when(pessoaRepository.findById(id)).thenReturn(Optional.of(p));

        PessoaComplementarPayload comp = new PessoaComplementarPayload();
        comp.setGenero(genero);
        comp.setEstadoCivil(estadoCivil);
        comp.setNacionalidade("Brasileira");
        comp.setRg(rg);
        comp.setOrgaoExpedidor(orgaoExpedidor);
        lenient().when(pessoaApplicationService.obterComplementar(id)).thenReturn(comp);

        PessoaEnderecoItemResponse end = new PessoaEnderecoItemResponse();
        end.setRua("Rua Teste");
        end.setNumero(10);
        end.setBairro("Centro");
        end.setCidade("Anapolis");
        end.setEstado("GO");
        end.setCep("75000000");
        lenient().when(pessoaApplicationService.listarEnderecos(id)).thenReturn(List.of(end));

        lenient().when(pessoaApplicationService.listarContatos(id)).thenReturn(List.of());
        return p;
    }

    @Test
    void representanteAdministrador_naoVemEmNegritoMesmoComNomeEmNegritoTrue() {
        PessoaEntity rep = stubPessoa(7193L, "JOSE ALEX LEITE", "11657370780", "M", "casado",
                "399971049", "SSP/SP", null);
        stubPessoa(7062L, "J.J.A CONCRETOS LTDA", "26722731000134", null, null, null, null, rep);

        String q = util.gerarQualificacaoPorPessoaId(7062L, true);

        assertThat(q).contains("administrador ");
        assertThat(q).containsIgnoringCase("JOSE ALEX LEITE");
        assertThat(q).doesNotContain("<strong>Jose Alex Leite</strong>");
        assertThat(q).doesNotContain("<strong>JOSE ALEX LEITE</strong>");
    }

    @Test
    void pjComUmRepresentante_anexaQualificacaoDoRepresentante() {
        // J.J.A (PJ feminina) representada por JOSE ALEX LEITE (masculino).
        PessoaEntity rep = stubPessoa(7193L, "JOSE ALEX LEITE", "11657370780", "M", "casado",
                "399971049", "SSP/SP", null);
        stubPessoa(7062L, "J.J.A CONCRETOS LTDA", "26722731000134", null, null, null, null, rep);

        String q = util.gerarQualificacaoPorPessoaId(7062L, true);

        assertThat(q).contains("pessoa jurídica de direito privado");
        assertThat(q).contains(", neste ato representada por seu administrador ");
        assertThat(q).containsIgnoringCase("JOSE ALEX LEITE");
        assertThat(q).doesNotContain("<strong>Jose Alex Leite</strong>");
        // O representante é qualificado como PF (tem seu CPF), não como PJ.
        assertThat(q).contains("CPF/MF");
    }

    @Test
    void pjSemRepresentante_naoAnexaSufixo() {
        stubPessoa(7062L, "J.J.A CONCRETOS LTDA", "26722731000134", null, null, null, null, null);

        String q = util.gerarQualificacaoPorPessoaId(7062L, true);

        assertThat(q).contains("pessoa jurídica de direito privado");
        assertThat(q).doesNotContain("neste ato represent");
    }

    @Test
    void concordancia_pjFemininaRepresentanteMasculino() {
        PessoaEntity rep = stubPessoa(2L, "JOSE ALEX LEITE", "11657370780", "M", "casado", null, null, null);
        stubPessoa(1L, "J.J.A CONCRETOS LTDA", "26722731000134", null, null, null, null, rep);

        String q = util.gerarQualificacaoPorPessoaId(1L, false);

        assertThat(q).contains(", neste ato representada por seu administrador ");
    }

    @Test
    void concordancia_pjFemininaRepresentanteFeminina() {
        PessoaEntity rep = stubPessoa(2L, "MARIA SOUZA LIMA", "11657370780", "F", "casada", null, null, null);
        stubPessoa(1L, "J.J.A CONCRETOS LTDA", "26722731000134", null, null, null, null, rep);

        String q = util.gerarQualificacaoPorPessoaId(1L, false);

        assertThat(q).contains(", neste ato representada por sua administradora ");
    }

    @Test
    void concordancia_pjMasculinaRepresentanteMasculino() {
        // "CONDOMINIO ..." → gênero masculino pelo nome → "representado".
        PessoaEntity rep = stubPessoa(2L, "JOAO PEREIRA", "11657370780", "M", "casado", null, null, null);
        stubPessoa(1L, "CONDOMINIO TERRA MUNDI EMPREENDIMENTOS LTDA", "26722731000134", null, null, null, null, rep);

        String q = util.gerarQualificacaoPorPessoaId(1L, false);

        assertThat(q).contains(", neste ato representado por seu administrador ");
    }

    @Test
    void concordancia_pjMasculinaRepresentanteFeminina() {
        PessoaEntity rep = stubPessoa(2L, "MARIA SOUZA LIMA", "11657370780", "F", "casada", null, null, null);
        stubPessoa(1L, "CONDOMINIO TERRA MUNDI EMPREENDIMENTOS LTDA", "26722731000134", null, null, null, null, rep);

        String q = util.gerarQualificacaoPorPessoaId(1L, false);

        assertThat(q).contains(", neste ato representado por sua administradora ");
    }
}
