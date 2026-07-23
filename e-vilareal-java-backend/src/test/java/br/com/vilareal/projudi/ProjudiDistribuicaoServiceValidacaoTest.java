package br.com.vilareal.projudi;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiDistribuicaoServiceValidacaoTest {

    @Mock
    private ProjudiSessionService sessionService;

    @Mock
    private ProjudiParteResolverService parteResolverService;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProcessoParteRepository processoParteRepository;

    private ProjudiDistribuicaoService service;

    @BeforeEach
    void setUp() {
        service = new ProjudiDistribuicaoService(
                sessionService,
                parteResolverService,
                processoRepository,
                processoParteRepository,
                null,
                new ObjectMapper());
    }

    @Test
    void validarProntidao_listaTodosOsCamposObrigatorios() {
        var res = service.validarProntidao(1L, "", List.of(), null, null, 0, null);

        assertFalse(res.pronta());
        assertTrue(res.bloqueios().contains("Valor da causa não informado."));
        assertTrue(res.bloqueios().contains("Nenhum assunto PROJUDI selecionado."));
        assertTrue(res.bloqueios().contains("Autor não selecionado."));
        assertTrue(res.bloqueios().contains("Ao menos um réu deve ser selecionado."));
        assertTrue(res.bloqueios().contains("Nenhum anexo .p7s adicionado."));
    }

    @Test
    void validarProntidao_incluiPendenciasDasPartes() {
        ParteProjudiResolvida autorPendente = partePendente("Bairro não encontrado no PROJUDI.");
        when(parteResolverService.resolver(eq(10L), eq(1L), isNull())).thenReturn(autorPendente);
        when(parteResolverService.resolver(eq(20L), eq(1L), isNull())).thenReturn(partePronta());

        var res = service.validarProntidao(1L, "1500,00", List.of(451), 10L, List.of(20L), 2, null);

        assertFalse(res.pronta());
        assertEquals(1, res.pendenciasPartes().size());
        assertEquals("AUTOR", res.pendenciasPartes().getFirst().papel());
        assertTrue(res.bloqueios().stream().anyMatch((b) -> b.contains("Autor:") && b.contains("Bairro")));
    }

    @Test
    void validarProntidao_prontaQuandoTudoOk() {
        when(parteResolverService.resolver(eq(10L), eq(1L), isNull())).thenReturn(partePronta());
        when(parteResolverService.resolver(eq(20L), eq(1L), isNull())).thenReturn(partePronta());

        var res = service.validarProntidao(1L, "1500,00", List.of(451), 10L, List.of(20L), 1, null);

        assertTrue(res.pronta());
        assertTrue(res.bloqueios().isEmpty());
        assertTrue(res.pendenciasPartes().isEmpty());
    }

    @Test
    void validarProntidao_bloqueiaAnexoAcimaDe3Mb() {
        when(parteResolverService.resolver(eq(10L), eq(1L), isNull())).thenReturn(partePronta());
        when(parteResolverService.resolver(eq(20L), eq(1L), isNull())).thenReturn(partePronta());

        long acima = ProjudiDistribuicaoService.MAX_BYTES_ANEXO_P7S + 1;
        var res = service.validarProntidao(
                1L,
                "1500,00",
                List.of(451),
                10L,
                List.of(20L),
                1,
                null,
                List.of(new ProjudiDistribuicaoService.AnexoMeta("09.FICHA.pdf.p7s", acima)));

        assertFalse(res.pronta());
        assertTrue(res.bloqueios().stream().anyMatch((b) -> b.contains("09.FICHA.pdf.p7s") && b.contains("3 MB")));
    }

    @Test
    void validarProntidao_validaVariosReus() {
        when(parteResolverService.resolver(eq(10L), eq(1L), isNull())).thenReturn(partePronta());
        when(parteResolverService.resolver(eq(20L), eq(1L), isNull())).thenReturn(partePronta());
        when(parteResolverService.resolver(eq(30L), eq(1L), isNull())).thenReturn(partePendente("Cidade não encontrada."));

        var res = service.validarProntidao(1L, "1500,00", List.of(451), 10L, List.of(20L, 30L), 1, null);

        assertFalse(res.pronta());
        assertEquals(2, res.reus().size());
        assertEquals(1, res.pendenciasPartes().size());
        assertEquals("REU_2", res.pendenciasPartes().getFirst().papel());
        assertTrue(res.bloqueios().stream().anyMatch((b) -> b.contains("Réu 2") && b.contains("Cidade")));
    }

    @Test
    void validarProntidao_converteExcecaoDoResolverEmBloqueio() {
        when(parteResolverService.resolver(eq(10L), eq(1L), isNull()))
                .thenThrow(new BusinessRuleException("credencial PROJUDI inválida"));
        when(parteResolverService.resolver(eq(20L), eq(1L), isNull())).thenReturn(partePronta());

        var res = service.validarProntidao(1L, "1500,00", List.of(451), 10L, List.of(20L), 1, null);

        assertFalse(res.pronta());
        assertTrue(res.bloqueios().stream().anyMatch((b) -> b.contains("Autor:") && b.contains("credencial PROJUDI")));
        assertNull(res.autor());
    }

    @Test
    void validarProntidao_usaEnderecoEscolhidoNoProcesso() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(10L);
        PessoaEnderecoEntity endereco = new PessoaEnderecoEntity();
        endereco.setId(30939L);
        ProcessoParteEntity parte = new ProcessoParteEntity();
        parte.setPessoa(pessoa);
        parte.setPessoaEndereco(endereco);
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(30028L)).thenReturn(List.of(parte));
        when(parteResolverService.resolver(eq(10L), eq(1L), eq(30939L))).thenReturn(partePronta());
        when(parteResolverService.resolver(eq(20L), eq(1L), isNull())).thenReturn(partePronta());

        var res = service.validarProntidao(1L, "1500,00", List.of(451), 10L, List.of(20L), 1, 30028L);

        assertTrue(res.pronta());
        assertEquals(30939L, service.enderecoIdDaParteNoProcesso(30028L, 10L));
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
