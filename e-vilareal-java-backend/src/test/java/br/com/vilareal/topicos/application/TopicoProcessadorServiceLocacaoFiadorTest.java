package br.com.vilareal.topicos.application;

import br.com.vilareal.documento.QualificacaoPessoaUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TopicoProcessadorServiceLocacaoFiadorTest {

    @Mock
    private TopicoRepository topicoRepository;

    @Mock
    private ProcessoParteRepository processoParteRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private QualificacaoPessoaUtil qualificacaoPessoaUtil;

    private TopicoProcessadorService service;

    @BeforeEach
    void setUp() {
        service = new TopicoProcessadorService(
                topicoRepository, processoParteRepository, pessoaRepository, qualificacaoPessoaUtil);
    }

    @Test
    void processarTemplateLocacao_substituiQualificaFiadorMesmoComClassDoProcesso() {
        PessoaEntity locador = pessoa(1L, "Locador Teste");
        PessoaEntity inquilino = pessoa(2L, "Inquilino Teste");
        PessoaEntity fiador = pessoa(10L, "Maria Silva");

        when(pessoaRepository.findById(1L)).thenReturn(Optional.of(locador));
        when(pessoaRepository.findById(2L)).thenReturn(Optional.of(inquilino));
        when(pessoaRepository.findById(10L)).thenReturn(Optional.of(fiador));
        when(qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(10L))
                .thenReturn("MARIA SILVA, brasileira, solteira, empresária");

        String template =
                "assim Qualifica(\"Fiador\",\"all\",Class_do_Processo), apresenta como prova de solvência";

        TopicoProcessadorService.ResultadoProcessamento resultado =
                service.processarTemplateLocacao(template, 1L, 2L, List.of(10L), Map.of("Class_do_Processo", ""));

        assertThat(resultado.texto()).contains("MARIA SILVA, brasileira, solteira, empresária");
        assertThat(resultado.texto()).doesNotContain("Qualifica(\"Fiador\"");
        assertThat(resultado.texto()).doesNotContain("Class_do_Processo");
    }

    private static PessoaEntity pessoa(Long id, String nome) {
        PessoaEntity p = new PessoaEntity();
        p.setId(id);
        p.setNome(nome);
        return p;
    }
}
