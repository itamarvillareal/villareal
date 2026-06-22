package br.com.vilareal.imovel.application;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DespesaCondominioCandidatoServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ImovelRepository imovelRepository;
    @Mock
    private LocacaoRepasseLancamentoRepository vinculoRepository;

    @InjectMocks
    private DespesaCondominioCandidatoService service;

    @Test
    void agrupaPorImovelUnicoComGrafiasMescladas() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(71L);
        imovel.setAtivo(true);
        imovel.setNumeroPlanilha(41);
        imovel.setCondominio("Executive Privé");
        imovel.setUnidade("101");

        when(lancamentoRepository.findDebitosCondominioContasAdministracao())
                .thenReturn(List.of(
                        debito("Condominio Do Edif Residencial Executive Prive", "2026-02-10", "883.13", 1L),
                        debito("Condominio Do Edif Residencial Executive Prive", "2026-03-10", "883.13", 2L),
                        debito("BOLETO  PAGO CONDOMINIO D", "2025-11-10", "883.13", 3L),
                        debito("BOLETO  PAGO CONDOMINIO D", "2025-10-10", "883.13", 4L),
                        debito("PAG BOLETO CONDOMINIO DO EDIF RESIDENCI", "2025-09-10", "883.13", 5L),
                        debito("PAG BOLETO CONDOMINIO DO EDIF RESIDENCI", "2025-08-10", "883.13", 6L)));
        when(imovelRepository.findAllByOrderByIdAsc()).thenReturn(List.of(imovel));
        when(vinculoRepository.findHistoricoDespesa()).thenReturn(List.of());

        var resp = service.candidatosDespesaCondominio();

        assertThat(resp.gruposImovelUnico()).isEqualTo(1);
        var g = resp.grupos().get(0);
        assertThat(g.obrigacaoChave()).isEqualTo("imovel:71");
        assertThat(g.confianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(g.grafias()).hasSizeGreaterThanOrEqualTo(2);
        assertThat(g.grafiasMesmaObrigacao()).isTrue();
        assertThat(g.valorEstimado()).isEqualByComparingTo("883.13");
    }

    @Test
    void condominioCompartilhadoListaUnidades() {
        ImovelEntity a = imovel(1L, 10, "Veredas do Bosque", "101");
        ImovelEntity b = imovel(2L, 11, "Veredas do Bosque", "202");

        when(lancamentoRepository.findDebitosCondominioContasAdministracao())
                .thenReturn(List.of(
                        debito("Condominio Residencial Veredas Do Bosque", "2026-02-08", "371.83", 10L),
                        debito("Condominio Residencial Veredas Do Bosque", "2026-03-08", "371.83", 11L)));
        when(imovelRepository.findAllByOrderByIdAsc()).thenReturn(List.of(a, b));
        when(vinculoRepository.findHistoricoDespesa()).thenReturn(List.of());

        var resp = service.candidatosDespesaCondominio();

        assertThat(resp.gruposCondominioCompartilhado()).isEqualTo(1);
        assertThat(resp.grupos().get(0).confianca()).isEqualTo(ConfiancaSugestao.MEDIA);
        assertThat(resp.grupos().get(0).unidadesCandidatas()).hasSize(2);
        assertThat(resp.grupos().get(0).imovelSugeridoId()).isNull();
    }

    private static ImovelEntity imovel(Long id, int planilha, String condominio, String unidade) {
        ImovelEntity i = new ImovelEntity();
        i.setId(id);
        i.setAtivo(true);
        i.setNumeroPlanilha(planilha);
        i.setCondominio(condominio);
        i.setUnidade(unidade);
        return i;
    }

    private static LancamentoFinanceiroEntity debito(String descricao, String data, String valor, long id) {
        ContaContabilEntity conta = new ContaContabilEntity();
        conta.setCodigo("A");
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(id);
        l.setContaContabil(conta);
        l.setNatureza(NaturezaLancamento.DEBITO);
        l.setDescricao(descricao);
        l.setDataLancamento(LocalDate.parse(data));
        l.setValor(new BigDecimal(valor));
        return l;
    }
}
