package br.com.vilareal.descontocheque.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.descontocheque.api.dto.DescontoChequeRequest;
import br.com.vilareal.descontocheque.api.dto.DescontoChequeResponse;
import br.com.vilareal.descontocheque.api.dto.ParcelaDiariaDto;
import br.com.vilareal.descontocheque.infrastructure.persistence.entity.DescontoChequeEntity;
import br.com.vilareal.descontocheque.infrastructure.persistence.repository.DescontoChequeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Regras de cálculo do desconto de cheque (fonte de verdade).
 * Reaproveitado por «simular» (preview, sem persistir) e «salvar/atualizar».
 *
 * <p>Critério: <b>desconto comercial simples</b> sobre o valor de face
 * (desconto = face × taxaMensal × dias/30). É o critério que produz o maior
 * desconto entre as alternativas usuais (composto/valor presente dão menos).</p>
 *
 * <p>Dinheiro em {@link BigDecimal} escala 2, HALF_UP.</p>
 */
@Service
public class DescontoChequeApplicationService {

    /** Base de dias por mês usada na taxa diária proporcional. */
    private static final int BASE_DIAS_MES = 30;

    private final DescontoChequeRepository repository;

    public DescontoChequeApplicationService(DescontoChequeRepository repository) {
        this.repository = repository;
    }

    // ---------------------------------------------------------------------
    // Leitura
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DescontoChequeResponse> listar() {
        return repository.findAllByOrderByIdDesc().stream()
                .map(this::toResponseResumo)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DescontoChequeResponse obter(Long id) {
        DescontoChequeEntity e = buscar(id);
        // Recalcula a tabela diária a partir dos dados persistidos.
        DescontoChequeRequest req = paraRequest(e);
        Calculo calc = calcular(req);
        DescontoChequeResponse r = toResponseResumo(e);
        r.setParcelasDiarias(calc.parcelas);
        return r;
    }

    // ---------------------------------------------------------------------
    // Simular (não persiste) — preview do front
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public DescontoChequeResponse simular(DescontoChequeRequest req) {
        Calculo calc = calcular(req);
        DescontoChequeResponse r = new DescontoChequeResponse();
        r.setId(null);
        r.setDescricao(trimToNull(req.getDescricao()));
        r.setValorFace(calc.valorFace);
        r.setDataBase(calc.dataBase);
        r.setDataDeposito(calc.dataDeposito);
        r.setTaxaMensalPercentual(calc.taxaMensalPercentual);
        r.setDias(calc.dias);
        r.setTaxaDiaria(calc.taxaDiaria);
        r.setValorLiquido(calc.valorLiquido);
        r.setValorDesconto(calc.valorDesconto);
        r.setParcelasDiarias(calc.parcelas);
        return r;
    }

    // ---------------------------------------------------------------------
    // Escrita
    // ---------------------------------------------------------------------

    @Transactional
    public DescontoChequeResponse criar(DescontoChequeRequest req) {
        Calculo calc = calcular(req);
        DescontoChequeEntity e = new DescontoChequeEntity();
        aplicar(e, req, calc);
        e = repository.save(e);
        DescontoChequeResponse r = toResponseResumo(e);
        r.setParcelasDiarias(calc.parcelas);
        return r;
    }

    @Transactional
    public DescontoChequeResponse atualizar(Long id, DescontoChequeRequest req) {
        DescontoChequeEntity e = buscar(id);
        Calculo calc = calcular(req);
        aplicar(e, req, calc);
        e = repository.save(e);
        DescontoChequeResponse r = toResponseResumo(e);
        r.setParcelasDiarias(calc.parcelas);
        return r;
    }

    @Transactional
    public void excluir(Long id) {
        if (id == null || id < 1) {
            throw new BusinessRuleException("Identificador inválido.");
        }
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("Desconto de cheque não encontrado: " + id);
        }
        repository.deleteById(id);
    }

    // ---------------------------------------------------------------------
    // Núcleo do cálculo
    // ---------------------------------------------------------------------

    /**
     * Calcula resumo + tabela diária a partir dos inputs.
     * dataBase default = hoje. Valida dias &gt;= 1 e dataDeposito &gt; dataBase.
     */
    public Calculo calcular(DescontoChequeRequest req) {
        if (req == null) {
            throw new BusinessRuleException("Dados do desconto são obrigatórios.");
        }
        BigDecimal valorFace = req.getValorFace();
        if (valorFace == null || valorFace.signum() <= 0) {
            throw new BusinessRuleException("O valor de face deve ser maior que zero.");
        }
        valorFace = valorFace.setScale(2, RoundingMode.HALF_UP);

        BigDecimal taxaMensalPercentual = req.getTaxaMensalPercentual();
        if (taxaMensalPercentual == null || taxaMensalPercentual.signum() < 0) {
            throw new BusinessRuleException("A taxa mensal não pode ser negativa.");
        }

        LocalDate dataBase = req.getDataBase() != null ? req.getDataBase() : LocalDate.now();
        LocalDate dataDeposito = req.getDataDeposito();
        if (dataDeposito == null) {
            throw new BusinessRuleException("dataDeposito é obrigatória.");
        }
        if (!dataDeposito.isAfter(dataBase)) {
            throw new BusinessRuleException("A data de depósito/vencimento deve ser posterior à data base.");
        }
        long diasLong = ChronoUnit.DAYS.between(dataBase, dataDeposito);
        if (diasLong < 1) {
            throw new BusinessRuleException("A data de depósito/vencimento deve ser posterior à data base.");
        }
        int dias = (int) diasLong;

        // Taxa diária proporcional (juros simples): iDiaria = iMensal / 30
        double iMensal = taxaMensalPercentual.doubleValue() / 100.0;
        double iDiaria = iMensal / BASE_DIAS_MES;
        BigDecimal taxaDiaria = BigDecimal.valueOf(iDiaria).setScale(10, RoundingMode.HALF_UP);

        // Desconto comercial simples sobre o valor de face:
        // desconto = valorFace × iMensal × (dias/30) = valorFace × iDiaria × dias
        BigDecimal valorDesconto = BigDecimal.valueOf(valorFace.doubleValue() * iDiaria * dias)
                .setScale(2, RoundingMode.HALF_UP);
        // Trava de segurança: desconto nunca maior que o valor de face (taxas/prazos extremos).
        if (valorDesconto.compareTo(valorFace) > 0) {
            valorDesconto = valorFace;
        }
        BigDecimal valorLiquido = valorFace.subtract(valorDesconto).setScale(2, RoundingMode.HALF_UP);

        List<ParcelaDiariaDto> parcelas = montarTabelaDiaria(
                dias, valorFace, valorLiquido, valorDesconto, dataBase);

        Calculo c = new Calculo();
        c.valorFace = valorFace;
        c.dataBase = dataBase;
        c.dataDeposito = dataDeposito;
        c.taxaMensalPercentual = taxaMensalPercentual;
        c.dias = dias;
        c.taxaDiaria = taxaDiaria;
        c.valorLiquido = valorLiquido;
        c.valorDesconto = valorDesconto;
        c.parcelas = parcelas;
        return c;
    }

    /**
     * Tabela diária (juros simples). saldoDia(0) = valorLiquido e cresce linearmente
     * até valorFace no último dia (juros do dia ~constante = valorDesconto/dias).
     * No último dia força saldo = valorFace; como jurosDia é telescópico
     * (saldoDia - saldoDiaAnterior), a soma fecha exatamente em valorDesconto.
     */
    private List<ParcelaDiariaDto> montarTabelaDiaria(
            int dias,
            BigDecimal valorFace, BigDecimal valorLiquido, BigDecimal valorDesconto,
            LocalDate dataBase) {
        List<ParcelaDiariaDto> parcelas = new ArrayList<>(dias);
        BigDecimal diasBd = BigDecimal.valueOf(dias);
        BigDecimal saldoAnterior = valorLiquido;
        for (int dia = 1; dia <= dias; dia++) {
            BigDecimal saldoDia;
            BigDecimal jurosAcumulado;
            if (dia == dias) {
                saldoDia = valorFace;
                jurosAcumulado = valorDesconto;
            } else {
                jurosAcumulado = valorDesconto
                        .multiply(BigDecimal.valueOf(dia))
                        .divide(diasBd, 2, RoundingMode.HALF_UP);
                saldoDia = valorLiquido.add(jurosAcumulado).setScale(2, RoundingMode.HALF_UP);
            }
            BigDecimal jurosDia = saldoDia.subtract(saldoAnterior).setScale(2, RoundingMode.HALF_UP);

            ParcelaDiariaDto p = new ParcelaDiariaDto();
            p.setDia(dia);
            p.setData(dataBase.plusDays(dia));
            p.setSaldo(saldoDia);
            p.setJurosDia(jurosDia);
            p.setJurosAcumulado(jurosAcumulado);
            parcelas.add(p);

            saldoAnterior = saldoDia;
        }
        return parcelas;
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private DescontoChequeEntity buscar(Long id) {
        if (id == null || id < 1) {
            throw new BusinessRuleException("Identificador inválido.");
        }
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Desconto de cheque não encontrado: " + id));
    }

    private void aplicar(DescontoChequeEntity e, DescontoChequeRequest req, Calculo calc) {
        e.setDescricao(trimToNull(req.getDescricao()));
        e.setValorFace(calc.valorFace);
        e.setDataBase(calc.dataBase);
        e.setDataDeposito(calc.dataDeposito);
        e.setTaxaMensalPercentual(calc.taxaMensalPercentual);
        e.setDias(calc.dias);
        e.setTaxaDiaria(calc.taxaDiaria);
        e.setValorLiquido(calc.valorLiquido);
        e.setValorDesconto(calc.valorDesconto);
    }

    private DescontoChequeRequest paraRequest(DescontoChequeEntity e) {
        DescontoChequeRequest req = new DescontoChequeRequest();
        req.setDescricao(e.getDescricao());
        req.setValorFace(e.getValorFace());
        req.setDataBase(e.getDataBase());
        req.setDataDeposito(e.getDataDeposito());
        req.setTaxaMensalPercentual(e.getTaxaMensalPercentual());
        return req;
    }

    /** Response sem a tabela diária (resumo); o chamador anexa parcelas quando precisa. */
    private DescontoChequeResponse toResponseResumo(DescontoChequeEntity e) {
        DescontoChequeResponse r = new DescontoChequeResponse();
        r.setId(e.getId());
        r.setDescricao(e.getDescricao());
        r.setValorFace(e.getValorFace());
        r.setDataBase(e.getDataBase());
        r.setDataDeposito(e.getDataDeposito());
        r.setTaxaMensalPercentual(e.getTaxaMensalPercentual());
        r.setDias(e.getDias() != null ? e.getDias() : 0);
        r.setTaxaDiaria(e.getTaxaDiaria());
        r.setValorLiquido(e.getValorLiquido());
        r.setValorDesconto(e.getValorDesconto());
        r.setCreatedAt(e.getCreatedAt());
        r.setUpdatedAt(e.getUpdatedAt());
        return r;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** Resultado do cálculo (resumo + tabela diária), reaproveitado por simular/salvar. */
    public static class Calculo {
        public BigDecimal valorFace;
        public LocalDate dataBase;
        public LocalDate dataDeposito;
        public BigDecimal taxaMensalPercentual;
        public int dias;
        public BigDecimal taxaDiaria;
        public BigDecimal valorLiquido;
        public BigDecimal valorDesconto;
        public List<ParcelaDiariaDto> parcelas;
    }
}
