package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.RegraClassificacaoResponse;
import br.com.vilareal.financeiro.api.dto.RegraClassificacaoWriteRequest;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RegraClassificacaoApplicationService {

    private final RegraClassificacaoRepository regraRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;

    public RegraClassificacaoApplicationService(
            RegraClassificacaoRepository regraRepository,
            ContaContabilRepository contaContabilRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository) {
        this.regraRepository = regraRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public List<RegraClassificacaoResponse> listarAtivas() {
        return regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RegraClassificacaoResponse> listarTodas() {
        return regraRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RegraClassificacaoResponse buscar(Long id) {
        return toResponse(regraRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Regra de classificação não encontrada: " + id)));
    }

    @Transactional
    public RegraClassificacaoResponse criar(RegraClassificacaoWriteRequest req) {
        RegraClassificacaoEntity e = new RegraClassificacaoEntity();
        aplicar(e, req);
        return toResponse(regraRepository.save(e));
    }

    @Transactional
    public RegraClassificacaoResponse atualizar(Long id, RegraClassificacaoWriteRequest req) {
        RegraClassificacaoEntity e = regraRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Regra de classificação não encontrada: " + id));
        aplicar(e, req);
        return toResponse(regraRepository.save(e));
    }

    @Transactional
    public void remover(Long id) {
        if (!regraRepository.existsById(id)) {
            throw new ResourceNotFoundException("Regra de classificação não encontrada: " + id);
        }
        regraRepository.deleteById(id);
    }

    private void aplicar(RegraClassificacaoEntity e, RegraClassificacaoWriteRequest req) {
        ContaContabilEntity conta = contaContabilRepository.findById(req.getContaContabilId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conta contábil não encontrada: " + req.getContaContabilId()));
        e.setPadraoDescricao(req.getPadraoDescricao().trim());
        e.setTipoMatch(req.getTipoMatch());
        e.setContaContabil(conta);
        e.setLetraDestino(
                StringUtils.hasText(req.getLetraDestino())
                        ? req.getLetraDestino().trim().toUpperCase()
                        : conta.getCodigo().toUpperCase());
        e.setNumeroBanco(req.getNumeroBanco());
        e.setPrioridade(req.getPrioridade());
        e.setConfianca(req.getConfianca() != null ? req.getConfianca() : new BigDecimal("0.8000"));
        e.setAtivo(req.getAtivo());

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
    }

    private RegraClassificacaoResponse toResponse(RegraClassificacaoEntity e) {
        RegraClassificacaoResponse r = new RegraClassificacaoResponse();
        r.setId(e.getId());
        r.setPadraoDescricao(Utf8MojibakeUtil.corrigir(e.getPadraoDescricao()));
        r.setTipoMatch(e.getTipoMatch());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilCodigo(Utf8MojibakeUtil.corrigir(e.getContaContabil().getCodigo()));
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        r.setLetraDestino(
                e.getLetraDestino() != null ? e.getLetraDestino() : e.getContaContabil().getCodigo());
        r.setNumeroBanco(e.getNumeroBanco());
        r.setPrioridade(e.getPrioridade());
        r.setConfianca(e.getConfianca());
        r.setAtivo(e.getAtivo());
        r.setClienteId(e.getCliente() != null ? e.getCliente().getId() : null);
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        return r;
    }
}
