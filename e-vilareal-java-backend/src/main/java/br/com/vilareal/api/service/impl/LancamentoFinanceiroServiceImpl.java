package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.LancamentoFinanceiroRequest;
import br.com.vilareal.api.dto.LancamentoFinanceiroResponse;
import br.com.vilareal.api.dto.ResumoContaCorrenteProcessoResponse;
import br.com.vilareal.api.entity.*;
import br.com.vilareal.api.entity.enums.LancamentoOrigem;
import br.com.vilareal.api.entity.enums.LancamentoStatus;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.*;
import br.com.vilareal.api.service.LancamentoFinanceiroService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class LancamentoFinanceiroServiceImpl implements LancamentoFinanceiroService {
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final ClassificacaoFinanceiraRepository classificacaoFinanceiraRepository;
    private final EloFinanceiroRepository eloFinanceiroRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final UsuarioRepository usuarioRepository;

    public LancamentoFinanceiroServiceImpl(
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            ClassificacaoFinanceiraRepository classificacaoFinanceiraRepository,
            EloFinanceiroRepository eloFinanceiroRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            UsuarioRepository usuarioRepository
    ) {
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.classificacaoFinanceiraRepository = classificacaoFinanceiraRepository;
        this.eloFinanceiroRepository = eloFinanceiroRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LancamentoFinanceiroResponse> listar(Long clienteId, Long processoId, Long contaContabilId, LocalDate dataInicio, LocalDate dataFim) {
        return lancamentoRepository.findAllFiltered(clienteId, processoId, contaContabilId, dataInicio, dataFim)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public LancamentoFinanceiroResponse buscar(Long id) {
        return toResponse(getLancamentoOrFail(id));
    }

    @Override
    @Transactional
    public LancamentoFinanceiroResponse criar(LancamentoFinanceiroRequest request) {
        LancamentoFinanceiro l = new LancamentoFinanceiro();
        apply(l, request);
        return toResponse(lancamentoRepository.save(l));
    }

    @Override
    @Transactional
    public LancamentoFinanceiroResponse atualizar(Long id, LancamentoFinanceiroRequest request) {
        LancamentoFinanceiro l = getLancamentoOrFail(id);
        apply(l, request);
        return toResponse(lancamentoRepository.save(l));
    }

    @Override
    @Transactional
    public void excluir(Long id) {
        LancamentoFinanceiro l = getLancamentoOrFail(id);
        lancamentoRepository.delete(l);
    }

    @Override
    @Transactional(readOnly = true)
    public ResumoContaCorrenteProcessoResponse resumirContaCorrenteProcesso(Long processoId) {
        Processo processo = processoRepository.findById(processoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + processoId));
        List<LancamentoFinanceiro> list = lancamentoRepository.findAllFiltered(
                null, processo.getId(), null, null, null
        );
        BigDecimal saldo = lancamentoRepository.sumValorByProcessoId(processo.getId());
        ResumoContaCorrenteProcessoResponse r = new ResumoContaCorrenteProcessoResponse();
        r.setProcessoId(processo.getId());
        r.setSaldo(saldo == null ? BigDecimal.ZERO : saldo);
        r.setTotalLancamentos((long) list.size());
        return r;
    }

    private void apply(LancamentoFinanceiro l, LancamentoFinanceiroRequest r) {
        ContaContabil conta = contaContabilRepository.findById(r.getContaContabilId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Conta contábil não encontrada: " + r.getContaContabilId()));
        if (!Boolean.TRUE.equals(conta.getAtiva())) {
            throw new RegraNegocioException("Conta contábil inativa não pode receber lançamento.");
        }
        l.setContaContabil(conta);

        ClassificacaoFinanceira classificacao = null;
        if (r.getClassificacaoFinanceiraId() != null) {
            classificacao = classificacaoFinanceiraRepository.findById(r.getClassificacaoFinanceiraId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Classificação financeira não encontrada: " + r.getClassificacaoFinanceiraId()));
        }
        l.setClassificacaoFinanceira(classificacao);

        EloFinanceiro elo = null;
        if (r.getEloFinanceiroId() != null) {
            elo = eloFinanceiroRepository.findById(r.getEloFinanceiroId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Elo financeiro não encontrado: " + r.getEloFinanceiroId()));
        }
        l.setEloFinanceiro(elo);

        Cliente cliente = null;
        if (r.getClienteId() != null) {
            cliente = clienteRepository.findById(r.getClienteId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Cliente não encontrado: " + r.getClienteId()));
        }
        l.setCliente(cliente);

        Processo processo = null;
        if (r.getProcessoId() != null) {
            processo = processoRepository.findById(r.getProcessoId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + r.getProcessoId()));
            if (cliente != null && !processo.getCliente().getId().equals(cliente.getId())) {
                throw new RegraNegocioException("Processo informado não pertence ao cliente informado.");
            }
        }
        l.setProcesso(processo);

        Usuario usuario = null;
        if (r.getUsuarioId() != null) {
            usuario = usuarioRepository.findById(r.getUsuarioId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + r.getUsuarioId()));
        }
        l.setUsuario(usuario);

        l.setBancoNome(trimOrNull(r.getBancoNome()));
        l.setNumeroBanco(r.getNumeroBanco());
        l.setNumeroLancamento(trimOrNull(r.getNumeroLancamento()));
        l.setDataLancamento(r.getDataLancamento());
        l.setDataCompetencia(r.getDataCompetencia());
        l.setDescricao(trimOrNull(r.getDescricao()));
        l.setDescricaoDetalhada(trimOrNull(r.getDescricaoDetalhada()));
        l.setDocumentoReferencia(trimOrNull(r.getDocumentoReferencia()));
        l.setValor(r.getValor());
        l.setNatureza(r.getNatureza());
        l.setRefTipo(normalizarRefTipo(r.getRefTipo()));
        l.setEqReferencia(trimOrNull(r.getEqReferencia()));
        l.setParcelaRef(trimOrNull(r.getParcelaRef()));
        l.setStatus(r.getStatus() != null ? r.getStatus() : LancamentoStatus.ATIVO);
        l.setOrigem(r.getOrigem() != null ? r.getOrigem() : LancamentoOrigem.MANUAL);
        l.setObservacao(trimOrNull(r.getObservacao()));
        l.setMetadadosJson(trimOrNull(r.getMetadadosJson()));

        // Regras de coerência mínimas para Fase 5.
        if (Boolean.TRUE.equals(conta.getAceitaCompensacao()) && l.getEloFinanceiro() == null && l.getEqReferencia() == null) {
            throw new RegraNegocioException("Lançamento em conta de compensação exige elo financeiro ou Eq. de referência.");
        }
        if (l.getProcesso() != null && l.getCliente() == null) {
            l.setCliente(l.getProcesso().getCliente());
        }
    }

    private LancamentoFinanceiro getLancamentoOrFail(Long id) {
        return lancamentoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Lançamento financeiro não encontrado: " + id));
    }

    private LancamentoFinanceiroResponse toResponse(LancamentoFinanceiro l) {
        LancamentoFinanceiroResponse o = new LancamentoFinanceiroResponse();
        o.setId(l.getId());
        o.setContaContabilId(l.getContaContabil().getId());
        o.setContaContabilNome(l.getContaContabil().getNome());
        o.setClassificacaoFinanceiraId(l.getClassificacaoFinanceira() != null ? l.getClassificacaoFinanceira().getId() : null);
        o.setClassificacaoFinanceiraNome(l.getClassificacaoFinanceira() != null ? l.getClassificacaoFinanceira().getNome() : null);
        o.setEloFinanceiroId(l.getEloFinanceiro() != null ? l.getEloFinanceiro().getId() : null);
        o.setEloFinanceiroCodigo(l.getEloFinanceiro() != null ? l.getEloFinanceiro().getCodigo() : null);
        o.setClienteId(l.getCliente() != null ? l.getCliente().getId() : null);
        o.setProcessoId(l.getProcesso() != null ? l.getProcesso().getId() : null);
        o.setUsuarioId(l.getUsuario() != null ? l.getUsuario().getId() : null);
        o.setBancoNome(l.getBancoNome());
        o.setNumeroBanco(l.getNumeroBanco());
        o.setNumeroLancamento(l.getNumeroLancamento());
        o.setDataLancamento(l.getDataLancamento());
        o.setDataCompetencia(l.getDataCompetencia());
        o.setDescricao(l.getDescricao());
        o.setDescricaoDetalhada(l.getDescricaoDetalhada());
        o.setDocumentoReferencia(l.getDocumentoReferencia());
        o.setValor(l.getValor());
        o.setNatureza(l.getNatureza() != null ? l.getNatureza().name() : null);
        o.setRefTipo(l.getRefTipo());
        o.setEqReferencia(l.getEqReferencia());
        o.setParcelaRef(l.getParcelaRef());
        o.setStatus(l.getStatus() != null ? l.getStatus().name() : null);
        o.setOrigem(l.getOrigem() != null ? l.getOrigem().name() : null);
        o.setObservacao(l.getObservacao());
        o.setMetadadosJson(l.getMetadadosJson());
        o.setCreatedAt(l.getCreatedAt());
        o.setUpdatedAt(l.getUpdatedAt());
        return o;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String normalizarRefTipo(String raw) {
        String t = trimOrNull(raw);
        if (t == null) return "N";
        return "R".equalsIgnoreCase(t) ? "R" : "N";
    }
}
