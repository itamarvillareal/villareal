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
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.application.TitularPessoaRefHelper;
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
    private final ProcessoRepository processoRepository;
    private final ClienteResolverService clienteResolverService;

    public RegraClassificacaoApplicationService(
            RegraClassificacaoRepository regraRepository,
            ContaContabilRepository contaContabilRepository,
            ProcessoRepository processoRepository,
            ClienteResolverService clienteResolverService) {
        this.regraRepository = regraRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.processoRepository = processoRepository;
        this.clienteResolverService = clienteResolverService;
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

        ProcessoEntity processo = null;
        if (req.getProcessoId() != null) {
            processo = processoRepository.findById(req.getProcessoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
        }
        ClienteResolverService.VinculoClientePessoa vinculo =
                clienteResolverService.resolverVinculoOpcional(req.getClienteId(), processo);
        e.setClienteEntidade(vinculo.clienteEntidade());
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
        if (e.getClienteEntidade() != null) {
            r.setClienteId(e.getClienteEntidade().getId());
        }
        Long titularId =
                TitularPessoaRefHelper.titularPessoaId(e.getProcesso(), e.getPessoaRef(), e.getClienteEntidade());
        if (titularId != null) {
            r.setPessoaRefId(titularId);
        }
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        return r;
    }
}
