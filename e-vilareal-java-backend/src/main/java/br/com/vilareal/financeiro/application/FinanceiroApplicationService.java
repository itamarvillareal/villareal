package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.infrastructure.persistence.LancamentoFinanceiroSpecifications;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class FinanceiroApplicationService {

    private static final Sort ORDEM_LANCAMENTOS =
            Sort.by(Sort.Direction.ASC, "dataLancamento", "id");

    private final ContaContabilRepository contaContabilRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;

    public FinanceiroApplicationService(
            ContaContabilRepository contaContabilRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository) {
        this.contaContabilRepository = contaContabilRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public List<ContaContabilResponse> listarContasAtivas() {
        return contaContabilRepository.findByAtivoTrueOrderByOrdemExibicaoAscIdAsc().stream()
                .map(this::toContaResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ContaContabilResponse criarConta(ContaContabilWriteRequest req) {
        String codigo = normalizarCodigo(req.getCodigo());
        String nome = req.getNome().trim();
        validarUnicidadeConta(codigo, nome, null);
        ContaContabilEntity e = new ContaContabilEntity();
        e.setCodigo(codigo);
        e.setNome(nome);
        e.setAtivo(req.getAtivo());
        e.setOrdemExibicao(req.getOrdemExibicao());
        return toContaResponse(contaContabilRepository.save(e));
    }

    @Transactional
    public ContaContabilResponse atualizarConta(Long id, ContaContabilWriteRequest req) {
        ContaContabilEntity e = contaContabilRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conta contábil não encontrada: " + id));
        String codigo = normalizarCodigo(req.getCodigo());
        String nome = req.getNome().trim();
        validarUnicidadeConta(codigo, nome, id);
        e.setCodigo(codigo);
        e.setNome(nome);
        e.setAtivo(req.getAtivo());
        e.setOrdemExibicao(req.getOrdemExibicao());
        return toContaResponse(contaContabilRepository.save(e));
    }

    @Transactional(readOnly = true)
    public List<LancamentoFinanceiroResponse> listarLancamentos(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            java.time.LocalDate dataInicio,
            java.time.LocalDate dataFim) {
        var spec = LancamentoFinanceiroSpecifications.comFiltros(
                clienteId, processoId, contaContabilId, dataInicio, dataFim);
        return lancamentoRepository.findAll(spec, ORDEM_LANCAMENTOS).stream()
                .map(this::toLancamentoResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<LancamentoFinanceiroResponse> listarLancamentosPaginado(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            java.time.LocalDate dataInicio,
            java.time.LocalDate dataFim,
            Pageable pageable) {
        var spec = LancamentoFinanceiroSpecifications.comFiltros(
                clienteId, processoId, contaContabilId, dataInicio, dataFim);
        return lancamentoRepository.findAll(spec, pageable).map(this::toLancamentoResponse);
    }

    @Transactional(readOnly = true)
    public LancamentoFinanceiroResponse buscarLancamento(Long id) {
        return toLancamentoResponse(lancamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado: " + id)));
    }

    @Transactional
    public LancamentoFinanceiroResponse criarLancamento(LancamentoFinanceiroWriteRequest req) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        aplicarLancamento(e, req, true);
        return toLancamentoResponse(lancamentoRepository.save(e));
    }

    @Transactional
    public LancamentoFinanceiroResponse atualizarLancamento(Long id, LancamentoFinanceiroWriteRequest req) {
        LancamentoFinanceiroEntity e = lancamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado: " + id));
        aplicarLancamento(e, req, false);
        return toLancamentoResponse(lancamentoRepository.save(e));
    }

    @Transactional
    public void removerLancamento(Long id) {
        if (!lancamentoRepository.existsById(id)) {
            throw new ResourceNotFoundException("Lançamento não encontrado: " + id);
        }
        lancamentoRepository.deleteById(id);
    }

    /**
     * Apaga todos os lançamentos do extrato Cora e remove o vínculo de compensação ({@code elo_financeiro_id})
     * em qualquer outro banco que compartilhava o mesmo elo com algum lançamento Cora.
     */
    @Transactional
    public LimparExtratoCoraResult limparExtratoCoraEElosRelacionados() {
        ContaContabilEntity contaN = contaContabilRepository.findFirstByCodigoIgnoreCase("N")
                .orElseThrow(() -> new ResourceNotFoundException("Conta contábil com código «N» não encontrada."));
        final String bancoNorm = "CORA";
        List<Long> eloIds = lancamentoRepository.findDistinctEloFinanceiroIdsByBancoNormalizado(bancoNorm).stream()
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        int desvinculados = 0;
        if (!eloIds.isEmpty()) {
            List<LancamentoFinanceiroEntity> comElos = lancamentoRepository.findByEloFinanceiroIdIn(eloIds);
            for (LancamentoFinanceiroEntity l : comElos) {
                l.setEloFinanceiroId(null);
                l.setContaContabil(contaN);
                l.setCliente(null);
                l.setProcesso(null);
                l.setEqReferencia(null);
            }
            lancamentoRepository.saveAll(comElos);
            desvinculados = (int) comElos.stream()
                    .filter(l -> l.getBancoNome() == null
                            || !bancoNorm.equalsIgnoreCase(l.getBancoNome().trim()))
                    .count();
        }
        List<LancamentoFinanceiroEntity> cora = lancamentoRepository.findAllByBancoNormalizado(bancoNorm);
        int removidos = cora.size();
        lancamentoRepository.deleteAllInBatch(cora);
        LimparExtratoCoraResult r = new LimparExtratoCoraResult();
        r.setLancamentosRemovidosCora(removidos);
        r.setLancamentosDesvinculadosOutrosBancos(desvinculados);
        return r;
    }

    @Transactional(readOnly = true)
    public ResumoProcessoFinanceiroResponse resumoPorProcesso(Long processoId) {
        if (!processoRepository.existsById(processoId)) {
            throw new ResourceNotFoundException("Processo não encontrado: " + processoId);
        }
        var saldo = lancamentoRepository.sumSaldoAssinadoPorProcesso(processoId);
        long total = lancamentoRepository.countByProcesso_Id(processoId);
        ResumoProcessoFinanceiroResponse r = new ResumoProcessoFinanceiroResponse();
        r.setSaldo(saldo != null ? saldo : java.math.BigDecimal.ZERO);
        r.setTotalLancamentos(total);
        return r;
    }

    private void validarUnicidadeConta(String codigo, String nome, Long idExcluir) {
        if (idExcluir == null) {
            if (contaContabilRepository.existsByCodigoIgnoreCase(codigo)) {
                throw new BusinessRuleException("Já existe conta com este código.");
            }
            if (contaContabilRepository.existsByNome(nome)) {
                throw new BusinessRuleException("Já existe conta com este nome.");
            }
        } else {
            if (contaContabilRepository.existsByCodigoIgnoreCaseAndIdNot(codigo, idExcluir)) {
                throw new BusinessRuleException("Já existe conta com este código.");
            }
            if (contaContabilRepository.existsByNomeAndIdNot(nome, idExcluir)) {
                throw new BusinessRuleException("Já existe conta com este nome.");
            }
        }
    }

    private static String normalizarCodigo(String codigo) {
        String c = codigo != null ? codigo.trim().toUpperCase() : "";
        if (!StringUtils.hasText(c) || c.length() > 4) {
            throw new BusinessRuleException("Código da conta contábil inválido.");
        }
        return c;
    }

    private void aplicarLancamento(LancamentoFinanceiroEntity e, LancamentoFinanceiroWriteRequest req, boolean criacao) {
        ContaContabilEntity conta = contaContabilRepository.findById(req.getContaContabilId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conta contábil não encontrada: " + req.getContaContabilId()));
        e.setContaContabil(conta);

        PessoaEntity cliente = null;
        if (req.getClienteId() != null) {
            cliente = pessoaRepository.findById(req.getClienteId())
                    .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + req.getClienteId()));
        }

        ProcessoEntity processo = null;
        if (req.getProcessoId() != null) {
            processo = processoRepository.findById(req.getProcessoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
            if (cliente != null && !processo.getPessoa().getId().equals(cliente.getId())) {
                throw new BusinessRuleException("O processo informado não pertence ao cliente indicado.");
            }
            if (cliente == null) {
                cliente = processo.getPessoa();
            }
        }

        e.setCliente(cliente);
        e.setProcesso(processo);

        e.setBancoNome(req.getBancoNome() != null && !req.getBancoNome().isBlank() ? req.getBancoNome().trim() : null);
        e.setNumeroBanco(req.getNumeroBanco());
        e.setNumeroLancamento(req.getNumeroLancamento().trim());
        e.setDataLancamento(req.getDataLancamento());
        e.setDataCompetencia(req.getDataCompetencia() != null ? req.getDataCompetencia() : req.getDataLancamento());
        e.setDescricao(req.getDescricao().trim());
        e.setDescricaoDetalhada(
                req.getDescricaoDetalhada() != null && StringUtils.hasText(req.getDescricaoDetalhada())
                        ? req.getDescricaoDetalhada().trim()
                        : null);
        e.setValor(req.getValor());
        e.setNatureza(req.getNatureza());
        String refTipoReq = req.getRefTipo() != null && StringUtils.hasText(req.getRefTipo())
                ? req.getRefTipo().trim().toUpperCase()
                : "";
        e.setRefTipo("R".equals(refTipoReq) ? "R" : "N");
        e.setEqReferencia(
                req.getEqReferencia() != null && StringUtils.hasText(req.getEqReferencia())
                        ? req.getEqReferencia().trim()
                        : null);
        e.setParcelaRef(
                req.getParcelaRef() != null && StringUtils.hasText(req.getParcelaRef())
                        ? req.getParcelaRef().trim()
                        : null);

        String origem = req.getOrigem() != null ? req.getOrigem().trim() : "";
        e.setOrigem(StringUtils.hasText(origem) ? origem : "MANUAL");

        String status = req.getStatus() != null ? req.getStatus().trim() : "";
        e.setStatus(StringUtils.hasText(status) ? status : "ATIVO");

        // PUT do React não envia estes campos; preservar no update para não zerar no banco.
        if (criacao || req.getClassificacaoFinanceiraId() != null) {
            e.setClassificacaoFinanceiraId(req.getClassificacaoFinanceiraId());
        }
        if (criacao || req.getEloFinanceiroId() != null) {
            e.setEloFinanceiroId(req.getEloFinanceiroId());
        }
    }

    private ContaContabilResponse toContaResponse(ContaContabilEntity e) {
        ContaContabilResponse r = new ContaContabilResponse();
        r.setId(e.getId());
        r.setCodigo(Utf8MojibakeUtil.corrigir(e.getCodigo()));
        r.setNome(Utf8MojibakeUtil.corrigir(e.getNome()));
        return r;
    }

    private LancamentoFinanceiroResponse toLancamentoResponse(LancamentoFinanceiroEntity e) {
        LancamentoFinanceiroResponse r = new LancamentoFinanceiroResponse();
        r.setId(e.getId());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        r.setClienteId(e.getCliente() != null ? e.getCliente().getId() : null);
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        if (e.getCliente() != null) {
            r.setCodigoCliente(CodigoClienteUtil.formatar(e.getCliente().getId()));
        }
        if (e.getProcesso() != null && e.getProcesso().getNumeroInterno() != null) {
            r.setNumeroInternoProcesso(e.getProcesso().getNumeroInterno());
        }
        r.setBancoNome(Utf8MojibakeUtil.corrigir(e.getBancoNome()));
        r.setNumeroBanco(e.getNumeroBanco());
        r.setNumeroLancamento(Utf8MojibakeUtil.corrigir(e.getNumeroLancamento()));
        r.setDataLancamento(e.getDataLancamento());
        r.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao()));
        r.setDescricaoDetalhada(Utf8MojibakeUtil.corrigir(e.getDescricaoDetalhada()));
        r.setValor(e.getValor());
        r.setNatureza(e.getNatureza());
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setEqReferencia(Utf8MojibakeUtil.corrigir(e.getEqReferencia()));
        r.setParcelaRef(Utf8MojibakeUtil.corrigir(e.getParcelaRef()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setClassificacaoFinanceiraId(e.getClassificacaoFinanceiraId());
        r.setEloFinanceiroId(e.getEloFinanceiroId());
        return r;
    }
}
