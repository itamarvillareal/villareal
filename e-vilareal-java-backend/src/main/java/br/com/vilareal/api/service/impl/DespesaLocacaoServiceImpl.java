package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.DespesaLocacaoRequest;
import br.com.vilareal.api.dto.DespesaLocacaoResponse;
import br.com.vilareal.api.entity.ContratoLocacao;
import br.com.vilareal.api.entity.DespesaLocacao;
import br.com.vilareal.api.entity.LancamentoFinanceiro;
import br.com.vilareal.api.entity.enums.DespesaLocacaoCategoria;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.ContratoLocacaoRepository;
import br.com.vilareal.api.repository.DespesaLocacaoRepository;
import br.com.vilareal.api.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.api.service.DespesaLocacaoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DespesaLocacaoServiceImpl implements DespesaLocacaoService {
    private static final Pattern COMP_MES = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");

    private final DespesaLocacaoRepository despesaLocacaoRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LancamentoFinanceiroRepository lancamentoFinanceiroRepository;

    public DespesaLocacaoServiceImpl(
            DespesaLocacaoRepository despesaLocacaoRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            LancamentoFinanceiroRepository lancamentoFinanceiroRepository
    ) {
        this.despesaLocacaoRepository = despesaLocacaoRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.lancamentoFinanceiroRepository = lancamentoFinanceiroRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<DespesaLocacaoResponse> listar(Long contratoId) {
        if (contratoId == null) {
            return despesaLocacaoRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
        }
        return despesaLocacaoRepository.findByContratoIdOrderByIdDesc(contratoId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public DespesaLocacaoResponse criar(DespesaLocacaoRequest request) {
        ContratoLocacao c = contratoLocacaoRepository.findById(request.getContratoId())
                .orElseThrow(() -> new RegraNegocioException("Contrato não encontrado."));
        if (request.getCompetenciaMes() != null && !request.getCompetenciaMes().isBlank()) {
            if (!COMP_MES.matcher(request.getCompetenciaMes().trim()).matches()) {
                throw new RegraNegocioException("Competência inválida. Use YYYY-MM ou deixe em branco.");
            }
        }
        DespesaLocacao e = new DespesaLocacao();
        e.setContrato(c);
        e.setCompetenciaMes(request.getCompetenciaMes() != null ? request.getCompetenciaMes().trim() : null);
        e.setDescricao(request.getDescricao());
        e.setValor(request.getValor());
        e.setCategoria(request.getCategoria() != null ? request.getCategoria() : DespesaLocacaoCategoria.OUTROS);
        if (request.getLancamentoFinanceiroId() != null) {
            LancamentoFinanceiro lf = lancamentoFinanceiroRepository.findById(request.getLancamentoFinanceiroId())
                    .orElseThrow(() -> new RegraNegocioException("Lançamento financeiro não encontrado."));
            e.setLancamentoFinanceiro(lf);
        }
        e.setObservacao(request.getObservacao());
        return toResponse(despesaLocacaoRepository.save(e));
    }

    @Override
    @Transactional
    public DespesaLocacaoResponse atualizar(Long id, DespesaLocacaoRequest request) {
        DespesaLocacao e = despesaLocacaoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Despesa não encontrada: " + id));
        if (!e.getContrato().getId().equals(request.getContratoId())) {
            throw new RegraNegocioException("Não é permitido alterar o contrato da despesa.");
        }
        if (request.getCompetenciaMes() != null && !request.getCompetenciaMes().isBlank()) {
            if (!COMP_MES.matcher(request.getCompetenciaMes().trim()).matches()) {
                throw new RegraNegocioException("Competência inválida. Use YYYY-MM ou deixe em branco.");
            }
        }
        e.setCompetenciaMes(request.getCompetenciaMes() != null ? request.getCompetenciaMes().trim() : null);
        e.setDescricao(request.getDescricao());
        e.setValor(request.getValor());
        e.setCategoria(request.getCategoria() != null ? request.getCategoria() : DespesaLocacaoCategoria.OUTROS);
        if (request.getLancamentoFinanceiroId() != null) {
            LancamentoFinanceiro lf = lancamentoFinanceiroRepository.findById(request.getLancamentoFinanceiroId())
                    .orElseThrow(() -> new RegraNegocioException("Lançamento financeiro não encontrado."));
            e.setLancamentoFinanceiro(lf);
        } else {
            e.setLancamentoFinanceiro(null);
        }
        e.setObservacao(request.getObservacao());
        return toResponse(despesaLocacaoRepository.save(e));
    }

    private DespesaLocacaoResponse toResponse(DespesaLocacao e) {
        DespesaLocacaoResponse o = new DespesaLocacaoResponse();
        o.setId(e.getId());
        o.setContratoId(e.getContrato() != null ? e.getContrato().getId() : null);
        o.setCompetenciaMes(e.getCompetenciaMes());
        o.setDescricao(e.getDescricao());
        o.setValor(e.getValor());
        o.setCategoria(e.getCategoria());
        o.setLancamentoFinanceiroId(e.getLancamentoFinanceiro() != null ? e.getLancamentoFinanceiro().getId() : null);
        o.setObservacao(e.getObservacao());
        o.setCreatedAt(e.getCreatedAt());
        o.setUpdatedAt(e.getUpdatedAt());
        return o;
    }
}
