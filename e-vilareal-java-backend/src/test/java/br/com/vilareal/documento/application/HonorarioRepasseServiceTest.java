package br.com.vilareal.documento.application;

import br.com.vilareal.documento.ContratoHonorariosClausula3TextoBuilder;
import br.com.vilareal.documento.api.dto.CandidatoAlvaraProcessoResponse;
import br.com.vilareal.documento.api.dto.RepassePendenteHonorarioCarteiraResponse;
import br.com.vilareal.documento.api.dto.RepassePendenteHonorarioItemResponse;
import br.com.vilareal.documento.domain.PapelHonorarioRepasse;
import br.com.vilareal.documento.domain.StatusRepasseHonorario;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.HonorarioRepasseLancamentoEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.documento.infrastructure.persistence.repository.HonorarioRepasseLancamentoRepository;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HonorarioRepasseServiceTest {

    private static final Long PROCESSO_ID = 500L;
    private static final Long CONTRATO_ID = 9L;
    private static final Long ALVARA_LANC_ID = 100L;

    @Mock
    private HonorarioRepasseLancamentoRepository vinculoRepository;
    @Mock
    private ContratoHonorariosRepository contratoRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ProcessoParteRepository processoParteRepository;
    @Mock
    private PagamentoRepository pagamentoRepository;
    @Mock
    private LocacaoRepasseLancamentoRepository locacaoVinculoRepository;

    @InjectMocks
    private HonorarioRepasseService service;

    @Test
    void repasseEsperadoERetencaoCalculamPercentualDoContrato() {
        BigDecimal valor = new BigDecimal("10000.00");
        BigDecimal pct = new BigDecimal("35.00");
        assertThat(service.repasseEsperado(valor, pct)).isEqualByComparingTo("6500.00");
        assertThat(service.retencao(valor, service.repasseEsperado(valor, pct))).isEqualByComparingTo("3500.00");
    }

    @Test
    void classificarAlvaraApareceEmRepassesPendentesComValoresCorretos() {
        ProcessoEntity processo = processo();
        ContratoHonorariosEntity contrato = contratoPercentual(processo, new BigDecimal("35.00"));
        LancamentoFinanceiroEntity credito = lancamento(
                ALVARA_LANC_ID, NaturezaLancamento.CREDITO, "10000.00", LocalDate.of(2026, 6, 12), processo);

        when(lancamentoRepository.findById(ALVARA_LANC_ID)).thenReturn(Optional.of(credito));
        when(contratoRepository.findByProcessoIdWithDetalhes(PROCESSO_ID)).thenReturn(Optional.of(contrato));
        when(vinculoRepository.findByContratoHonorarios_IdAndLancamentoFinanceiro_IdAndPapel(
                        CONTRATO_ID, ALVARA_LANC_ID, PapelHonorarioRepasse.ALVARA))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(PROCESSO_ID)).thenReturn(List.of());

        AtomicLong seq = new AtomicLong(1);
        when(vinculoRepository.save(any(HonorarioRepasseLancamentoEntity.class)))
                .thenAnswer(inv -> {
                    HonorarioRepasseLancamentoEntity v = inv.getArgument(0);
                    v.setId(seq.getAndIncrement());
                    return v;
                });

        service.classificarAlvara(ALVARA_LANC_ID);

        HonorarioRepasseLancamentoEntity alvaraSalvo = new HonorarioRepasseLancamentoEntity();
        alvaraSalvo.setId(1L);
        alvaraSalvo.setContratoHonorarios(contrato);
        alvaraSalvo.setLancamentoFinanceiro(credito);
        alvaraSalvo.setPapel(PapelHonorarioRepasse.ALVARA);
        alvaraSalvo.setDataReferencia(credito.getDataLancamento());
        alvaraSalvo.setValor(new BigDecimal("10000.00"));

        when(vinculoRepository.findAllAlvarasParaCarteira()).thenReturn(List.of(alvaraSalvo));
        when(vinculoRepository.findByAlvaraVinculo_IdOrderByIdAsc(1L)).thenReturn(List.of());

        RepassePendenteHonorarioCarteiraResponse carteira = service.repassesPendentesHonorario();

        assertThat(carteira.itens()).hasSize(1);
        RepassePendenteHonorarioItemResponse item = carteira.itens().get(0);
        assertThat(item.valorAlvara()).isEqualByComparingTo("10000.00");
        assertThat(item.percentualProveito()).isEqualByComparingTo("35.00");
        assertThat(item.repasseEsperado()).isEqualByComparingTo("6500.00");
        assertThat(item.retencao()).isEqualByComparingTo("3500.00");
        assertThat(item.valorEmAberto()).isEqualByComparingTo("6500.00");
        assertThat(item.statusRepasse()).isEqualTo(StatusRepasseHonorario.PENDENTE);
        assertThat(carteira.totalEmAberto()).isEqualByComparingTo("6500.00");
    }

    @Test
    void candidatosAlvaraListaCreditoDepositoJudicialComSplitProjetado() {
        ProcessoEntity processo = processo();
        ContratoHonorariosEntity contrato = contratoPercentual(processo, new BigDecimal("35.00"));
        LancamentoFinanceiroEntity credito = lancamento(
                ALVARA_LANC_ID, NaturezaLancamento.CREDITO, "10000.00", LocalDate.of(2026, 6, 12), processo);
        LancamentoFinanceiroEntity parcela = lancamento(
                101L, NaturezaLancamento.CREDITO, "500.00", LocalDate.of(2026, 6, 1), processo);
        parcela.setDescricao("Honorarios parcela 1");

        when(contratoRepository.findAllPercentualProveitoComProcesso()).thenReturn(List.of(contrato));
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(PROCESSO_ID)).thenReturn(List.of());
        when(lancamentoRepository.findCreditosPorProcesso(PROCESSO_ID)).thenReturn(List.of(credito, parcela));
        when(vinculoRepository.existsByLancamentoFinanceiro_IdAndPapel(eq(ALVARA_LANC_ID), eq(PapelHonorarioRepasse.ALVARA)))
                .thenReturn(false);
        when(pagamentoRepository.existsByFinanceiroLancamento_Id(any())).thenReturn(false);
        when(locacaoVinculoRepository.existsByLancamentoFinanceiro_IdAndPapel(any(), eq(PapelReconciliacao.ALUGUEL)))
                .thenReturn(false);

        List<CandidatoAlvaraProcessoResponse> grupos = service.candidatosAlvara();

        assertThat(grupos).hasSize(1);
        assertThat(grupos.get(0).candidatos()).hasSize(1);
        assertThat(grupos.get(0).candidatos().get(0).lancamentoId()).isEqualTo(ALVARA_LANC_ID);
        assertThat(grupos.get(0).candidatos().get(0).repasseEsperado()).isEqualByComparingTo("6500.00");
        assertThat(grupos.get(0).candidatos().get(0).retencao()).isEqualByComparingTo("3500.00");
    }

    @Test
    void statusRepasseFeitoQuandoRepasseBateEsperado() {
        BigDecimal valor = new BigDecimal("10000.00");
        BigDecimal pct = new BigDecimal("35.00");
        assertThat(service.statusRepasse(valor, new BigDecimal("6500.00"), pct))
                .isEqualTo(StatusRepasseHonorario.FEITO);
        assertThat(service.statusRepasse(valor, BigDecimal.ZERO, pct)).isEqualTo(StatusRepasseHonorario.PENDENTE);
    }

    private static ProcessoEntity processo() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setCodigoCliente("00000966");
        ProcessoEntity p = new ProcessoEntity();
        p.setId(PROCESSO_ID);
        p.setNumeroInterno(12);
        p.setCliente(cliente);
        return p;
    }

    private static ContratoHonorariosEntity contratoPercentual(ProcessoEntity processo, BigDecimal pct) {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(1L);
        pessoa.setNome("Cliente Contratante");
        ContratoHonorariosEntity c = new ContratoHonorariosEntity();
        c.setId(CONTRATO_ID);
        c.setProcesso(processo);
        c.setPessoa(pessoa);
        c.setTipoRemuneracao(ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO);
        c.setPercentualProveito(pct);
        return c;
    }

    private static LancamentoFinanceiroEntity lancamento(
            Long id, NaturezaLancamento natureza, String valor, LocalDate data, ProcessoEntity processo) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(id);
        l.setNatureza(natureza);
        l.setValor(new BigDecimal(valor));
        l.setDataLancamento(data);
        l.setProcesso(processo);
        l.setStatus(StatusLancamento.ATIVO);
        l.setDescricao("Credito Deposito Judicial");
        return l;
    }
}
