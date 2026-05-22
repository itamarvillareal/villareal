package br.com.vilareal.pagamento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pagamento.api.dto.*;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoHistoricoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoHistoricoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PagamentoConciliacaoApplicationService {

    private static final BigDecimal TOLERANCIA_VALOR = new BigDecimal("1.00");
    private static final int MAX_SUGESTOES_POR_PAGAMENTO = 3;
    private static final int MAX_DIAS_DATA = 5;

    private static final Set<String> STATUS_ORIGEM_CONFERIR = Set.of(
            PagamentoDominio.ST_PAGO_CONFIRMADO, PagamentoDominio.ST_PAGO_SEM_COMPROVANTE);

    private static final Set<String> STATUS_CANDIDATOS_CONCILIACAO = Set.of(
            PagamentoDominio.ST_AGENDADO,
            PagamentoDominio.ST_PAGO_CONFIRMADO,
            PagamentoDominio.ST_PAGO_SEM_COMPROVANTE,
            PagamentoDominio.ST_CONFERENCIA_PENDENTE);

    private static final Set<String> STATUS_VINCULAR = STATUS_CANDIDATOS_CONCILIACAO;

    private final PagamentoRepository pagamentoRepository;
    private final PagamentoHistoricoRepository historicoRepository;
    private final LancamentoFinanceiroRepository lancamentoFinanceiroRepository;
    private final UsuarioRepository usuarioRepository;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final Clock clock;

    public PagamentoConciliacaoApplicationService(
            PagamentoRepository pagamentoRepository,
            PagamentoHistoricoRepository historicoRepository,
            LancamentoFinanceiroRepository lancamentoFinanceiroRepository,
            UsuarioRepository usuarioRepository,
            @Lazy PagamentoApplicationService pagamentoApplicationService,
            Clock clock) {
        this.pagamentoRepository = pagamentoRepository;
        this.historicoRepository = historicoRepository;
        this.lancamentoFinanceiroRepository = lancamentoFinanceiroRepository;
        this.usuarioRepository = usuarioRepository;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.clock = clock;
    }

    @Transactional
    public PagamentoResponse conferir(Long id, PagamentoConferirRequest req) {
        PagamentoEntity e = requirePagamento(id);
        if (!STATUS_ORIGEM_CONFERIR.contains(e.getStatus())) {
            throw new BusinessRuleException(
                    "Pagamento com status "
                            + e.getStatus()
                            + " não pode ser conferido. Status aceitos: PAGO_CONFIRMADO, PAGO_SEM_COMPROVANTE.");
        }
        if (req.getValorPagoBanco() == null) {
            throw new BusinessRuleException("Informe o valor pago pelo banco.");
        }
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();

        if (req.getFinanceiroLancamentoId() != null) {
            LancamentoFinanceiroEntity lanc = requireLancamento(req.getFinanceiroLancamentoId());
            validarLancamentoDisponivel(lanc.getId(), e.getId());
            e.setFinanceiroLancamento(lanc);
        }

        aplicarDadosConferencia(e, req.getValorPagoBanco(), u);
        e.setStatus(PagamentoDominio.ST_CONFERIDO);
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "CONFERIDO", ant, e.getStatus(), null, req.getObservacao());
        return pagamentoApplicationService.toResponsePublic(e);
    }

    @Transactional
    public PagamentoResponse acertar(Long id, PagamentoAcertarRequest req) {
        PagamentoEntity e = requirePagamento(id);
        if (!PagamentoDominio.ST_CONFERIDO.equals(e.getStatus())) {
            throw new BusinessRuleException(
                    "Pagamento com status " + e.getStatus() + " não pode ser acertado. Status aceito: CONFERIDO.");
        }
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();
        e.setDataAcerto(LocalDate.now(clock));
        e.setStatus(PagamentoDominio.ST_ACERTADO);
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "ACERTADO", ant, e.getStatus(), null, req != null ? req.getObservacao() : null);
        return pagamentoApplicationService.toResponsePublic(e);
    }

    @Transactional
    public PagamentoResponse reabrir(Long id, PagamentoReabrirRequest req) {
        PagamentoEntity e = requirePagamento(id);
        if (!List.of(PagamentoDominio.ST_CANCELADO, PagamentoDominio.ST_VENCIDO).contains(e.getStatus())) {
            throw new BusinessRuleException(
                    "Pagamento com status "
                            + e.getStatus()
                            + " não pode ser reaberto. Status aceitos: CANCELADO, VENCIDO.");
        }
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();
        limparPosPagamento(e);
        e.setStatus(PagamentoDominio.ST_PENDENTE);
        e.setCanceladoEm(null);
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "REABERTO", ant, e.getStatus(), null, req.getObservacao());
        return pagamentoApplicationService.toResponsePublic(e);
    }

    @Transactional(readOnly = true)
    public List<ConciliacaoSugestaoPagamentoResponse> sugestoesConciliacao(
            LocalDate periodoInicio, LocalDate periodoFim, String numeroBanco) {
        if (periodoInicio == null || periodoFim == null) {
            throw new BusinessRuleException("Informe periodoInicio e periodoFim.");
        }
        Integer nb = parseNumeroBanco(numeroBanco);
        LocalDate fimLanc = periodoFim.plusDays(MAX_DIAS_DATA);

        List<PagamentoEntity> pagamentos =
                pagamentoRepository.findCandidatosConciliacao(STATUS_CANDIDATOS_CONCILIACAO, periodoInicio, periodoFim);
        List<LancamentoFinanceiroEntity> lancamentos = lancamentoFinanceiroRepository.findDebitosNaoVinculadosPagamento(
                NaturezaLancamento.DEBITO, periodoInicio, fimLanc, nb);

        List<ConciliacaoSugestaoPagamentoResponse> resultado = new ArrayList<>();
        for (PagamentoEntity p : pagamentos) {
            ConciliacaoSugestaoPagamentoResponse item = new ConciliacaoSugestaoPagamentoResponse();
            item.setPagamento(pagamentoApplicationService.toResponsePublic(p));
            List<ConciliacaoSugestaoItem> sugestoes = new ArrayList<>();
            for (LancamentoFinanceiroEntity l : lancamentos) {
                Optional<ConciliacaoSugestaoItem> cand = avaliarMatch(p, l);
                cand.ifPresent(sugestoes::add);
            }
            sugestoes.sort(Comparator.comparingInt(ConciliacaoSugestaoItem::getScore).reversed());
            if (sugestoes.size() > MAX_SUGESTOES_POR_PAGAMENTO) {
                sugestoes = sugestoes.subList(0, MAX_SUGESTOES_POR_PAGAMENTO);
            }
            item.setSugestoes(sugestoes);
            if (!sugestoes.isEmpty()) {
                resultado.add(item);
            }
        }
        resultado.sort(Comparator.comparingInt(
                        (ConciliacaoSugestaoPagamentoResponse r) ->
                                r.getSugestoes().isEmpty() ? 0 : r.getSugestoes().get(0).getScore())
                .reversed());
        return resultado;
    }

    @Transactional
    public PagamentoResponse vincularConciliacao(PagamentoConciliacaoVincularRequest req) {
        PagamentoEntity e = requirePagamento(req.getPagamentoId());
        if (!STATUS_VINCULAR.contains(e.getStatus())) {
            throw new BusinessRuleException(
                    "Pagamento com status "
                            + e.getStatus()
                            + " não pode ser vinculado. Status aceitos: AGENDADO, PAGO_CONFIRMADO, PAGO_SEM_COMPROVANTE, CONFERENCIA_PENDENTE.");
        }
        LancamentoFinanceiroEntity lanc = requireLancamento(req.getFinanceiroLancamentoId());
        validarLancamentoDisponivel(lanc.getId(), e.getId());

        UsuarioEntity u = usuarioAtual();
        BigDecimal valorBanco = lanc.getValor().abs();
        e.setFinanceiroLancamento(lanc);

        boolean precisaPagoIntermediario =
                PagamentoDominio.ST_AGENDADO.equals(e.getStatus())
                        || PagamentoDominio.ST_CONFERENCIA_PENDENTE.equals(e.getStatus());

        if (precisaPagoIntermediario) {
            String ant = e.getStatus();
            if (e.getDataPagamentoEfetivo() == null) {
                e.setDataPagamentoEfetivo(lanc.getDataLancamento());
            }
            e.setStatus(PagamentoDominio.ST_PAGO_CONFIRMADO);
            e.setAtualizadoPorUsuario(u);
            pagamentoRepository.save(e);
            registrarHistorico(e, u, "PAGO", ant, e.getStatus(), null, "Conciliação automática com extrato.");
        }

        String antConferir = e.getStatus();
        aplicarDadosConferencia(e, valorBanco, u);
        e.setStatus(PagamentoDominio.ST_CONFERIDO);
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(
                e,
                u,
                "CONCILIADO",
                antConferir,
                e.getStatus(),
                "{\"financeiroLancamentoId\":" + lanc.getId() + "}",
                null);
        return pagamentoApplicationService.toResponsePublic(e);
    }

    @Transactional
    public PagamentoResponse desvincularConciliacao(PagamentoConciliacaoDesvincularRequest req) {
        PagamentoEntity e = requirePagamento(req.getPagamentoId());
        if (e.getFinanceiroLancamento() == null) {
            throw new BusinessRuleException("Pagamento não possui vínculo com extrato bancário.");
        }
        if (PagamentoDominio.ST_ACERTADO.equals(e.getStatus())) {
            throw new BusinessRuleException("Não é possível desvincular pagamento já acertado.");
        }
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();
        e.setFinanceiroLancamento(null);
        e.setValorPagoBanco(null);
        e.setValorDiferenca(null);
        e.setDataConferencia(null);
        e.setConferidoPorUsuario(null);
        if (PagamentoDominio.ST_CONFERIDO.equals(e.getStatus())) {
            e.setStatus(PagamentoDominio.ST_PAGO_CONFIRMADO);
        }
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "DESVINCULADO", ant, e.getStatus(), null, null);
        return pagamentoApplicationService.toResponsePublic(e);
    }

    private void aplicarDadosConferencia(PagamentoEntity e, BigDecimal valorPagoBanco, UsuarioEntity u) {
        e.setValorPagoBanco(valorPagoBanco);
        e.setValorDiferenca(valorPagoBanco.subtract(e.getValor()).setScale(2, RoundingMode.HALF_UP));
        e.setDataConferencia(LocalDate.now(clock));
        e.setConferidoPorUsuario(u);
    }

    private static void limparPosPagamento(PagamentoEntity e) {
        e.setDataAgendamento(null);
        e.setDataPagamentoEfetivo(null);
        e.setDataConferencia(null);
        e.setDataAcerto(null);
        e.setValorPagoBanco(null);
        e.setValorDiferenca(null);
        e.setFinanceiroLancamento(null);
        e.setConferidoPorUsuario(null);
        e.setPrestacaoContas(null);
    }

    private Optional<ConciliacaoSugestaoItem> avaliarMatch(PagamentoEntity p, LancamentoFinanceiroEntity l) {
        BigDecimal valorPag = p.getValor();
        BigDecimal valorLanc = l.getValor().abs();
        BigDecimal diffValor = valorLanc.subtract(valorPag).abs();

        LocalDate refPag = p.getDataAgendamento() != null ? p.getDataAgendamento() : p.getDataVencimento();
        long dias = Math.abs(ChronoUnit.DAYS.between(refPag, l.getDataLancamento()));

        boolean valorExato = diffValor.compareTo(BigDecimal.ZERO) == 0;
        boolean valorProximo = diffValor.compareTo(TOLERANCIA_VALOR) <= 0;
        boolean dataProxima = dias <= MAX_DIAS_DATA;
        boolean matchCodigo = matchCodigoBarras(p.getCodigoBarras(), l.getDescricao(), l.getDescricaoDetalhada());

        if (!valorProximo && !dataProxima && !matchCodigo) {
            return Optional.empty();
        }

        int score = 0;
        List<String> motivos = new ArrayList<>();
        if (valorExato) {
            score += 3;
            motivos.add("Valor exato (R$ " + formatMoeda(valorLanc) + ")");
        } else if (valorProximo) {
            score += 2;
            motivos.add("Valor próximo (R$ " + formatMoeda(valorLanc) + ")");
        }
        if (dataProxima) {
            score += 1;
            motivos.add("Data próxima (" + dias + " dia(s))");
        }
        if (matchCodigo) {
            score += 2;
            motivos.add("Match parcial no código de barras/descrição");
        }
        if (score == 0) {
            return Optional.empty();
        }

        ConciliacaoSugestaoItem item = new ConciliacaoSugestaoItem();
        item.setLancamento(toLancamentoResumo(l));
        item.setScore(score);
        item.setMotivos(motivos);
        return Optional.of(item);
    }

    private static boolean matchCodigoBarras(String codigoBarras, String descricao, String descricaoDetalhada) {
        if (!StringUtils.hasText(codigoBarras)) {
            return false;
        }
        String digits = codigoBarras.replaceAll("\\D", "");
        if (digits.length() < 8) {
            return false;
        }
        String trecho = digits.substring(Math.max(0, digits.length() - 12));
        String texto = ((descricao != null ? descricao : "") + " " + (descricaoDetalhada != null ? descricaoDetalhada : ""))
                .replaceAll("\\D", "");
        return texto.contains(trecho) || texto.contains(digits.substring(0, Math.min(20, digits.length())));
    }

    private static String formatMoeda(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private ConciliacaoLancamentoResumo toLancamentoResumo(LancamentoFinanceiroEntity l) {
        ConciliacaoLancamentoResumo r = new ConciliacaoLancamentoResumo();
        r.setId(l.getId());
        r.setDataLancamento(l.getDataLancamento());
        r.setDescricao(l.getDescricao());
        r.setValor(l.getValor().abs());
        r.setBancoNome(l.getBancoNome());
        r.setNumeroBanco(l.getNumeroBanco());
        return r;
    }

    private void validarLancamentoDisponivel(Long lancamentoId, Long pagamentoId) {
        if (pagamentoRepository.existsByFinanceiroLancamento_IdAndIdNot(lancamentoId, pagamentoId)) {
            throw new BusinessRuleException("Este lançamento bancário já está vinculado a outro pagamento.");
        }
    }

    private LancamentoFinanceiroEntity requireLancamento(Long id) {
        return lancamentoFinanceiroRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento financeiro não encontrado: " + id));
    }

    private PagamentoEntity requirePagamento(Long id) {
        return pagamentoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Pagamento não encontrado."));
    }

    private static Integer parseNumeroBanco(String numeroBanco) {
        if (!StringUtils.hasText(numeroBanco)) {
            return null;
        }
        try {
            return Integer.parseInt(numeroBanco.trim());
        } catch (NumberFormatException e) {
            throw new BusinessRuleException("numeroBanco inválido: " + numeroBanco);
        }
    }

    private void registrarHistorico(
            PagamentoEntity p,
            UsuarioEntity u,
            String acao,
            String stAnt,
            String stNov,
            String dadosJson,
            String obs) {
        PagamentoHistoricoEntity h = new PagamentoHistoricoEntity();
        h.setPagamento(p);
        h.setUsuario(u);
        h.setAcao(acao);
        h.setStatusAnterior(stAnt);
        h.setStatusNovo(stNov);
        h.setDadosAlteradosJson(dadosJson);
        h.setObservacao(obs);
        historicoRepository.save(h);
    }

    private UsuarioEntity usuarioAtual() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated()) {
            throw new BusinessRuleException("Usuário não autenticado.");
        }
        return usuarioRepository
                .findWithPerfilByLoginIgnoreCase(a.getName())
                .orElseThrow(() -> new BusinessRuleException("Usuário não encontrado."));
    }
}
