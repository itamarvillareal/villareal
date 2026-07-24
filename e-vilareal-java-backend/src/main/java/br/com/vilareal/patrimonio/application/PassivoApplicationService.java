package br.com.vilareal.patrimonio.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.patrimonio.api.dto.PassivoRequest;
import br.com.vilareal.patrimonio.api.dto.PassivoResponse;
import br.com.vilareal.patrimonio.domain.finance.CronogramaAmortizacaoCalculator;
import br.com.vilareal.patrimonio.domain.finance.MoneyMath;
import br.com.vilareal.patrimonio.domain.finance.ParcelaCronograma;
import br.com.vilareal.patrimonio.domain.finance.SistemaAmortizacao;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.PassivoEntity;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.PassivoParcelaEntity;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.PassivoParcelaRepository;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.PassivoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class PassivoApplicationService {

    private final PassivoRepository passivoRepository;
    private final PassivoParcelaRepository parcelaRepository;

    public PassivoApplicationService(PassivoRepository passivoRepository, PassivoParcelaRepository parcelaRepository) {
        this.passivoRepository = passivoRepository;
        this.parcelaRepository = parcelaRepository;
    }

    @Transactional(readOnly = true)
    public List<PassivoResponse> listar() {
        return passivoRepository.findByAtivoTrueOrderByCetEfetivoAaDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PassivoResponse obter(Long id) {
        return toResponse(buscar(id));
    }

    @Transactional
    public PassivoResponse criar(PassivoRequest req) {
        PassivoEntity e = new PassivoEntity();
        aplicar(e, req);
        e = passivoRepository.save(e);
        if (!"CONSORCIO".equalsIgnoreCase(e.getSistemaAmortizacao())
                && !Boolean.FALSE.equals(req.regenerarCronograma())) {
            regenerarCronograma(e);
        }
        return toResponse(e);
    }

    @Transactional
    public PassivoResponse atualizar(Long id, PassivoRequest req) {
        PassivoEntity e = buscar(id);
        aplicar(e, req);
        e = passivoRepository.save(e);
        if (Boolean.TRUE.equals(req.regenerarCronograma())
                && !"CONSORCIO".equalsIgnoreCase(e.getSistemaAmortizacao())) {
            regenerarCronograma(e);
        }
        return toResponse(e);
    }

    @Transactional
    public void desativar(Long id) {
        PassivoEntity e = buscar(id);
        e.setAtivo(false);
        passivoRepository.save(e);
    }

    @Transactional
    public void regenerarCronograma(Long id) {
        regenerarCronograma(buscar(id));
    }

    private void regenerarCronograma(PassivoEntity e) {
        SistemaAmortizacao sistema = SistemaAmortizacao.valueOf(e.getSistemaAmortizacao());
        if (sistema == SistemaAmortizacao.CONSORCIO) {
            return;
        }
        parcelaRepository.deleteByPassivoId(e.getId());
        BigDecimal taxa = e.getTaxaJurosNominalAa() != null ? e.getTaxaJurosNominalAa() : e.getCetEfetivoAa();
        BigDecimal seguros = nz(e.getSeguroMipMensal())
                .add(nz(e.getSeguroDfiMensal()))
                .add(nz(e.getTaxaAdministracaoMensal()));
        LocalDate primeiro = LocalDate.now().withDayOfMonth(
                Math.min(e.getDiaVencimento() != null ? e.getDiaVencimento() : 10, 28));
        if (!primeiro.isAfter(LocalDate.now())) {
            primeiro = primeiro.plusMonths(1);
        }
        List<ParcelaCronograma> cronograma = CronogramaAmortizacaoCalculator.gerar(
                sistema,
                e.getSaldoDevedor(),
                MoneyMath.percentToDecimal(taxa),
                e.getPrazoRemanescenteMeses(),
                primeiro,
                seguros);
        for (ParcelaCronograma p : cronograma) {
            PassivoParcelaEntity pe = new PassivoParcelaEntity();
            pe.setPassivoId(e.getId());
            pe.setNumero(p.numero());
            pe.setDataVencimento(p.vencimento());
            pe.setValorParcela(p.valorParcela());
            pe.setAmortizacao(p.amortizacao());
            pe.setJuros(p.juros());
            pe.setSegurosTaxas(p.segurosTaxas());
            pe.setSaldoApos(p.saldoApos());
            pe.setStatus("PENDENTE");
            parcelaRepository.save(pe);
        }
    }

    private PassivoEntity buscar(Long id) {
        return passivoRepository.findById(id)
                .filter(p -> Boolean.TRUE.equals(p.getAtivo()))
                .orElseThrow(() -> new ResourceNotFoundException("Passivo não encontrado: " + id));
    }

    private void aplicar(PassivoEntity e, PassivoRequest req) {
        e.setTipo(req.tipo());
        e.setCredor(req.credor());
        e.setDescricao(req.descricao());
        e.setValorOriginal(req.valorOriginal());
        e.setSaldoDevedor(req.saldoDevedor());
        e.setSistemaAmortizacao(req.sistemaAmortizacao());
        e.setTaxaJurosNominalAa(req.taxaJurosNominalAa());
        e.setCetEfetivoAa(req.cetEfetivoAa());
        e.setIndexador(req.indexador());
        e.setParcelaAtual(req.parcelaAtual());
        e.setPrazoRemanescenteMeses(req.prazoRemanescenteMeses());
        e.setDiaVencimento(req.diaVencimento());
        e.setSeguroMipMensal(nz(req.seguroMipMensal()));
        e.setSeguroDfiMensal(nz(req.seguroDfiMensal()));
        e.setTaxaAdministracaoMensal(nz(req.taxaAdministracaoMensal()));
        e.setTaxaAdministracaoTotal(req.taxaAdministracaoTotal());
        e.setFundoReserva(req.fundoReserva());
        e.setConsorcioContemplado(req.consorcioContemplado());
        e.setCreditoConsorcio(req.creditoConsorcio());
        e.setPermiteReduzirPrazo(req.permiteReduzirPrazo() == null || req.permiteReduzirPrazo());
        e.setPermiteReduzirParcela(req.permiteReduzirParcela() == null || req.permiteReduzirParcela());
        e.setCarenciaAmortizacaoDias(req.carenciaAmortizacaoDias());
        e.setMultaAmortizacao(req.multaAmortizacao());
        e.setDescontoJurosFuturos(req.descontoJurosFuturos() == null || req.descontoJurosFuturos());
        e.setBemVinculadoTipo(req.bemVinculadoTipo());
        e.setBemVinculadoId(req.bemVinculadoId());
        e.setDataInicio(req.dataInicio());
        e.setDataFimPrevista(req.dataFimPrevista());
        e.setObservacao(req.observacao());
        e.setAtivo(true);
    }

    private PassivoResponse toResponse(PassivoEntity e) {
        return new PassivoResponse(
                e.getId(), e.getTipo(), e.getCredor(), e.getDescricao(),
                e.getValorOriginal(), e.getSaldoDevedor(), e.getSistemaAmortizacao(),
                e.getTaxaJurosNominalAa(), e.getCetEfetivoAa(), e.getIndexador(),
                e.getParcelaAtual(), e.getPrazoRemanescenteMeses(), e.getDiaVencimento(),
                e.getSeguroMipMensal(), e.getSeguroDfiMensal(), e.getTaxaAdministracaoMensal(),
                e.getConsorcioContemplado(), e.getPermiteReduzirPrazo(), e.getPermiteReduzirParcela(),
                e.getBemVinculadoTipo(), e.getBemVinculadoId(), e.getDataInicio(), e.getDataFimPrevista(),
                e.getAtivo(), e.getObservacao(), e.getCreatedAt(), e.getUpdatedAt());
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
