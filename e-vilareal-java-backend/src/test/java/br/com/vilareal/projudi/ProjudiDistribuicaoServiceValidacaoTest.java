package br.com.vilareal.projudi;

import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiParteResolverService.CampoResolvido;
import br.com.vilareal.projudi.ProjudiParteResolverService.NivelResolucao;
import br.com.vilareal.projudi.ProjudiParteResolverService.ParteProjudiResolvida;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiDistribuicaoServiceValidacaoTest {

    @Mock
    private ProjudiSessionService sessionService;

    @Mock
    private ProjudiParteResolverService parteResolverService;

    @Mock
    private ProcessoRepository processoRepository;

    private ProjudiDistribuicaoService service;

    @BeforeEach
    void setUp() {
        service = new ProjudiDistribuicaoService(
                sessionService, parteResolverService, processoRepository, new ObjectMapper());
    }

    @Test
    void validarProntidao_listaTodosOsCamposObrigatorios() {
        var res = service.validarProntidao(1L, "", List.of(), null, null, 0);

        assertFalse(res.pronta());
        assertTrue(res.bloqueios().contains("Valor da causa não informado."));
        assertTrue(res.bloqueios().contains("Nenhum assunto PROJUDI selecionado."));
        assertTrue(res.bloqueios().contains("Autor não selecionado."));
        assertTrue(res.bloqueios().contains("Réu não selecionado."));
        assertTrue(res.bloqueios().contains("Nenhum anexo .p7s adicionado."));
    }

    @Test
    void validarProntidao_incluiPendenciasDasPartes() {
        ParteProjudiResolvida autorPendente = partePendente("Bairro não encontrado no PROJUDI.");
        when(parteResolverService.resolver(eq(10L), eq(1L))).thenReturn(autorPendente);
        when(parteResolverService.resolver(eq(20L), eq(1L))).thenReturn(partePronta());

        var res = service.validarProntidao(1L, "1500,00", List.of(451), 10L, 20L, 2);

        assertFalse(res.pronta());
        assertEquals(1, res.pendenciasPartes().size());
        assertEquals("AUTOR", res.pendenciasPartes().getFirst().papel());
        assertTrue(res.bloqueios().stream().anyMatch((b) -> b.contains("Autor:") && b.contains("Bairro")));
    }

    @Test
    void validarProntidao_prontaQuandoTudoOk() {
        when(parteResolverService.resolver(eq(10L), eq(1L))).thenReturn(partePronta());
        when(parteResolverService.resolver(eq(20L), eq(1L))).thenReturn(partePronta());

        var res = service.validarProntidao(1L, "1500,00", List.of(451), 10L, 20L, 1);

        assertTrue(res.pronta());
        assertTrue(res.bloqueios().isEmpty());
        assertTrue(res.pendenciasPartes().isEmpty());
    }

    private static ParteProjudiResolvida partePronta() {
        CampoResolvido ok = CampoResolvido.resolvido("GO", 1, "Goiás");
        return new ParteProjudiResolvida(
                "Nome",
                "12345678901",
                "CPF",
                null,
                null,
                "Rua",
                "1",
                null,
                "75000000",
                ok,
                ok,
                ok,
                true,
                List.of());
    }

    private static ParteProjudiResolvida partePendente(String motivo) {
        CampoResolvido pendente = CampoResolvido.pendente("Centro", motivo);
        return new ParteProjudiResolvida(
                "Nome",
                "12345678901",
                "CPF",
                null,
                null,
                "Rua",
                "1",
                null,
                "75000000",
                CampoResolvido.resolvido("GO", 1, "Goiás"),
                CampoResolvido.resolvido("Anápolis", 2, "Anápolis"),
                pendente,
                false,
                List.of(motivo));
    }
}
