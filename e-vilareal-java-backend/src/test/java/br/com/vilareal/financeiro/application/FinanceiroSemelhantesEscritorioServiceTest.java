package br.com.vilareal.financeiro.application;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.api.dto.DescartarSemelhanteEscritorioItemRequest;
import br.com.vilareal.financeiro.api.dto.DescartarSemelhanteEscritorioRequest;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.MatchResult;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioOrigem;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.PendenteItem;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.SemelhanteEscritorioDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SemelhanteEscritorioDescarteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroSemelhantesEscritorioServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private ProcessoRepository processoRepository;
    @Mock
    private ProcessoApplicationService processoApplicationService;
    @Mock
    private CalculoRodadaRepository calculoRodadaRepository;
    @Mock
    private PessoaRepository pessoaRepository;
    @Mock
    private SemelhanteEscritorioDescarteRepository descarteRepository;

    private FinanceiroSemelhantesEscritorioService service;

    @BeforeEach
    void setUp() {
        service = new FinanceiroSemelhantesEscritorioService(
                lancamentoRepository,
                contaContabilRepository,
                clienteRepository,
                processoRepository,
                processoApplicationService,
                calculoRodadaRepository,
                pessoaRepository,
                descarteRepository);
    }

    @Test
    void parearEmCamadas_semHistorico_sugerePorNome() {
        PendenteItem pend = new PendenteItem(
                50L,
                LocalDate.of(2026, 6, 17),
                "PIX TRANSF FRANCISCO JEFFERSON DA SILVA SOUZA",
                "pix transf francisco jefferson da silva souza",
                new BigDecimal("195.80"),
                756,
                "Sicoob");

        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(501L);
        pessoa.setNome("Francisco Jefferson Da Silva Souza");

        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(99L);
        cliente.setCodigoCliente("00000728");

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(1345L);
        processo.setNumeroInterno(1345);
        processo.setCliente(cliente);

        when(processoRepository.findPessoaProcessoIdsPorNomeContidoNaDescricao(any()))
                .thenReturn(List.<Object[]>of(new Object[] {501L, 1345L}));
        when(pessoaRepository.findById(501L)).thenReturn(Optional.of(pessoa));
        when(processoRepository.findById(1345L)).thenReturn(Optional.of(processo));
        when(calculoRodadaRepository.findByParcelamentoAceitoTrue()).thenReturn(List.of());

        var matches = service.parearEmCamadas(List.of(pend), List.of());

        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).origem()).isEqualTo(SemelhanteEscritorioOrigem.NOME_PESSOA);
        assertThat(matches.get(0).sugestaoClienteId()).isEqualTo(99L);
        assertThat(matches.get(0).sugestaoProcessoId()).isEqualTo(1345L);
    }

    @Test
    void parearEmCamadas_calculoTemPrioridadeSobreNome() throws Exception {
        PendenteItem pend = new PendenteItem(
                51L,
                LocalDate.of(2026, 6, 6),
                "PIX TRANSF FRANCISCO JEFFERSON DA SILVA SOUZA",
                "pix transf francisco jefferson da silva souza",
                new BigDecimal("195.80"),
                756,
                "Sicoob");

        CalculoRodadaEntity rodada = rodadaCalculo("00000728", 1345, "05/06/2026", "R$ 195,80");
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(99L);
        cliente.setCodigoCliente("00000728");
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(1345L);
        processo.setNumeroInterno(1345);
        processo.setCliente(cliente);

        when(calculoRodadaRepository.findByParcelamentoAceitoTrue()).thenReturn(List.of(rodada));
        when(clienteRepository.findByCodigoCliente("00000728")).thenReturn(Optional.of(cliente));
        when(processoRepository.findByCliente_IdAndNumeroInterno(99L, 1345)).thenReturn(Optional.of(processo));

        var matches = service.parearEmCamadas(List.of(pend), List.of());

        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).origem()).isEqualTo(SemelhanteEscritorioOrigem.CALCULO_PARCELA);
    }

    @Test
    void filtrarRejeitados_removeParJaRejeitado() {
        PendenteItem pend = new PendenteItem(
                50L,
                LocalDate.of(2026, 6, 17),
                "PIX TESTE",
                "pix teste",
                new BigDecimal("100.00"),
                756,
                "Sicoob");
        MatchResult match = MatchResult.nomePessoa(pend, 99L, 1345L, 501L, "Fulano");
        SemelhanteEscritorioDescarteEntity descarte = new SemelhanteEscritorioDescarteEntity();
        descarte.setLancamentoId(50L);
        descarte.setClienteId(99L);
        descarte.setProcessoId(1345L);

        when(descarteRepository.findByLancamentoIdIn(any())).thenReturn(List.of(descarte));

        var filtrados = service.filtrarRejeitados(List.of(match), List.of(pend));

        assertThat(filtrados).isEmpty();
    }

    @Test
    void descartarSugestoes_persisteRejeicao() {
        DescartarSemelhanteEscritorioRequest req = new DescartarSemelhanteEscritorioRequest();
        DescartarSemelhanteEscritorioItemRequest item = new DescartarSemelhanteEscritorioItemRequest();
        item.setLancamentoId(50L);
        item.setClienteId(99L);
        item.setProcessoId(1345L);
        req.setItens(List.of(item));

        when(descarteRepository.existsByLancamentoIdAndClienteIdAndProcessoId(50L, 99L, 1345L))
                .thenReturn(false);

        var res = service.descartarSugestoes(req);

        assertThat(res.getDescartados()).isEqualTo(1);
        verify(descarteRepository).save(any(SemelhanteEscritorioDescarteEntity.class));
    }

    private static CalculoRodadaEntity rodadaCalculo(String cod8, int proc, String venc, String valor)
            throws Exception {
        ObjectMapper json = new ObjectMapper();
        ObjectNode payload = json.createObjectNode();
        payload.put("parcelamentoAceito", true);
        payload.put("quantidadeParcelasInformada", "1");
        var parcelas = json.createArrayNode();
        ObjectNode p = json.createObjectNode();
        p.put("dataVencimento", venc);
        p.put("valorParcela", valor);
        parcelas.add(p);
        payload.set("parcelas", parcelas);

        CalculoRodadaEntity e = new CalculoRodadaEntity();
        e.setCodigoCliente(cod8);
        e.setNumeroProcesso(proc);
        e.setDimensao(1);
        e.setParcelamentoAceito(true);
        e.setPayloadJson(payload);
        return e;
    }
}
