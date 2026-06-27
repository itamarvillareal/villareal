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
class TopicoProcessadorServiceLocacaoPluralTest {

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
    void processarTemplateLocacao_pluralizaVerboEAdjetivoComDoisReus() {
        when(pessoaRepository.findById(1L)).thenReturn(Optional.of(pessoa(1L, "Locador")));
        when(pessoaRepository.findById(2L)).thenReturn(Optional.of(pessoa(2L, "Carlos")));
        when(pessoaRepository.findById(3L)).thenReturn(Optional.of(pessoa(3L, "Maria")));

        String template =
                "§3º Ucase(Propercase(Adequa(\"@\",\"Reu\",\"os\"))) Adequa(\"@\",\"Reu\",\"locatário\") "
                        + "fica responsável pelo pagamento do aluguel.";

        TopicoProcessadorService.ResultadoProcessamento resultado = service.processarTemplateLocacao(
                template, 1L, List.of(2L, 3L), List.of(), Map.of());

        assertThat(resultado.texto()).isEqualTo(
                "§3º Os Locatários ficam responsáveis pelo pagamento do aluguel.");
    }

    @Test
    void processarTemplateLocacao_ucasePropercaseArtigoOs_ficaOsNaoOS() {
        when(pessoaRepository.findById(1L)).thenReturn(Optional.of(pessoa(1L, "Locador")));
        when(pessoaRepository.findById(2L)).thenReturn(Optional.of(pessoa(2L, "Carlos")));
        when(pessoaRepository.findById(3L)).thenReturn(Optional.of(pessoa(3L, "Maria")));

        String template =
                "§3º Ucase(Propercase(Adequa(\"@\",\"Reu\",\"os\"))) Adequa(\"@\",\"Reu\",\"locatário\") fica responsável.";

        TopicoProcessadorService.ResultadoProcessamento resultado = service.processarTemplateLocacao(
                template, 1L, List.of(2L, 3L), List.of(), Map.of());

        assertThat(resultado.texto()).isEqualTo("§3º Os Locatários ficam responsáveis.");
        assertThat(resultado.texto()).doesNotContain("OS Locatários");
        assertThat(resultado.texto()).doesNotContain(" fica ");
    }

    @Test
    void processarTemplateLocacao_pluralizaLocatarioComDoisReus() {
        when(pessoaRepository.findById(1L)).thenReturn(Optional.of(pessoa(1L, "Locador")));
        when(pessoaRepository.findById(2L)).thenReturn(Optional.of(pessoa(2L, "Carlos")));
        when(pessoaRepository.findById(3L)).thenReturn(Optional.of(pessoa(3L, "Maria")));

        String template = "Adequa(\"@\",\"Reu\",\"o\") Adequa(\"@\",\"Reu\",\"Locatário\") deve pagar o aluguel.";

        TopicoProcessadorService.ResultadoProcessamento resultado = service.processarTemplateLocacao(
                template, 1L, List.of(2L, 3L), List.of(), Map.of());

        assertThat(resultado.texto()).isEqualTo("os Locatários devem pagar o aluguel.");
    }

    @Test
    void processarTemplateLocacao_preambuloComQualificacaoCompletaPorLocatario() {
        when(pessoaRepository.findById(1L)).thenReturn(Optional.of(pessoa(1L, "Locador Teste")));
        when(pessoaRepository.findById(2L)).thenReturn(Optional.of(pessoa(2L, "Carlos Silva")));
        when(pessoaRepository.findById(3L)).thenReturn(Optional.of(pessoa(3L, "Maria Souza")));
        when(qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(2L))
                .thenReturn("Carlos Silva, brasileiro, solteiro");
        when(qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(3L))
                .thenReturn("Maria Souza, brasileira, casada");

        String template =
                "como LOCATÁRIOS, Nome(\"Reu\",\"all\"), Qualifica_Sem_Nome_(\"Reu\",\"all\"), têm por justo";

        TopicoProcessadorService.ResultadoProcessamento resultado =
                service.processarTemplateLocacao(template, 1L, List.of(2L, 3L), List.of(), Map.of());

        assertThat(resultado.texto()).contains("Carlos Silva, brasileiro, solteiro");
        assertThat(resultado.texto()).contains("Maria Souza, brasileira, casada");
        assertThat(resultado.texto()).doesNotContain("Carlos Silva e Maria Souza");
        assertThat(resultado.texto()).doesNotContain("Nome(\"Reu\"");
    }

    private static PessoaEntity pessoa(Long id, String nome) {
        PessoaEntity p = new PessoaEntity();
        p.setId(id);
        p.setNome(nome);
        return p;
    }
}
