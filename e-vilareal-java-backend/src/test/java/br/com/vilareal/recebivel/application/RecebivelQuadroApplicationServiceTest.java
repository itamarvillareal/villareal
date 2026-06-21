package br.com.vilareal.recebivel.application;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosParcelaRepository;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuParcelaEntity;
import br.com.vilareal.iptu.infrastructure.persistence.repository.IptuParcelaRepository;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.recebivel.domain.RecebivelQuadroStatus;
import br.com.vilareal.recebivel.domain.RecebivelQuadroTipo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecebivelQuadroApplicationServiceTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 6, 15);
    private static final LocalDate INICIO = LocalDate.of(2026, 6, 1);
    private static final LocalDate FIM = LocalDate.of(2026, 6, 30);

    @Mock
    private PagamentoRepository pagamentoRepository;
    @Mock
    private ContratoHonorariosParcelaRepository honorariosParcelaRepository;
    @Mock
    private IptuParcelaRepository iptuParcelaRepository;
    @Mock
    private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock
    private LocacaoReconciliacaoService locacaoReconciliacaoService;

    private RecebivelQuadroApplicationService service;

    @BeforeEach
    void clockFixo() {
        Clock clock = Clock.fixed(Instant.parse("2026-06-15T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        service = new RecebivelQuadroApplicationService(
                pagamentoRepository,
                honorariosParcelaRepository,
                iptuParcelaRepository,
                contratoLocacaoRepository,
                locacaoReconciliacaoService,
                clock);
    }

    @Test
    void quadroAgregaFontesSemDuplicarHonorariosComPagamento() {
        PagamentoEntity pagHonorarios = pagamentoReceber(1L, "1000.00", LocalDate.of(2026, 6, 10), "CONTRATO_HONORARIOS:9");
        ContratoHonorariosParcelaEntity parSemPag = parcelaHonorarios(2L, "500.00", LocalDate.of(2026, 6, 20));
        IptuParcelaEntity iptu = iptuParcela(3L, "120.00", LocalDate.of(2026, 6, 5));

        when(pagamentoRepository.findReceberAbertosNoPeriodo(INICIO, FIM)).thenReturn(List.of(pagHonorarios));
        when(honorariosParcelaRepository.findAbertasSemPagamentoNoPeriodo(INICIO, FIM)).thenReturn(List.of(parSemPag));
        when(iptuParcelaRepository.findAbertasNoPeriodo(INICIO, FIM)).thenReturn(List.of(iptu));
        when(contratoLocacaoRepository.findVigentesNoPeriodo(INICIO, FIM)).thenReturn(List.of());
        when(locacaoReconciliacaoService.chavesContratoCompetenciaComAluguelRecebido()).thenReturn(Set.of());

        var resp = service.quadro("ESTE_MES", null, null);

        assertThat(resp.itens()).hasSize(3);
        assertThat(resp.totalGeral()).isEqualByComparingTo("1620.00");
        assertThat(resp.resumoPorTipo()).extracting("tipo").contains(RecebivelQuadroTipo.MENSALIDADE, RecebivelQuadroTipo.ALUGUEL);
        assertThat(resp.resumoPorTipo().stream()
                        .filter(r -> r.tipo() == RecebivelQuadroTipo.HONORARIOS)
                        .findFirst()
                        .orElseThrow()
                        .quantidade())
                .isEqualTo(2);
        assertThat(resp.itens().stream().filter(i -> i.status() == RecebivelQuadroStatus.VENCIDO).count())
                .isEqualTo(2);
    }

    @Test
    void tipoDePagamentoUsaOrigemHonorarios() {
        PagamentoEntity p = pagamentoReceber(1L, "100", LocalDate.of(2026, 6, 1), "CONTRATO_HONORARIOS:1");
        p.setCategoria("CLIENTE");
        assertThat(RecebivelQuadroApplicationService.tipoDePagamento(p)).isEqualTo(RecebivelQuadroTipo.HONORARIOS);
    }

    @Test
    void statusItemVencidoQuandoAntesDeHoje() {
        assertThat(RecebivelQuadroApplicationService.statusItem(HOJE, LocalDate.of(2026, 6, 1), false))
                .isEqualTo(RecebivelQuadroStatus.VENCIDO);
        assertThat(RecebivelQuadroApplicationService.statusItem(HOJE, LocalDate.of(2026, 6, 20), false))
                .isEqualTo(RecebivelQuadroStatus.A_VENCER);
    }

    @Test
    void quadroIncluiAluguelEsperadoDeContratoLocacao() {
        when(pagamentoRepository.findReceberAbertosNoPeriodo(INICIO, FIM)).thenReturn(List.of());
        when(honorariosParcelaRepository.findAbertasSemPagamentoNoPeriodo(INICIO, FIM)).thenReturn(List.of());
        when(iptuParcelaRepository.findAbertasNoPeriodo(INICIO, FIM)).thenReturn(List.of());

        ContratoLocacaoEntity recebido = contratoLocacao(1L, "1200.00", 5, LocalDate.of(2026, 1, 1), null);
        ContratoLocacaoEntity vencido = contratoLocacao(2L, "900.00", 10, LocalDate.of(2026, 1, 1), null);
        ContratoLocacaoEntity aVencer = contratoLocacao(3L, "700.00", 25, LocalDate.of(2026, 1, 1), null);
        when(contratoLocacaoRepository.findVigentesNoPeriodo(INICIO, FIM))
                .thenReturn(List.of(recebido, vencido, aVencer));
        when(locacaoReconciliacaoService.chavesContratoCompetenciaComAluguelRecebido()).thenReturn(Set.of("1|2026-06"));

        var resp = service.quadro("ESTE_MES", null, null);
        var alugueis = resp.itens().stream().filter(i -> i.tipo() == RecebivelQuadroTipo.ALUGUEL).toList();

        assertThat(alugueis).hasSize(3);
        assertThat(alugueis.stream().filter(i -> i.status() == RecebivelQuadroStatus.RECEBIDO).count()).isEqualTo(1);
        assertThat(alugueis.stream().filter(i -> i.status() == RecebivelQuadroStatus.VENCIDO).count()).isEqualTo(1);
        assertThat(alugueis.stream().filter(i -> i.status() == RecebivelQuadroStatus.A_VENCER).count()).isEqualTo(1);
        assertThat(resp.resumoPorTipo().stream()
                        .filter(r -> r.tipo() == RecebivelQuadroTipo.ALUGUEL)
                        .findFirst()
                        .orElseThrow()
                        .quantidade())
                .isEqualTo(3);
        assertThat(resp.resumoPorTipo().stream()
                        .filter(r -> r.tipo() == RecebivelQuadroTipo.ALUGUEL)
                        .findFirst()
                        .orElseThrow()
                        .total())
                .isEqualByComparingTo("1600.00");
    }

    private static ContratoLocacaoEntity contratoLocacao(
            Long id, String valor, int diaVenc, LocalDate inicio, LocalDate fim) {
        PessoaEntity locador = new PessoaEntity();
        locador.setNome("Locador " + id);
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(id);
        imovel.setNumeroPlanilha(100 + id.intValue());
        imovel.setEnderecoCompleto("Rua " + id);
        ContratoLocacaoEntity c = new ContratoLocacaoEntity();
        c.setId(id);
        c.setImovel(imovel);
        c.setLocadorPessoa(locador);
        c.setValorAluguel(new BigDecimal(valor));
        c.setDiaVencimentoAluguel(diaVenc);
        c.setDataInicio(inicio);
        c.setDataFim(fim);
        return c;
    }

    private static PagamentoEntity pagamentoReceber(Long id, String valor, LocalDate venc, String origem) {
        PagamentoEntity p = new PagamentoEntity();
        p.setId(id);
        p.setTipo(PagamentoDominio.TIPO_RECEBER);
        p.setStatus(PagamentoDominio.ST_EMITIDO);
        p.setValor(new BigDecimal(valor));
        p.setDataVencimento(venc);
        p.setDescricao("Honorários parcela 1/3");
        p.setCategoria("CLIENTE");
        p.setOrigem(origem);
        return p;
    }

    private static ContratoHonorariosParcelaEntity parcelaHonorarios(Long id, String valor, LocalDate venc) {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setNome("João Cliente");
        ContratoHonorariosEntity contrato = new ContratoHonorariosEntity();
        contrato.setId(9L);
        contrato.setPessoa(pessoa);
        contrato.setQuantidadeParcelas(3);
        ContratoHonorariosParcelaEntity par = new ContratoHonorariosParcelaEntity();
        par.setId(id);
        par.setContrato(contrato);
        par.setNumeroParcela(2);
        par.setValor(new BigDecimal(valor));
        par.setDataVencimento(venc);
        return par;
    }

    private static IptuParcelaEntity iptuParcela(Long id, String valor, LocalDate venc) {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(10L);
        imovel.setNumeroPlanilha(42);
        imovel.setEnderecoCompleto("Rua Teste, 1");
        var anual = new br.com.vilareal.iptu.infrastructure.persistence.entity.IptuAnualEntity();
        anual.setImovel(imovel);
        IptuParcelaEntity par = new IptuParcelaEntity();
        par.setId(id);
        par.setIptuAnual(anual);
        par.setValorCalculado(new BigDecimal(valor));
        par.setDataVencimento(venc);
        par.setCompetenciaMes("2026-06");
        par.setStatus("PENDENTE");
        return par;
    }
}
