package br.com.vilareal.patrimonio.application;

import br.com.vilareal.patrimonio.api.dto.ComparadorItemResponse;
import br.com.vilareal.patrimonio.api.dto.ConsolidacaoResponse;
import br.com.vilareal.patrimonio.domain.TipoPassivo;
import br.com.vilareal.patrimonio.domain.finance.MoneyMath;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.*;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class PatrimonioConsolidacaoService {

    private final CaixaRepository caixaRepository;
    private final RendaFixaRepository rendaFixaRepository;
    private final AtivoRvRepository ativoRvRepository;
    private final ImovelPatrimonioRepository imovelRepository;
    private final VeiculoRepository veiculoRepository;
    private final PassivoRepository passivoRepository;
    private final OperacaoOpcaoRepository opcaoRepository;
    private final SnapshotRepository snapshotRepository;
    private final ParametroRepository parametroRepository;
    private final AmortizacaoRepository amortizacaoRepository;

    public PatrimonioConsolidacaoService(
            CaixaRepository caixaRepository,
            RendaFixaRepository rendaFixaRepository,
            AtivoRvRepository ativoRvRepository,
            ImovelPatrimonioRepository imovelRepository,
            VeiculoRepository veiculoRepository,
            PassivoRepository passivoRepository,
            OperacaoOpcaoRepository opcaoRepository,
            SnapshotRepository snapshotRepository,
            ParametroRepository parametroRepository,
            AmortizacaoRepository amortizacaoRepository) {
        this.caixaRepository = caixaRepository;
        this.rendaFixaRepository = rendaFixaRepository;
        this.ativoRvRepository = ativoRvRepository;
        this.imovelRepository = imovelRepository;
        this.veiculoRepository = veiculoRepository;
        this.passivoRepository = passivoRepository;
        this.opcaoRepository = opcaoRepository;
        this.snapshotRepository = snapshotRepository;
        this.parametroRepository = parametroRepository;
        this.amortizacaoRepository = amortizacaoRepository;
    }

    @Transactional(readOnly = true)
    public ConsolidacaoResponse consolidar() {
        LocalDate hoje = LocalDate.now();
        ParametroEntity param = parametroRepository.findTopByVigenteAteIsNullOrderByVersaoDesc().orElse(null);

        BigDecimal caixaTotal = BigDecimal.ZERO;
        BigDecimal caixaVinculadoCadastro = BigDecimal.ZERO;
        for (CaixaEntity c : caixaRepository.findByAtivoTrue()) {
            caixaTotal = caixaTotal.add(nz(c.getValor()));
            if (Boolean.TRUE.equals(c.getVinculado())) {
                caixaVinculadoCadastro = caixaVinculadoCadastro.add(nz(c.getValor()));
            }
        }

        BigDecimal margemOpcoes = opcaoRepository.findByStatus("ABERTA").stream()
                .map(o -> nz(o.getMargemExigida()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal caixaVinculado = caixaVinculadoCadastro.max(margemOpcoes);
        BigDecimal caixaLivre = caixaTotal.subtract(caixaVinculado).max(BigDecimal.ZERO);

        BigDecimal rfTotal = BigDecimal.ZERO;
        BigDecimal reservaLiquida = BigDecimal.ZERO;
        BigDecimal melhorRfLiquida = null;
        for (RendaFixaEntity rf : rendaFixaRepository.findByAtivoTrue()) {
            BigDecimal v = rf.valorParaConsolidacao();
            rfTotal = rfTotal.add(nz(v));
            // Piso de reserva: flag + liquidez diária obrigatória
            if (Boolean.TRUE.equals(rf.getReservaEmergencia()) && isLiquidezDiaria(rf.getLiquidez())) {
                reservaLiquida = reservaLiquida.add(nz(v));
            }
            if (rf.getRentabilidadeLiquidaAa() != null
                    && (melhorRfLiquida == null || rf.getRentabilidadeLiquidaAa().compareTo(melhorRfLiquida) > 0)) {
                melhorRfLiquida = rf.getRentabilidadeLiquidaAa();
            }
        }

        BigDecimal rvTotal = ativoRvRepository.findByAtivoTrue().stream()
                .map(AtivoRvEntity::valorMercado)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal imoveisTotal = imovelRepository.findByAtivoTrue().stream()
                .map(i -> nz(i.getValorAtual()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal veiculosTotal = veiculoRepository.findByAtivoTrue().stream()
                .map(v -> nz(v.getValorAtual()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> passivosPorTipo = new LinkedHashMap<>();
        for (TipoPassivo t : TipoPassivo.values()) {
            passivosPorTipo.put(t.name(), BigDecimal.ZERO);
        }
        BigDecimal passivoTotal = BigDecimal.ZERO;
        BigDecimal parcelasMensais = BigDecimal.ZERO;
        List<PassivoEntity> passivos = passivoRepository.findByAtivoTrueOrderByCetEfetivoAaDesc();
        for (PassivoEntity p : passivos) {
            BigDecimal saldo = nz(p.getSaldoDevedor());
            passivoTotal = passivoTotal.add(saldo);
            parcelasMensais = parcelasMensais.add(nz(p.getParcelaAtual()));
            String tipo = p.getTipo() != null ? p.getTipo() : TipoPassivo.OUTROS.name();
            passivosPorTipo.merge(tipo, saldo, BigDecimal::add);
        }

        BigDecimal ativoTotal = caixaTotal.add(rfTotal).add(rvTotal).add(imoveisTotal).add(veiculosTotal);
        BigDecimal pl = ativoTotal.subtract(passivoTotal);
        BigDecimal alavancagem = ativoTotal.compareTo(BigDecimal.ZERO) > 0
                ? passivoTotal.divide(ativoTotal, 6, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<String, BigDecimal> breakdownAtivos = new LinkedHashMap<>();
        breakdownAtivos.put("CAIXA", MoneyMath.money(caixaTotal));
        breakdownAtivos.put("RENDA_FIXA", MoneyMath.money(rfTotal));
        breakdownAtivos.put("RENDA_VARIAVEL", MoneyMath.money(rvTotal));
        breakdownAtivos.put("IMOVEIS", MoneyMath.money(imoveisTotal));
        breakdownAtivos.put("VEICULOS", MoneyMath.money(veiculosTotal));

        BigDecimal despesasFixas = param != null && param.getDespesasFixasMensais() != null
                ? param.getDespesasFixasMensais() : BigDecimal.ZERO;
        BigDecimal mesesPiso = param != null ? param.getPisoReservaMeses() : new BigDecimal("6");
        // Base do piso: despesas fixas + parcelas de financiamento (§6 briefing)
        BigDecimal pisoReserva = MoneyMath.money(
                despesasFixas.add(parcelasMensais).multiply(mesesPiso));

        BigDecimal taxaRef;
        Instant taxaAtualizadaEm = null;
        boolean taxaStale = false;
        int staleDias = 30;
        if (param != null && param.getTaxaReferenciaLiquidaAa() != null) {
            taxaRef = param.getTaxaReferenciaLiquidaAa();
            taxaAtualizadaEm = param.getTaxaReferenciaAtualizadaEm();
            staleDias = param.getTaxaReferenciaStaleDias() != null ? param.getTaxaReferenciaStaleDias() : 30;
            if (taxaAtualizadaEm == null) {
                taxaStale = true;
            } else {
                long dias = ChronoUnit.DAYS.between(taxaAtualizadaEm, Instant.now());
                taxaStale = dias > staleDias;
            }
        } else {
            taxaRef = melhorRfLiquida != null ? melhorRfLiquida : new BigDecimal("10.200000");
            taxaStale = true;
        }

        BigDecimal rendaRecorrente = param != null && param.getRendaMensalRecorrente() != null
                ? param.getRendaMensalRecorrente() : BigDecimal.ZERO;
        BigDecimal comprometimentoMax = param != null && param.getComprometimentoRendaMax() != null
                ? param.getComprometimentoRendaMax() : new BigDecimal("0.3000");
        BigDecimal comprometimento = rendaRecorrente.compareTo(BigDecimal.ZERO) > 0
                ? parcelasMensais.divide(rendaRecorrente, 6, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        boolean comprometimentoAcima = rendaRecorrente.compareTo(BigDecimal.ZERO) > 0
                && comprometimento.compareTo(comprometimentoMax) > 0;

        BigDecimal teto = param != null ? param.getTetoAmortizacaoAnual() : null;
        LocalDate inicioAno = hoje.withDayOfYear(1);
        Instant ini = inicioAno.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant fim = inicioAno.plusYears(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        BigDecimal usadoTeto = MoneyMath.money(amortizacaoRepository.somaEfetivadaNoPeriodo(ini, fim));
        BigDecimal disponivelTeto = teto != null
                ? MoneyMath.money(teto.subtract(usadoTeto))
                : null;
        boolean tetoUltrapassado = teto != null && usadoTeto.compareTo(teto) > 0;

        List<ConsolidacaoResponse.SnapshotPontoResponse> historico = snapshotRepository
                .findByDataRefGreaterThanEqualOrderByDataRefAsc(hoje.minusMonths(24))
                .stream()
                .map(s -> new ConsolidacaoResponse.SnapshotPontoResponse(
                        s.getDataRef(), s.getPatrimonioLiquido(), s.getAlavancagem()))
                .toList();

        List<ComparadorItemResponse> comparador = montarComparador(taxaRef);

        return new ConsolidacaoResponse(
                hoje,
                MoneyMath.money(ativoTotal),
                MoneyMath.money(passivoTotal),
                MoneyMath.money(pl),
                alavancagem,
                breakdownAtivos,
                passivosPorTipo,
                MoneyMath.money(caixaTotal),
                MoneyMath.money(caixaVinculado),
                MoneyMath.money(caixaLivre),
                MoneyMath.money(rfTotal),
                MoneyMath.money(reservaLiquida),
                MoneyMath.money(reservaLiquida),
                pisoReserva,
                taxaRef,
                taxaAtualizadaEm,
                taxaStale,
                staleDias,
                MoneyMath.money(parcelasMensais),
                MoneyMath.money(rendaRecorrente),
                comprometimento,
                comprometimentoMax,
                comprometimentoAcima,
                teto,
                usadoTeto,
                disponivelTeto,
                tetoUltrapassado,
                historico,
                comparador);
    }

    @Transactional
    public ConsolidacaoResponse consolidarEPersistirSnapshot() {
        ConsolidacaoResponse c = consolidar();
        SnapshotEntity snap = snapshotRepository.findByDataRef(c.dataRef()).orElseGet(SnapshotEntity::new);
        snap.setDataRef(c.dataRef());
        snap.setAtivoTotal(c.ativoTotal());
        snap.setPassivoTotal(c.passivoTotal());
        snap.setPatrimonioLiquido(c.patrimonioLiquido());
        snap.setAlavancagem(c.alavancagem());
        snap.setRvTotal(c.breakdownAtivos().getOrDefault("RENDA_VARIAVEL", BigDecimal.ZERO));
        snap.setRfTotal(c.breakdownAtivos().getOrDefault("RENDA_FIXA", BigDecimal.ZERO));
        snap.setImoveisTotal(c.breakdownAtivos().getOrDefault("IMOVEIS", BigDecimal.ZERO));
        snap.setCaixaTotal(c.caixaTotal());
        snap.setCaixaVinculado(c.caixaVinculado());
        snap.setCaixaLivre(c.caixaLivre());
        snap.setVeiculosTotal(c.breakdownAtivos().getOrDefault("VEICULOS", BigDecimal.ZERO));
        snap.setOutrosAtivos(BigDecimal.ZERO);
        snap.setPassivoImobiliario(c.breakdownPassivos().getOrDefault("FINANCIAMENTO_IMOBILIARIO", BigDecimal.ZERO));
        snap.setPassivoVeiculo(c.breakdownPassivos().getOrDefault("FINANCIAMENTO_VEICULO", BigDecimal.ZERO));
        snap.setPassivoConsorcio(c.breakdownPassivos().getOrDefault("CONSORCIO", BigDecimal.ZERO));
        snap.setPassivoCreditoPessoal(c.breakdownPassivos().getOrDefault("CREDITO_PESSOAL", BigDecimal.ZERO));
        snap.setPassivoCartao(c.breakdownPassivos().getOrDefault("CARTAO", BigDecimal.ZERO));
        snap.setPassivoOutros(c.breakdownPassivos().getOrDefault("OUTROS", BigDecimal.ZERO));
        snap.setOrigem("CALCULO");
        snapshotRepository.save(snap);
        return consolidar();
    }

    static boolean isLiquidezDiaria(String liquidez) {
        if (liquidez == null) {
            return false;
        }
        String n = liquidez.trim().toUpperCase(Locale.ROOT);
        return n.equals("DIARIA") || n.equals("DIÁRIO") || n.equals("DIARIO") || n.equals("D+0") || n.equals("D0");
    }

    private List<ComparadorItemResponse> montarComparador(BigDecimal taxaRef) {
        List<ComparadorItemResponse> items = new ArrayList<>();
        for (RendaFixaEntity rf : rendaFixaRepository.findByAtivoTrue()) {
            BigDecimal taxa = rf.getRentabilidadeLiquidaAa() != null ? rf.getRentabilidadeLiquidaAa() : taxaRef;
            items.add(new ComparadorItemResponse(
                    "ATIVO", "RENDA_FIXA", rf.getId(), rf.getInstrumento(),
                    rf.valorParaConsolidacao(), taxa, rf.getLiquidez()));
        }
        for (ImovelPatrimonioEntity im : imovelRepository.findByAtivoTrue()) {
            BigDecimal cap = calcularCapRate(im);
            items.add(new ComparadorItemResponse(
                    "ATIVO", "IMOVEL", im.getId(), im.getIdentificacao(),
                    im.getValorAtual(), cap, im.getSituacao()));
        }
        for (AtivoRvEntity rv : ativoRvRepository.findByAtivoTrue()) {
            items.add(new ComparadorItemResponse(
                    "ATIVO", "RENDA_VARIAVEL", rv.getId(), rv.getTicker(),
                    rv.valorMercado(), null, "cenário — não usar como base conservadora"));
        }
        for (PassivoEntity p : passivoRepository.findByAtivoTrueOrderByCetEfetivoAaDesc()) {
            items.add(new ComparadorItemResponse(
                    "PASSIVO", p.getTipo(), p.getId(),
                    p.getCredor() + (p.getDescricao() != null ? " — " + p.getDescricao() : ""),
                    p.getSaldoDevedor(), p.getCetEfetivoAa(),
                    "custo efetivo (CET)"));
        }
        items.sort(Comparator.comparing(
                (ComparadorItemResponse i) -> i.taxaLiquidaAa() != null ? i.taxaLiquidaAa() : BigDecimal.ZERO)
                .reversed());
        return items;
    }

    static BigDecimal calcularCapRate(ImovelPatrimonioEntity im) {
        BigDecimal valor = nz(im.getValorAtual());
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal receita = nz(im.getAluguelMensal()).multiply(BigDecimal.valueOf(12));
        BigDecimal vacancia = im.getVacanciaEstimada() != null ? im.getVacanciaEstimada() : BigDecimal.ZERO;
        receita = receita.multiply(BigDecimal.ONE.subtract(vacancia), MoneyMath.MC);
        BigDecimal despesas = nz(im.getIptuMensal())
                .add(nz(im.getCondominioMensal()))
                .add(nz(im.getSeguroMensal()))
                .add(nz(im.getManutencaoMensal()))
                .add(nz(im.getAdministracaoMensal()))
                .multiply(BigDecimal.valueOf(12));
        BigDecimal liquido = receita.subtract(despesas);
        return liquido.multiply(MoneyMath.HUNDRED, MoneyMath.MC)
                .divide(valor, 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
