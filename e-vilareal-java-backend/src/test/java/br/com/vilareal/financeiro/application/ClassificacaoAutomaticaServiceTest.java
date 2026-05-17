package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.AutoClassificarRequest;
import br.com.vilareal.financeiro.api.dto.AutoClassificarResponse;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClassificacaoAutomaticaServiceTest {

    @Mock
    private RegraClassificacaoRepository regraRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;

    @InjectMocks
    private ClassificacaoAutomaticaService service;

    private ContaContabilEntity contaN;
    private ContaContabilEntity contaF;
    private RegraClassificacaoEntity regraRendimento;

    @BeforeEach
    void setUp() {
        contaN = new ContaContabilEntity();
        contaN.setId(5L);
        contaN.setCodigo("N");

        contaF = new ContaContabilEntity();
        contaF.setId(7L);
        contaF.setCodigo("F");

        regraRendimento = new RegraClassificacaoEntity();
        regraRendimento.setId(100L);
        regraRendimento.setPadraoDescricao("%rendimento%");
        regraRendimento.setTipoMatch(TipoMatch.CONTAINS);
        regraRendimento.setContaContabil(contaF);
        regraRendimento.setLetraDestino("F");
        regraRendimento.setConfianca(new BigDecimal("0.99"));
        regraRendimento.setAtivo(true);
        regraRendimento.setPrioridade(5);
    }

    @Test
    void matchLike_padraoComPercentuais() {
        assertThat(ClassificacaoAutomaticaService.matchLike("%rendimento%", "CRED RENDIMENTO POUPANCA"))
                .isTrue();
        assertThat(ClassificacaoAutomaticaService.matchLike("%juros%", "TARIFA MENSAL"))
                .isFalse();
    }

    @Test
    void autoClassificar_dryRun_reclassificaPorRegra() {
        LancamentoFinanceiroEntity l = lancamentoN("RENDIMENTO AUTOMATICO");

        when(contaContabilRepository.findFirstByCodigoIgnoreCase("N")).thenReturn(Optional.of(contaN));
        when(lancamentoRepository.findAll(any(Specification.class))).thenReturn(List.of(l));
        when(regraRepository.findByAtivoTrueOrderByConfiancaDescPrioridadeAscIdAsc())
                .thenReturn(List.of(regraRendimento));

        AutoClassificarRequest req = new AutoClassificarRequest();
        req.setConfiancaMinima(new BigDecimal("0.85"));
        req.setDryRun(true);

        AutoClassificarResponse res = service.autoClassificar(req);

        assertThat(res.getTotalReclassificados()).isEqualTo(1);
        assertThat(res.getRegrasAplicadas()).hasSize(1);
        assertThat(res.getRegrasAplicadas().get(0).getLetraDestino()).isEqualTo("F");
        verify(lancamentoRepository, never()).save(any());
    }

    @Test
    void autoClassificar_aplicaContaQuandoNaoDryRun() {
        LancamentoFinanceiroEntity l = lancamentoN("RENDIMENTO AUTOMATICO");

        when(contaContabilRepository.findFirstByCodigoIgnoreCase("N")).thenReturn(Optional.of(contaN));
        when(lancamentoRepository.findAll(any(Specification.class))).thenReturn(List.of(l));
        when(regraRepository.findByAtivoTrueOrderByConfiancaDescPrioridadeAscIdAsc())
                .thenReturn(List.of(regraRendimento));
        when(lancamentoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AutoClassificarRequest req = new AutoClassificarRequest();
        req.setConfiancaMinima(new BigDecimal("0.85"));
        req.setDryRun(false);

        service.autoClassificar(req);

        ArgumentCaptor<LancamentoFinanceiroEntity> cap = ArgumentCaptor.forClass(LancamentoFinanceiroEntity.class);
        verify(lancamentoRepository).save(cap.capture());
        assertThat(cap.getValue().getContaContabil().getCodigo()).isEqualTo("F");
        assertThat(cap.getValue().getEtapa()).isEqualTo(EtapaLancamento.CLASSIFICADO);
    }

    private static LancamentoFinanceiroEntity lancamentoN(String descricao) {
        ContaContabilEntity n = new ContaContabilEntity();
        n.setId(5L);
        n.setCodigo("N");
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(1L);
        l.setContaContabil(n);
        l.setDescricao(descricao);
        l.setValor(new BigDecimal("10"));
        l.setNatureza(NaturezaLancamento.CREDITO);
        l.setDataLancamento(LocalDate.of(2026, 1, 10));
        l.setEtapa(EtapaLancamento.IMPORTADO);
        return l;
    }
}
