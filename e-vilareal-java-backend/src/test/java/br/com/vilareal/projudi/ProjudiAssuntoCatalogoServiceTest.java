package br.com.vilareal.projudi;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiAssuntoCadastroRepository;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiAssuntoOcultoRepository;

class ProjudiAssuntoCatalogoServiceTest {

    private ProjudiAssuntoCadastroRepository assuntoCadastroRepository;
    private ProjudiAssuntoOcultoRepository assuntoOcultoRepository;
    private ProjudiAssuntoCatalogoService service;

    @BeforeEach
    void setUp() {
        assuntoCadastroRepository = mock(ProjudiAssuntoCadastroRepository.class);
        assuntoOcultoRepository = mock(ProjudiAssuntoOcultoRepository.class);
        when(assuntoCadastroRepository.findAllByOrderByIdAssuntoAsc()).thenReturn(List.of());
        when(assuntoOcultoRepository.findAll()).thenReturn(List.of());
        service = new ProjudiAssuntoCatalogoService(assuntoCadastroRepository, assuntoOcultoRepository);
    }

    @Test
    void listarCatalogo_contemAssuntosConfirmados() {
        var lista = service.listarCatalogo();
        assertTrue(lista.stream().anyMatch(a -> a.idAssunto() == 451));
        assertTrue(lista.stream().anyMatch(a -> a.idAssunto() == 985));
        assertTrue(lista.stream().anyMatch(a -> a.idAssunto() == 1991));
    }

    @Test
    void listarClasses_contemJecEExecucao() {
        var classes = service.listarClasses();
        assertTrue(classes.stream().anyMatch(c -> c.idProcessoTipo() == 162 && c.processoTipoCodigo() == 1436));
        assertTrue(classes.stream().anyMatch(c -> c.idProcessoTipo() == 114 && c.processoTipoCodigo() == 1159));
    }

    @Test
    void sugerir_cobrancaRetorna451Jec() {
        var res = service.sugerirModalidade("Ação de COBRANÇA");
        assertEquals(451, res.idAssuntoSugerido());
        assertEquals(162, res.idProcessoTipo());
        assertEquals(1436, res.processoTipoCodigo());
        assertEquals("COBRANCA_JEC", res.modalidadeId());
    }

    @Test
    void sugerir_execucaoTaxaCondominialRetorna1991Execucao() {
        var res = service.sugerirModalidade("AÇÃO DE EXECUÇÃO DE TAXA CONDOMINIAL");
        assertEquals(1991, res.idAssuntoSugerido());
        assertEquals(114, res.idProcessoTipo());
        assertEquals(1159, res.processoTipoCodigo());
        assertEquals("EXECUCAO_TAXA_CONDOMINIAL", res.modalidadeId());
    }

    @Test
    void sugerir_execucaoAntesDeCobrancaQuandoAmbosPresentes() {
        var res = service.sugerirModalidade("EXECUÇÃO DE TAXA CONDOMINIAL E COBRANÇA");
        assertEquals(1991, res.idAssuntoSugerido());
        assertEquals(114, res.idProcessoTipo());
    }

    @Test
    void sugerir_semRegraRetornaNull() {
        assertNull(service.sugerirIdAssunto("EXECUÇÃO DE TÍTULO EXTRAJUDICIAL"));
        assertNull(service.sugerirModalidade("").idAssuntoSugerido());
        assertNull(service.sugerirModalidade(null).idAssuntoSugerido());
    }

    @Test
    void resolverClasse_defaultJecQuandoParametrosAusentes() {
        assertEquals(ProjudiClasseProcessoInicial.JEC, service.resolverClasse(null, null));
    }

    @Test
    void normalizar_removeAcentos() {
        assertEquals("COBRANCA", ProjudiAssuntoCatalogoService.normalizarNaturezaAcao("Cobrança"));
        assertEquals(
                "ACAO DE EXECUCAO DE TAXA CONDOMINIAL",
                ProjudiAssuntoCatalogoService.normalizarNaturezaAcao("AÇÃO DE EXECUÇÃO DE TAXA CONDOMINIAL"));
        assertTrue(ProjudiAssuntoCatalogoService.normalizarNaturezaAcao("  ").isEmpty());
    }
}
