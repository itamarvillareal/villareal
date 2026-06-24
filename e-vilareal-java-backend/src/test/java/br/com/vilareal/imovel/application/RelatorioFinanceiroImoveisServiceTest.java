package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.api.dto.ImovelVinculoProcessoItemResponse;
import br.com.vilareal.imovel.api.dto.ImovelVinculosProcessoResponse;
import br.com.vilareal.imovel.api.dto.RelatorioFinanceiroImoveisResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse;
import br.com.vilareal.imovel.domain.StatusRepasse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RelatorioFinanceiroImoveisServiceTest {

    @Mock private ImovelRepository imovelRepository;
    @Mock private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock private ImovelApplicationService imovelApplicationService;
    @Mock private LocacaoReconciliacaoService reconciliacaoService;

    private RelatorioFinanceiroImoveisService service;

    @BeforeEach
    void setUp() {
        service = new RelatorioFinanceiroImoveisService(
                imovelRepository,
                contratoLocacaoRepository,
                imovelApplicationService,
                reconciliacaoService,
                new ObjectMapper());
    }

    @Test
    void gerar_agregaTotaisPorContratoSemExtrato() {
        ImovelEntity im = new ImovelEntity();
        im.setId(11L);
        im.setNumeroPlanilha(14);
        im.setSituacao("OCUPADO");
        im.setUnidade("Unidade 1205 B");
        im.setCamposExtrasJson("{\"inquilino\":\"Maria\",\"proprietario\":\"João\"}");

        ContratoLocacaoEntity contrato = new ContratoLocacaoEntity();
        contrato.setId(99L);
        contrato.setStatus("VIGENTE");
        contrato.setValorAluguel(new BigDecimal("2300.00"));
        contrato.setTaxaAdministracaoPercent(new BigDecimal("10.00"));
        contrato.setDiaVencimentoAluguel(10);
        contrato.setDiaRepasse(15);

        ImovelVinculoProcessoItemResponse principal = new ImovelVinculoProcessoItemResponse();
        principal.setCodigoCliente("00000938");
        principal.setNumeroInterno(41);
        principal.setPrincipal(true);

        ImovelVinculosProcessoResponse vinculos = new ImovelVinculosProcessoResponse();
        vinculos.setVinculos(List.of(principal));

        when(imovelRepository.findAllByOrderByIdAsc()).thenReturn(List.of(im));
        when(contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(11L)).thenReturn(List.of(contrato));
        when(imovelApplicationService.listarVinculosProcessoPorNumeroPlanilha(14)).thenReturn(vinculos);
        when(reconciliacaoService.resultado(eq(99L), eq("2026-06"), isNull(), isNull()))
                .thenReturn(resultado(new BigDecimal("2300.00"), new BigDecimal("2070.00")));
        when(reconciliacaoService.resultado(eq(99L), eq("2026-05"), isNull(), isNull()))
                .thenReturn(resultado(BigDecimal.ZERO, new BigDecimal("1890.00")));

        RelatorioFinanceiroImoveisResponse out = service.gerar("2026-06", true);

        assertThat(out.competencia()).isEqualTo("2026-06");
        assertThat(out.linhas()).hasSize(1);
        assertThat(out.linhas().get(0).numeroPlanilha()).isEqualTo(14);
        assertThat(out.linhas().get(0).codigoCliente()).isEqualTo("00000938");
        assertThat(out.linhas().get(0).numeroInterno()).isEqualTo(41);
        assertThat(out.linhas().get(0).totalAluguel()).isEqualByComparingTo("2300.00");
        assertThat(out.linhas().get(0).totalRepasse()).isEqualByComparingTo("2070.00");
        assertThat(out.linhas().get(0).totalRepasseAnterior()).isEqualByComparingTo("1890.00");
    }

    private static ReconciliacaoResultadoResponse resultado(BigDecimal aluguel, BigDecimal repasse) {
        return new ReconciliacaoResultadoResponse(
                99L,
                "2026-06",
                aluguel,
                repasse,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.TEN,
                StatusRepasse.FEITO,
                false,
                "Locador",
                null,
                List.of());
    }
}
