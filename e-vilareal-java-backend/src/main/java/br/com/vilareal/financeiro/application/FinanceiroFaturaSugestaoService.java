package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.LancamentoCartaoResponse;
import br.com.vilareal.financeiro.api.dto.LancamentoFinanceiroResponse;
import br.com.vilareal.financeiro.api.dto.SugestaoPagamentoFaturaResponse;
import br.com.vilareal.financeiro.api.dto.SugestoesPagamentoFaturaResponse;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.TipoMatchFatura;
import br.com.vilareal.financeiro.infrastructure.persistence.LancamentoFinanceiroSpecifications;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoBancoMapeamentoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CartaoBancoMapeamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoCartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.PagamentoFaturaVinculoRepository;
import br.com.vilareal.pessoa.application.TitularPessoaRefHelper;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Pattern;
@Service
public class FinanceiroFaturaSugestaoService {

    private final CartaoBancoMapeamentoRepository mapeamentoRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final LancamentoCartaoRepository lancamentoCartaoRepository;
    private final PagamentoFaturaVinculoRepository vinculoRepository;

    public FinanceiroFaturaSugestaoService(
            CartaoBancoMapeamentoRepository mapeamentoRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            LancamentoCartaoRepository lancamentoCartaoRepository,
            PagamentoFaturaVinculoRepository vinculoRepository) {
        this.mapeamentoRepository = mapeamentoRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.lancamentoCartaoRepository = lancamentoCartaoRepository;
        this.vinculoRepository = vinculoRepository;
    }

    @Transactional(readOnly = true)
    public SugestoesPagamentoFaturaResponse listarSugestoes(String mesRef, int page, int size) {
        YearMonth ym = YearMonth.parse(mesRef.trim());
        LocalDate inicio = ym.atDay(1);
        LocalDate fim = ym.atEndOfMonth();

        List<CartaoBancoMapeamentoEntity> regras = mapeamentoRepository.findByAtivoTrueOrderByCartaoIdAscIdAsc();
        Set<Long> bancosVinculados = new HashSet<>(vinculoRepository.findAllLancamentoBancoIds());
        Set<Long> cartoesVinculados = new HashSet<>(vinculoRepository.findAllLancamentoCartaoIds());

        List<SugestaoPagamentoFaturaResponse> todas = new ArrayList<>();
        Set<Long> debitosUsados = new HashSet<>();

        for (CartaoBancoMapeamentoEntity regra : regras) {
            var spec = LancamentoFinanceiroSpecifications.comFiltros(
                    null,
                    null,
                    null,
                    inicio,
                    fim,
                    null,
                    regra.getNumeroBanco(),
                    null,
                    null,
                    null,
                    ym.getYear(),
                    ym.getMonthValue());
            List<LancamentoFinanceiroEntity> debitos = lancamentoRepository.findAll(spec, Sort.by("dataLancamento", "id"))
                    .stream()
                    .filter(l -> l.getNatureza() == NaturezaLancamento.DEBITO)
                    .filter(l -> l.getDataLancamento() != null)
                    .filter(l -> !bancosVinculados.contains(l.getId()))
                    .filter(l -> matchPadrao(l.getDescricao(), regra.getPadraoDescricao(), regra.getTipoMatch()))
                    .toList();

            Long cartaoId = regra.getCartao().getId();
            List<LancamentoCartaoEntity> fechamentosMes =
                    lancamentoCartaoRepository.findFechamentosAutomaticosNoPeriodo(cartaoId, inicio, fim);
            List<LancamentoCartaoEntity> faturasMes =
                    lancamentoCartaoRepository.findByCartaoAndPeriodo(cartaoId, inicio, fim);

            Set<Long> cartoesJaVinculados = cartoesVinculados;

            List<LancamentoCartaoEntity> candidatosCartao = fechamentosMes.isEmpty()
                    ? faturasMes.stream()
                            .filter(f -> !FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(f))
                            .toList()
                    : fechamentosMes.stream()
                            .filter(f -> !cartoesJaVinculados.contains(f.getId()))
                            .toList();

            if (candidatosCartao.isEmpty()) {
                continue;
            }

            BigDecimal somaFaturaMes = candidatosCartao.stream()
                    .map(f -> FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(f)
                            ? f.getValor().abs()
                            : (f.getValor().compareTo(BigDecimal.ZERO) > 0 ? f.getValor() : BigDecimal.ZERO))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            for (LancamentoFinanceiroEntity debito : debitos) {
                if (!debitosUsados.add(debito.getId())) {
                    continue;
                }
                Optional<CandidatoFatura> melhor = encontrarMelhorCandidato(
                        debito, regra, candidatosCartao, somaFaturaMes);
                melhor.ifPresent(c -> todas.add(montarSugestao(debito, c, regra)));
            }
        }

        todas.sort(Comparator.comparing(SugestaoPagamentoFaturaResponse::getDiferencaValor)
                .thenComparing(SugestaoPagamentoFaturaResponse::getDiasDiferenca));

        int limit = Math.max(1, Math.min(size, 100));
        int offset = Math.max(0, page) * limit;
        int total = todas.size();
        List<SugestaoPagamentoFaturaResponse> pagina =
                offset >= total ? List.of() : todas.subList(offset, Math.min(offset + limit, total));

        SugestoesPagamentoFaturaResponse response = new SugestoesPagamentoFaturaResponse();
        response.setSugestoes(pagina);
        response.setTotalSugestoes(total);
        response.setPage(page);
        response.setTotalPages(total == 0 ? 0 : (int) Math.ceil((double) total / limit));
        return response;
    }

    private Optional<CandidatoFatura> encontrarMelhorCandidato(
            LancamentoFinanceiroEntity debito,
            CartaoBancoMapeamentoEntity regra,
            List<LancamentoCartaoEntity> faturasMes,
            BigDecimal somaFaturaMes) {
        BigDecimal valorDebito = debito.getValor().abs();
        List<CandidatoFatura> candidatos = new ArrayList<>();

        if (somaFaturaMes.compareTo(BigDecimal.ZERO) > 0
                && dentroTolerancia(valorDebito, somaFaturaMes, regra.getToleranciaValor())
                && faturasMes.stream().noneMatch(FinanceiroFaturaCartaoFechamentoService::ehLancamentoFechamentoAutomatico)) {
            faturasMes.stream()
                    .filter(f -> f.getValor().compareTo(BigDecimal.ZERO) > 0)
                    .max(Comparator.comparing(LancamentoCartaoEntity::getValor))
                    .filter(f -> dataDentroJanela(
                            debito.getDataLancamento(), f.getDataLancamento(), regra.getToleranciaDias()))
                    .ifPresent(f -> candidatos.add(new CandidatoFatura(f, somaFaturaMes, true)));
        } else if (somaFaturaMes.compareTo(BigDecimal.ZERO) > 0
                && dentroTolerancia(valorDebito, somaFaturaMes, regra.getToleranciaValor())
                && faturasMes.stream().allMatch(FinanceiroFaturaCartaoFechamentoService::ehLancamentoFechamentoAutomatico)
                && faturasMes.size() == 1) {
            LancamentoCartaoEntity unico = faturasMes.get(0);
            if (dataDentroJanelaVencimento(
                    debito.getDataLancamento(),
                    unico.getDataCompetencia(),
                    unico.getDataLancamento(),
                    regra.getToleranciaDias())) {
                candidatos.add(new CandidatoFatura(unico, somaFaturaMes, true));
            }
        }

        for (LancamentoCartaoEntity fatura : faturasMes) {
            BigDecimal valorFatura;
            if (FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(fatura)) {
                if (fatura.getValor().compareTo(BigDecimal.ZERO) >= 0) {
                    continue;
                }
                valorFatura = fatura.getValor().abs();
            } else {
                if (fatura.getValor().compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                valorFatura = fatura.getValor().abs();
            }
            if (!dentroTolerancia(valorDebito, valorFatura, regra.getToleranciaValor())) {
                continue;
            }
            LocalDate refData = FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(fatura)
                    ? (fatura.getDataCompetencia() != null ? fatura.getDataCompetencia() : fatura.getDataLancamento())
                    : fatura.getDataLancamento();
            if (!dataDentroJanelaVencimento(debito.getDataLancamento(), refData, refData, regra.getToleranciaDias())) {
                continue;
            }
            candidatos.add(new CandidatoFatura(fatura, valorFatura, false));
        }

        return candidatos.stream()
                .min(Comparator.comparing((CandidatoFatura c) ->
                                valorDebito.subtract(c.valorReferencia()).abs())
                        .thenComparing(c -> Math.abs(ChronoUnit.DAYS.between(
                                c.fatura().getDataLancamento(), debito.getDataLancamento()))));
    }

    private SugestaoPagamentoFaturaResponse montarSugestao(
            LancamentoFinanceiroEntity debito,
            CandidatoFatura candidato,
            CartaoBancoMapeamentoEntity regra) {
        BigDecimal valorDebito = debito.getValor().abs();
        BigDecimal dif = valorDebito.subtract(candidato.valorReferencia()).abs();
        int dias = (int) ChronoUnit.DAYS.between(candidato.fatura().getDataLancamento(), debito.getDataLancamento());

        ConfiancaSugestao confianca = dif.compareTo(new BigDecimal("0.01")) <= 0
                ? ConfiancaSugestao.ALTA
                : ConfiancaSugestao.MEDIA;

        SugestaoPagamentoFaturaResponse s = new SugestaoPagamentoFaturaResponse();
        s.setLancamentoBanco(toBancoResponse(debito));
        s.setLancamentoCartao(toCartaoResponse(candidato.fatura()));
        s.setDiferencaValor(dif.setScale(2, RoundingMode.HALF_UP));
        s.setDiasDiferenca(Math.abs(dias));
        s.setConfianca(confianca);
        s.setRegraId(regra.getId());
        s.setDescricaoRegra(
                Utf8MojibakeUtil.corrigir(regra.getPadraoDescricao())
                        + " → "
                        + Utf8MojibakeUtil.corrigir(regra.getCartao().getNome()));
        return s;
    }

    private static boolean dentroTolerancia(BigDecimal valorA, BigDecimal valorB, BigDecimal toleranciaFrac) {
        BigDecimal max = valorA.max(valorB);
        if (max.compareTo(BigDecimal.ZERO) == 0) {
            return true;
        }
        BigDecimal diff = valorA.subtract(valorB).abs();
        return diff.divide(max, 6, RoundingMode.HALF_UP).compareTo(toleranciaFrac) <= 0;
    }

    private static boolean dataDentroJanela(LocalDate dataDebito, LocalDate dataFatura, int toleranciaDias) {
        LocalDate limiteInferior = dataFatura.minusDays(toleranciaDias);
        return !dataDebito.isBefore(limiteInferior) && !dataDebito.isAfter(dataFatura);
    }

    /** Para AUTO-FAT (vencimento): débito bancário no vencimento ou até {@code toleranciaDias} depois. */
    private static boolean dataDentroJanelaVencimento(
            LocalDate dataDebito, LocalDate vencimento, LocalDate fallback, int toleranciaDias) {
        LocalDate ref = vencimento != null ? vencimento : fallback;
        if (ref == null) {
            return false;
        }
        LocalDate limiteInferior = ref.minusDays(toleranciaDias);
        LocalDate limiteSuperior = ref.plusDays(toleranciaDias);
        return !dataDebito.isBefore(limiteInferior) && !dataDebito.isAfter(limiteSuperior);
    }

    private static boolean matchPadrao(String texto, String padrao, TipoMatchFatura tipo) {
        if (!StringUtils.hasText(texto) || !StringUtils.hasText(padrao)) {
            return false;
        }
        return switch (tipo) {
            case CONTAINS -> texto.toUpperCase(Locale.ROOT).contains(padrao.trim().toUpperCase(Locale.ROOT));
            case REGEX -> {
                try {
                    yield Pattern.compile(padrao, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                            .matcher(texto)
                            .find();
                } catch (Exception ex) {
                    yield false;
                }
            }
        };
    }

    private record CandidatoFatura(LancamentoCartaoEntity fatura, BigDecimal valorReferencia, boolean agregadoMensal) {}

    private LancamentoFinanceiroResponse toBancoResponse(LancamentoFinanceiroEntity e) {
        LancamentoFinanceiroResponse r = new LancamentoFinanceiroResponse();
        r.setId(e.getId());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        if (e.getClienteEntidade() != null) {
            r.setClienteId(e.getClienteEntidade().getId());
        }
        Long titularId =
                TitularPessoaRefHelper.titularPessoaId(e.getProcesso(), e.getPessoaRef(), e.getClienteEntidade());
        if (titularId != null) {
            r.setPessoaRefId(titularId);
        }
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        if (e.getClienteEntidade() != null) {
            r.setCodigoCliente(e.getClienteEntidade().getCodigoCliente());
        }
        if (e.getProcesso() != null && e.getProcesso().getNumeroInterno() != null) {
            r.setNumeroInternoProcesso(e.getProcesso().getNumeroInterno());
        }
        r.setBancoNome(Utf8MojibakeUtil.corrigir(e.getBancoNome()));
        r.setNumeroBanco(e.getNumeroBanco());
        r.setNumeroLancamento(Utf8MojibakeUtil.corrigir(e.getNumeroLancamento()));
        r.setDataLancamento(e.getDataLancamento());
        r.setDataCompetencia(e.getDataCompetencia());
        r.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao()));
        r.setDescricaoDetalhada(Utf8MojibakeUtil.corrigir(e.getDescricaoDetalhada()));
        r.setValor(e.getValor());
        r.setNatureza(e.getNatureza());
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setEtapa(e.getEtapa() != null ? e.getEtapa().name() : null);
        r.setGrupoCompensacao(Utf8MojibakeUtil.corrigir(e.getGrupoCompensacao()));
        return r;
    }

    private LancamentoCartaoResponse toCartaoResponse(LancamentoCartaoEntity e) {
        LancamentoCartaoResponse r = new LancamentoCartaoResponse();
        r.setId(e.getId());
        r.setCartaoId(e.getCartao().getId());
        r.setCartaoNome(Utf8MojibakeUtil.corrigir(e.getCartao().getNome()));
        r.setNumeroCartao(e.getCartao().getNumeroCartao());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        if (e.getClienteEntidade() != null) {
            r.setClienteId(e.getClienteEntidade().getId());
        }
        Long titularCartao =
                TitularPessoaRefHelper.titularPessoaId(e.getProcesso(), e.getPessoaRef(), e.getClienteEntidade());
        if (titularCartao != null) {
            r.setPessoaRefId(titularCartao);
        }
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        if (e.getClienteEntidade() != null) {
            r.setCodigoCliente(e.getClienteEntidade().getCodigoCliente());
        }
        if (e.getProcesso() != null && e.getProcesso().getNumeroInterno() != null) {
            r.setNumeroInternoProcesso(e.getProcesso().getNumeroInterno());
        }
        r.setNumeroLancamento(Utf8MojibakeUtil.corrigir(e.getNumeroLancamento()));
        r.setDataLancamento(e.getDataLancamento());
        r.setDataCompetencia(e.getDataCompetencia());
        r.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao()));
        r.setDescricaoDetalhada(Utf8MojibakeUtil.corrigir(e.getDescricaoDetalhada()));
        r.setValor(e.getValor());
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        return r;
    }
}
