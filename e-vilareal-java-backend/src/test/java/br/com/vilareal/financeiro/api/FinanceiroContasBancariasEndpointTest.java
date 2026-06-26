package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.ContaBancariaResponse;
import br.com.vilareal.financeiro.application.ContaBancariaApplicationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * B3 / Passo 2: o endpoint expõe a classificação das contas (numero_banco, banco_nome, tipo,
 * tem_extrato, ativo) para o frontend consumir no B4.
 */
@ExtendWith(MockitoExtension.class)
class FinanceiroContasBancariasEndpointTest {

    @Mock
    private ContaBancariaApplicationService contaBancariaService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FinanceiroController controller = new FinanceiroController(
                mock(br.com.vilareal.financeiro.application.FinanceiroApplicationService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroCartaoApplicationService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroPagamentoFaturaApplicationService.class),
                mock(br.com.vilareal.financeiro.application.RegraClassificacaoApplicationService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroSugestaoService.class),
                mock(br.com.vilareal.financeiro.application.ClassificacaoAutomaticaService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroCompensacaoService.class),
                mock(br.com.vilareal.financeiro.application.CartaoBancoMapeamentoApplicationService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroFaturaSugestaoService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroSaudeService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroMesApplicationService.class),
                contaBancariaService,
                mock(br.com.vilareal.financeiro.application.FinanceiroSemelhantesEscritorioService.class),
                mock(br.com.vilareal.financeiro.application.FinanceiroFaturaCartaoFechamentoService.class),
                mock(br.com.vilareal.financeiro.application.InboxClassificarApplicationService.class),
                mock(br.com.vilareal.financeiro.application.ExtratoPosImportApplicationService.class),
                mock(br.com.vilareal.financeiro.application.ExtratoImportProtecaoService.class),
                mock(br.com.vilareal.financeiro.application.LancamentoFinanceiroImportDedupService.class));
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void listarContasBancarias_devolveClassificacaoCorreta() throws Exception {
        when(contaBancariaService.listar()).thenReturn(List.of(
                new ContaBancariaResponse(1, "Itau", "REAL", true, true, null, null, null),
                new ContaBancariaResponse(9, "LANÇ MANUAIS", "MANUAL", false, true, null, null, null),
                new ContaBancariaResponse(17, "LANÇ EM DINHEIRO", "MANUAL", false, true, null, null, null),
                new ContaBancariaResponse(18, "LANÇ MANUAIS (2)", "MANUAL", false, true, null, null, null),
                new ContaBancariaResponse(900, "REPASSE INTERNO", "VIRTUAL", false, true, null, null, null)));

        mockMvc.perform(get("/api/financeiro/contas-bancarias"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].numeroBanco").value(1))
                .andExpect(jsonPath("$[0].tipo").value("REAL"))
                .andExpect(jsonPath("$[0].temExtrato").value(true))
                .andExpect(jsonPath("$[1].numeroBanco").value(9))
                .andExpect(jsonPath("$[1].tipo").value("MANUAL"))
                .andExpect(jsonPath("$[1].temExtrato").value(false))
                .andExpect(jsonPath("$[4].numeroBanco").value(900))
                .andExpect(jsonPath("$[4].tipo").value("VIRTUAL"))
                .andExpect(jsonPath("$[4].temExtrato").value(false));
    }
}
