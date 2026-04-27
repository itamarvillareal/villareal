package br.com.vilareal.iptu.application;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.imovel.api.dto.ContratoLocacaoWriteRequest;
import br.com.vilareal.imovel.api.dto.ImovelWriteRequest;
import br.com.vilareal.imovel.application.ImovelApplicationService;
import br.com.vilareal.iptu.api.dto.IptuAnualWriteRequest;
import br.com.vilareal.iptu.api.dto.IptuParcelaMarcarPagaRequest;
import br.com.vilareal.iptu.infrastructure.persistence.repository.IptuParcelaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.concurrent.ThreadLocalRandom;

import static org.assertj.core.api.Assertions.assertThat;

class IptuApplicationServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ImovelApplicationService imovelApplicationService;

    @Autowired
    private IptuApplicationService iptuApplicationService;

    @Autowired
    private IptuParcelaRepository iptuParcelaRepository;

    @Test
    void upsert_geraParcelas_marcarPaga_recalculoContrato_preservaPaga() {
        int planilha = 800_000 + ThreadLocalRandom.current().nextInt(1, 99_999);
        var imReq = new ImovelWriteRequest();
        imReq.setNumeroPlanilha(planilha);
        imReq.setTitulo("IPTU test " + planilha);
        long imovelId = imovelApplicationService.criarImovel(imReq).getId();

        var ct = new ContratoLocacaoWriteRequest();
        ct.setImovelId(imovelId);
        ct.setDataInicio(LocalDate.of(2025, 7, 15));
        ct.setDataFim(null);
        ct.setValorAluguel(new BigDecimal("1500.00"));
        long contratoId = imovelApplicationService.criarContrato(ct).getId();

        var iptuReq = new IptuAnualWriteRequest();
        iptuReq.setImovelId(imovelId);
        iptuReq.setAnoReferencia(2025);
        iptuReq.setValorTotalAnual(new BigDecimal("1200.00"));
        long anualId = iptuApplicationService.upsertValorAnual(iptuReq).getId();

        var page0 = iptuApplicationService.listarParcelas(
                imovelId, (short) 2025, null, null, null, null, PageRequest.of(0, 50));
        assertThat(page0.getContent()).hasSize(6);

        long parcelaJulhoId = page0.getContent().stream()
                .filter(p -> "2025-07".equals(p.getCompetenciaMes()))
                .findFirst()
                .orElseThrow()
                .getId();

        var pagaReq = new IptuParcelaMarcarPagaRequest();
        pagaReq.setDataPagamento(LocalDate.of(2025, 7, 20));
        iptuApplicationService.marcarPaga(parcelaJulhoId, pagaReq);

        ct.setDataFim(LocalDate.of(2025, 9, 30));
        imovelApplicationService.atualizarContrato(contratoId, ct);

        var page1 = iptuApplicationService.listarParcelas(
                imovelId, (short) 2025, null, null, null, null, PageRequest.of(0, 50));
        long pagas = page1.getContent().stream().filter(p -> "PAGO".equals(p.getStatus())).count();
        assertThat(pagas).isEqualTo(1);
        assertThat(page1.getContent().stream().filter(p -> "PENDENTE".equals(p.getStatus())))
                .hasSize(2);
        assertThat(iptuParcelaRepository.findAll()).filteredOn(p -> p.getIptuAnual().getId().equals(anualId))
                .noneMatch(p -> "2025-10".equals(p.getCompetenciaMes()));
    }
}
