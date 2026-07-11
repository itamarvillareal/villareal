package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.api.dto.AluguelTriagemResponse;
import br.com.vilareal.imovel.api.dto.SugestoesAluguelPendenteResponse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaItemDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.service.CobrancaWhatsAppService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AluguelCobrancaServiceTest {

    /** Competência fixa no passado: qualquer pendente sem sugestão está vencido. */
    private static final String COMPETENCIA_PASSADA = "2020-01";

    @Mock
    private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock
    private LocacaoReconciliacaoService reconciliacaoService;
    @Mock
    private ImovelProcessoRepository imovelProcessoRepository;
    @Mock
    private CobrancaWhatsAppService cobrancaWhatsAppService;
    @Mock
    private CobrancaWhatsAppRepository cobrancaWhatsAppRepository;

    @InjectMocks
    private AluguelCobrancaService service;

    @Test
    void triagemClassificaAtrasoQuandoVencidoSemSugestao() {
        ContratoLocacaoEntity contrato = contrato(1L, 42, "Sergio Gonzaga");
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq(COMPETENCIA_PASSADA), any(), any()))
                .thenReturn(List.of(contrato));
        when(reconciliacaoService.sugerirAlugueisPendentes(COMPETENCIA_PASSADA))
                .thenReturn(new SugestoesAluguelPendenteResponse(COMPETENCIA_PASSADA, 1, 0, List.of()));
        when(cobrancaWhatsAppService.resolverTelefonePessoa(10L, null)).thenReturn("62999990000");
        when(cobrancaWhatsAppRepository.existsCobrancaNoMes(eq(77L), any(), any())).thenReturn(false);

        AluguelTriagemResponse resp = service.triagem(COMPETENCIA_PASSADA);

        assertThat(resp.totalEmAtraso()).isEqualTo(1);
        assertThat(resp.totalPagamentoProvavel()).isZero();
        AluguelTriagemResponse.Item item = resp.itens().get(0);
        assertThat(item.situacao()).isEqualTo(AluguelCobrancaService.SITUACAO_EM_ATRASO);
        assertThat(item.diasAtraso()).isGreaterThan(0);
        assertThat(item.dataVencimento()).isEqualTo(LocalDate.of(2020, 1, 5));
        assertThat(item.temTelefone()).isTrue();
        assertThat(item.jaCobradoEsteMes()).isFalse();
    }

    @Test
    void triagemClassificaPagamentoProvavelQuandoHaSugestaoNoExtrato() {
        ContratoLocacaoEntity contrato = contrato(1L, 42, "Maria Jose");
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq(COMPETENCIA_PASSADA), any(), any()))
                .thenReturn(List.of(contrato));
        var sugestaoCredito = new SugestoesAluguelPendenteResponse.SugestaoCreditoItem(
                99L, LocalDate.of(2020, 1, 6), "PIX MARIA JOSE", new BigDecimal("1000.00"),
                26, "ORFAO", "ALTA", true, true, true);
        var contratoComSugestao = new SugestoesAluguelPendenteResponse.ContratoPendenteItem(
                1L, 42, "Rua A, 1", "Maria Jose", new BigDecimal("1000.00"), 5, List.of(sugestaoCredito));
        when(reconciliacaoService.sugerirAlugueisPendentes(COMPETENCIA_PASSADA))
                .thenReturn(new SugestoesAluguelPendenteResponse(
                        COMPETENCIA_PASSADA, 1, 1, List.of(contratoComSugestao)));
        lenient().when(cobrancaWhatsAppService.resolverTelefonePessoa(any(), any())).thenReturn(null);
        lenient().when(cobrancaWhatsAppRepository.existsCobrancaNoMes(any(), any(), any())).thenReturn(false);

        AluguelTriagemResponse resp = service.triagem(COMPETENCIA_PASSADA);

        assertThat(resp.totalPagamentoProvavel()).isEqualTo(1);
        assertThat(resp.totalEmAtraso()).isZero();
        AluguelTriagemResponse.Item item = resp.itens().get(0);
        assertThat(item.situacao()).isEqualTo(AluguelCobrancaService.SITUACAO_PAGAMENTO_PROVAVEL);
        assertThat(item.confiancaPagamento()).isEqualTo("ALTA");
        assertThat(item.qtdSugestoesExtrato()).isEqualTo(1);
    }

    @Test
    void cobrarAlugueisDisparaLoteSemElegibilidadeCondominialSoParaPendentesSelecionados() {
        ContratoLocacaoEntity selecionado = contrato(1L, 42, "Sergio Gonzaga");
        ContratoLocacaoEntity naoSelecionado = contrato(2L, 43, "Outra Pessoa");
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq(COMPETENCIA_PASSADA), any(), any()))
                .thenReturn(List.of(selecionado, naoSelecionado));
        when(cobrancaWhatsAppService.resolverTelefonePessoa(10L, null)).thenReturn("62999990000");
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(77L))
                .thenReturn(Optional.empty());
        CobrancaLoteResultDTO resultado = new CobrancaLoteResultDTO("lote-1", 1, 1, 0, 0, 0, 0);
        when(cobrancaWhatsAppService.dispararLote(anyList(), anyString(), anyString(), eq(false)))
                .thenReturn(resultado);

        CobrancaLoteResultDTO resp = service.cobrarAlugueis(List.of(1L), COMPETENCIA_PASSADA, "itamar");

        assertThat(resp.enviados()).isEqualTo(1);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CobrancaItemDTO>> captor = ArgumentCaptor.forClass(List.class);
        verify(cobrancaWhatsAppService).dispararLote(captor.capture(), anyString(), eq("itamar"), eq(false));
        List<CobrancaItemDTO> itens = captor.getValue();
        assertThat(itens).hasSize(1);
        CobrancaItemDTO item = itens.get(0);
        assertThat(item.pessoaNome()).isEqualTo("Sergio Gonzaga");
        assertThat(item.telefone()).isEqualTo("62999990000");
        assertThat(item.valorPendente()).isEqualByComparingTo("1000.00");
    }

    @Test
    void cobrarAlugueisRecusaQuandoNenhumSelecionadoSeguePendente() {
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq(COMPETENCIA_PASSADA), any(), any()))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.cobrarAlugueis(List.of(1L), COMPETENCIA_PASSADA, "itamar"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("pendente");
        verify(cobrancaWhatsAppService, never()).dispararLote(anyList(), anyString(), anyString(), eq(false));
    }

    private static ContratoLocacaoEntity contrato(Long id, Integer numeroPlanilha, String inquilinoNome) {
        PessoaEntity inquilino = new PessoaEntity();
        inquilino.setId(10L);
        inquilino.setNome(inquilinoNome);
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(123L);
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(77L);
        imovel.setNumeroPlanilha(numeroPlanilha);
        imovel.setEnderecoCompleto("Rua A, 1");
        imovel.setCliente(cliente);
        ContratoLocacaoEntity c = new ContratoLocacaoEntity();
        c.setId(id);
        c.setImovel(imovel);
        c.setInquilinoPessoa(inquilino);
        c.setValorAluguel(new BigDecimal("1000.00"));
        c.setDiaVencimentoAluguel(5);
        return c;
    }
}
