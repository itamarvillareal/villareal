package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.RepasseLocadorRequest;
import br.com.vilareal.api.dto.RepasseLocadorResponse;
import br.com.vilareal.api.entity.ContratoLocacao;
import br.com.vilareal.api.entity.LancamentoFinanceiro;
import br.com.vilareal.api.entity.RepasseLocador;
import br.com.vilareal.api.entity.enums.RepasseLocadorStatus;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.ContratoLocacaoRepository;
import br.com.vilareal.api.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.api.repository.RepasseLocadorRepository;
import br.com.vilareal.api.service.RepasseLocadorService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class RepasseLocadorServiceImpl implements RepasseLocadorService {
    private static final Pattern COMP_MES = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");

    private final RepasseLocadorRepository repasseLocadorRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LancamentoFinanceiroRepository lancamentoFinanceiroRepository;

    public RepasseLocadorServiceImpl(
            RepasseLocadorRepository repasseLocadorRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            LancamentoFinanceiroRepository lancamentoFinanceiroRepository
    ) {
        this.repasseLocadorRepository = repasseLocadorRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.lancamentoFinanceiroRepository = lancamentoFinanceiroRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RepasseLocadorResponse> listar(Long contratoId) {
        if (contratoId == null) {
            return repasseLocadorRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
        }
        return repasseLocadorRepository.findByContratoIdOrderByCompetenciaMesDesc(contratoId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public RepasseLocadorResponse criar(RepasseLocadorRequest request) {
        validarCompetencia(request.getCompetenciaMes());
        ContratoLocacao c = contratoLocacaoRepository.findById(request.getContratoId())
                .orElseThrow(() -> new RegraNegocioException("Contrato não encontrado."));
        repasseLocadorRepository.findByContratoIdAndCompetenciaMes(c.getId(), request.getCompetenciaMes().trim())
                .ifPresent(x -> {
                    throw new RegraNegocioException("Já existe repasse para este contrato e competência.");
                });
        RepasseLocador e = new RepasseLocador();
        e.setContrato(c);
        applyValores(e, request);
        return toResponse(repasseLocadorRepository.save(e));
    }

    @Override
    @Transactional
    public RepasseLocadorResponse atualizar(Long id, RepasseLocadorRequest request) {
        validarCompetencia(request.getCompetenciaMes());
        RepasseLocador e = getOrFail(id);
        if (!e.getContrato().getId().equals(request.getContratoId())) {
            throw new RegraNegocioException("Não é permitido alterar o contrato do repasse.");
        }
        if (!e.getCompetenciaMes().equals(request.getCompetenciaMes().trim())) {
            repasseLocadorRepository.findByContratoIdAndCompetenciaMes(e.getContrato().getId(), request.getCompetenciaMes().trim())
                    .ifPresent(other -> {
                        if (!other.getId().equals(id)) {
                            throw new RegraNegocioException("Já existe repasse para esta competência.");
                        }
                    });
            e.setCompetenciaMes(request.getCompetenciaMes().trim());
        }
        applyValores(e, request);
        return toResponse(repasseLocadorRepository.save(e));
    }

    private void validarCompetencia(String mes) {
        if (mes == null || !COMP_MES.matcher(mes.trim()).matches()) {
            throw new RegraNegocioException("Competência inválida. Use o formato YYYY-MM.");
        }
    }

    private void applyValores(RepasseLocador e, RepasseLocadorRequest r) {
        e.setCompetenciaMes(r.getCompetenciaMes().trim());
        e.setValorRecebidoInquilino(r.getValorRecebidoInquilino());
        e.setValorRepassadoLocador(r.getValorRepassadoLocador());
        e.setValorDespesasRepassar(r.getValorDespesasRepassar());
        e.setRemuneracaoEscritorio(r.getRemuneracaoEscritorio());
        if (r.getStatus() != null) {
            e.setStatus(r.getStatus());
        } else if (e.getStatus() == null) {
            e.setStatus(RepasseLocadorStatus.PENDENTE);
        }
        e.setDataRepasseEfetiva(r.getDataRepasseEfetiva());
        e.setObservacao(r.getObservacao());
        if (r.getLancamentoFinanceiroVinculoId() != null) {
            LancamentoFinanceiro lf = lancamentoFinanceiroRepository.findById(r.getLancamentoFinanceiroVinculoId())
                    .orElseThrow(() -> new RegraNegocioException("Lançamento financeiro não encontrado."));
            e.setLancamentoFinanceiroVinculo(lf);
        } else {
            e.setLancamentoFinanceiroVinculo(null);
        }
    }

    private RepasseLocador getOrFail(Long id) {
        return repasseLocadorRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Repasse não encontrado: " + id));
    }

    private RepasseLocadorResponse toResponse(RepasseLocador e) {
        RepasseLocadorResponse o = new RepasseLocadorResponse();
        o.setId(e.getId());
        o.setContratoId(e.getContrato() != null ? e.getContrato().getId() : null);
        o.setCompetenciaMes(e.getCompetenciaMes());
        o.setValorRecebidoInquilino(e.getValorRecebidoInquilino());
        o.setValorRepassadoLocador(e.getValorRepassadoLocador());
        o.setValorDespesasRepassar(e.getValorDespesasRepassar());
        o.setRemuneracaoEscritorio(e.getRemuneracaoEscritorio());
        o.setStatus(e.getStatus());
        o.setDataRepasseEfetiva(e.getDataRepasseEfetiva());
        o.setObservacao(e.getObservacao());
        o.setLancamentoFinanceiroVinculoId(e.getLancamentoFinanceiroVinculo() != null ? e.getLancamentoFinanceiroVinculo().getId() : null);
        o.setCreatedAt(e.getCreatedAt());
        o.setUpdatedAt(e.getUpdatedAt());
        return o;
    }
}
