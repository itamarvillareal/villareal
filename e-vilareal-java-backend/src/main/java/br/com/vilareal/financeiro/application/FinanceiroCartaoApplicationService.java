package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.LancamentoCartaoSpecifications;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoCartaoRepository;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.application.TitularPessoaRefHelper;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class FinanceiroCartaoApplicationService {

    private static final Sort ORDEM =
            Sort.by(Sort.Direction.ASC, "dataLancamento", "id");

    private final CartaoRepository cartaoRepository;
    private final LancamentoCartaoRepository lancamentoCartaoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteResolverService clienteResolverService;
    private final FinanceiroSaudeService financeiroSaudeService;

    public FinanceiroCartaoApplicationService(
            CartaoRepository cartaoRepository,
            LancamentoCartaoRepository lancamentoCartaoRepository,
            ContaContabilRepository contaContabilRepository,
            ProcessoRepository processoRepository,
            ClienteResolverService clienteResolverService,
            @Lazy FinanceiroSaudeService financeiroSaudeService) {
        this.cartaoRepository = cartaoRepository;
        this.lancamentoCartaoRepository = lancamentoCartaoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.processoRepository = processoRepository;
        this.clienteResolverService = clienteResolverService;
        this.financeiroSaudeService = financeiroSaudeService;
    }

    @Transactional(readOnly = true)
    public List<CartaoResponse> listarCartoesAtivos() {
        return cartaoRepository.findByAtivoTrueOrderByOrdemExibicaoAscIdAsc().stream()
                .map(this::toCartaoResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LancamentoCartaoResponse> listarLancamentos(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            Long cartaoId,
            java.time.LocalDate dataInicio,
            java.time.LocalDate dataFim,
            Boolean fechamentoAutomatico) {
        Long clientePk =
                clienteId != null ? clienteResolverService.buscarPorId(clienteId).getId() : null;
        var spec = LancamentoCartaoSpecifications.comFiltros(
                clientePk, processoId, contaContabilId, cartaoId, dataInicio, dataFim, fechamentoAutomatico);
        return lancamentoCartaoRepository.findAll(spec, ORDEM).stream()
                .map(this::toLancamentoResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public LancamentoCartaoResponse buscarLancamento(Long id) {
        return toLancamentoResponse(lancamentoCartaoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento de cartão não encontrado: " + id)));
    }

    @Transactional
    public LancamentoCartaoResponse criarLancamento(LancamentoCartaoWriteRequest req) {
        LancamentoCartaoEntity e = new LancamentoCartaoEntity();
        aplicarLancamento(e, req, true);
        LancamentoCartaoResponse saved = toLancamentoResponse(lancamentoCartaoRepository.save(e));
        financeiroSaudeService.invalidarCacheSaude();
        return saved;
    }

    @Transactional
    public LancamentoCartaoResponse atualizarLancamento(Long id, LancamentoCartaoWriteRequest req) {
        LancamentoCartaoEntity e = lancamentoCartaoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento de cartão não encontrado: " + id));
        aplicarLancamento(e, req, false);
        LancamentoCartaoResponse saved = toLancamentoResponse(lancamentoCartaoRepository.save(e));
        financeiroSaudeService.invalidarCacheSaude();
        return saved;
    }

    @Transactional
    public void removerLancamento(Long id) {
        if (!lancamentoCartaoRepository.existsById(id)) {
            throw new ResourceNotFoundException("Lançamento de cartão não encontrado: " + id);
        }
        lancamentoCartaoRepository.deleteById(id);
        financeiroSaudeService.invalidarCacheSaude();
    }

    @Transactional
    public LimparExtratoResult limparExtratoCartao(String cartaoRaw, Integer numeroCartao) {
        if (!StringUtils.hasText(cartaoRaw)) {
            throw new BusinessRuleException("Nome do cartão é obrigatório.");
        }
        final String cartaoNorm = cartaoRaw.trim().toUpperCase(Locale.ROOT);
        Map<Long, LancamentoCartaoEntity> porId = new LinkedHashMap<>();
        for (LancamentoCartaoEntity l : lancamentoCartaoRepository.findAllByCartaoNomeNormalizado(cartaoNorm)) {
            porId.put(l.getId(), l);
        }
        if (numeroCartao != null) {
            for (LancamentoCartaoEntity l : lancamentoCartaoRepository.findAllByNumeroCartao(numeroCartao)) {
                porId.put(l.getId(), l);
            }
        }
        List<LancamentoCartaoEntity> toDelete = new ArrayList<>(porId.values());
        int removidos = toDelete.size();
        if (!toDelete.isEmpty()) {
            lancamentoCartaoRepository.deleteAll(toDelete);
        }
        LimparExtratoResult r = new LimparExtratoResult();
        r.setLancamentosRemovidos(removidos);
        r.setLancamentosDesvinculadosOutrosBancos(0);
        return r;
    }

    @Transactional(readOnly = true)
    public Page<LancamentoFinanceiroResponse> listarInboxClassificarPaginado(
            Integer numeroCartao, Integer ano, Integer mes, Pageable pageable) {
        var spec = LancamentoCartaoSpecifications.inboxClassificar(
                numeroCartao, EtapaLancamento.IMPORTADO, ano, mes);
        return lancamentoCartaoRepository.findAll(spec, pageable).map(this::toInboxClassificarResponse);
    }

    @Transactional
    public void aplicarClassificacaoInbox(
            Long lancamentoCartaoId, Long contaContabilId, Long clienteId, Long processoId) {
        LancamentoCartaoEntity e = lancamentoCartaoRepository.findById(lancamentoCartaoId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Lançamento de cartão não encontrado: " + lancamentoCartaoId));
        ContaContabilEntity conta = contaContabilRepository.findById(contaContabilId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conta contábil não encontrada: " + contaContabilId));
        e.setContaContabil(conta);

        ProcessoEntity processo = null;
        if (processoId != null) {
            processo = processoRepository.findById(processoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        }
        ClienteResolverService.VinculoClientePessoa vinculo =
                clienteResolverService.resolverVinculoOpcional(clienteId, processo);
        e.setClienteEntidade(vinculo.clienteEntidade());
        e.setProcesso(processo);

        Long cid = e.getClienteEntidade() != null ? e.getClienteEntidade().getId() : null;
        e.setEtapa(EtapaLancamento.calcular(conta.getCodigo(), e.getGrupoCompensacao(), cid));
        lancamentoCartaoRepository.save(e);
        financeiroSaudeService.invalidarCacheSaude();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> contarPorEtapa() {
        Map<String, Long> mapa = new LinkedHashMap<>();
        for (EtapaLancamento etapa : EtapaLancamento.values()) {
            mapa.put(etapa.name(), lancamentoCartaoRepository.countByEtapa(etapa));
        }
        return mapa;
    }

    private void aplicarLancamento(LancamentoCartaoEntity e, LancamentoCartaoWriteRequest req, boolean criacao) {
        CartaoEntity cartao = cartaoRepository.findById(req.getCartaoId())
                .orElseThrow(() -> new ResourceNotFoundException("Cartão não encontrado: " + req.getCartaoId()));
        e.setCartao(cartao);

        ContaContabilEntity conta = contaContabilRepository.findById(req.getContaContabilId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conta contábil não encontrada: " + req.getContaContabilId()));
        e.setContaContabil(conta);

        ProcessoEntity processo = null;
        if (req.getProcessoId() != null) {
            processo = processoRepository.findById(req.getProcessoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
        }
        ClienteResolverService.VinculoClientePessoa vinculo =
                clienteResolverService.resolverVinculoOpcional(req.getClienteId(), processo);
        e.setClienteEntidade(vinculo.clienteEntidade());
        e.setProcesso(processo);
        e.setNumeroLancamento(req.getNumeroLancamento().trim());
        e.setDataLancamento(req.getDataLancamento());
        if (criacao) {
            e.setDataCompetencia(req.getDataCompetencia() != null ? req.getDataCompetencia() : req.getDataLancamento());
        } else if (req.getDataCompetencia() != null) {
            e.setDataCompetencia(req.getDataCompetencia());
        }
        e.setDescricao(req.getDescricao().trim());
        e.setDescricaoDetalhada(
                req.getDescricaoDetalhada() != null && StringUtils.hasText(req.getDescricaoDetalhada())
                        ? req.getDescricaoDetalhada().trim()
                        : null);
        e.setValor(req.getValor());

        String refTipoReq = req.getRefTipo() != null && StringUtils.hasText(req.getRefTipo())
                ? req.getRefTipo().trim().toUpperCase()
                : "";
        e.setRefTipo("R".equals(refTipoReq) ? "R" : "N");

        String origem = req.getOrigem() != null ? req.getOrigem().trim() : "";
        e.setOrigem(StringUtils.hasText(origem) ? origem : "MANUAL");

        String status = req.getStatus() != null ? req.getStatus().trim() : "";
        e.setStatus(StringUtils.hasText(status) ? status : "ATIVO");

        if (req.getGrupoCompensacao() != null) {
            String g = req.getGrupoCompensacao().trim();
            e.setGrupoCompensacao(StringUtils.hasText(g) ? g : null);
        }

        aplicarEtapa(e, req, conta);
    }

    private void aplicarEtapa(
            LancamentoCartaoEntity e, LancamentoCartaoWriteRequest req, ContaContabilEntity conta) {
        if (req.getEtapa() != null && StringUtils.hasText(req.getEtapa())) {
            e.setEtapa(EtapaLancamento.valueOf(req.getEtapa().trim().toUpperCase(Locale.ROOT)));
            return;
        }
        Long clienteFkId = e.getClienteEntidade() != null ? e.getClienteEntidade().getId() : null;
        e.setEtapa(EtapaLancamento.calcular(conta.getCodigo(), e.getGrupoCompensacao(), clienteFkId));
    }

    private CartaoResponse toCartaoResponse(CartaoEntity e) {
        CartaoResponse r = new CartaoResponse();
        r.setId(e.getId());
        r.setNome(Utf8MojibakeUtil.corrigir(e.getNome()));
        r.setNumeroCartao(e.getNumeroCartao());
        r.setAtivo(e.getAtivo());
        r.setOrdemExibicao(e.getOrdemExibicao());
        return r;
    }

    public LancamentoFinanceiroResponse toInboxClassificarResponse(LancamentoCartaoEntity e) {
        LancamentoCartaoResponse c = toLancamentoResponse(e);
        LancamentoFinanceiroResponse r = new LancamentoFinanceiroResponse();
        r.setId(c.getId());
        r.setContaContabilId(c.getContaContabilId());
        r.setContaContabilNome(c.getContaContabilNome());
        r.setClienteId(c.getClienteId());
        r.setPessoaRefId(c.getPessoaRefId());
        r.setProcessoId(c.getProcessoId());
        r.setCodigoCliente(c.getCodigoCliente());
        r.setNumeroInternoProcesso(c.getNumeroInternoProcesso());
        r.setBancoNome(c.getCartaoNome());
        r.setNumeroBanco(c.getNumeroCartao());
        r.setNumeroLancamento(c.getNumeroLancamento());
        r.setDataLancamento(c.getDataLancamento());
        r.setDataCompetencia(c.getDataCompetencia());
        r.setDescricao(c.getDescricao());
        r.setDescricaoDetalhada(c.getDescricaoDetalhada());
        java.math.BigDecimal valor = c.getValor() != null ? c.getValor() : java.math.BigDecimal.ZERO;
        r.setValor(valor.abs());
        r.setNatureza(valor.signum() < 0 ? NaturezaLancamento.CREDITO : NaturezaLancamento.DEBITO);
        r.setRefTipo(c.getRefTipo());
        r.setOrigem(c.getOrigem());
        r.setStatus(c.getStatus());
        r.setEtapa(c.getEtapa());
        r.setGrupoCompensacao(c.getGrupoCompensacao());
        return r;
    }

    private LancamentoCartaoResponse toLancamentoResponse(LancamentoCartaoEntity e) {
        LancamentoCartaoResponse r = new LancamentoCartaoResponse();
        r.setId(e.getId());
        r.setCartaoId(e.getCartao().getId());
        r.setCartaoNome(Utf8MojibakeUtil.corrigir(e.getCartao().getNome()));
        r.setNumeroCartao(e.getCartao().getNumeroCartao());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        if (e.getClienteEntidade() != null) {
            r.setClienteId(e.getClienteEntidade().getId());
            r.setCodigoCliente(e.getClienteEntidade().getCodigoCliente());
        }
        Long titularId =
                TitularPessoaRefHelper.titularPessoaId(e.getProcesso(), e.getPessoaRef(), e.getClienteEntidade());
        if (titularId != null) {
            r.setPessoaRefId(titularId);
        }
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
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
        r.setEtapa(e.getEtapa() != null ? e.getEtapa().name() : EtapaLancamento.IMPORTADO.name());
        r.setGrupoCompensacao(e.getGrupoCompensacao());
        return r;
    }
}
