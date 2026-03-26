package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.api.dto.ClienteListItemResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.*;
import br.com.vilareal.processo.infrastructure.persistence.entity.*;
import br.com.vilareal.processo.infrastructure.persistence.repository.*;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProcessoApplicationService {

    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository parteRepository;
    private final ProcessoAndamentoRepository andamentoRepository;
    private final ProcessoPrazoRepository prazoRepository;
    private final PessoaRepository pessoaRepository;
    private final UsuarioRepository usuarioRepository;

    public ProcessoApplicationService(
            ProcessoRepository processoRepository,
            ProcessoParteRepository parteRepository,
            ProcessoAndamentoRepository andamentoRepository,
            ProcessoPrazoRepository prazoRepository,
            PessoaRepository pessoaRepository,
            UsuarioRepository usuarioRepository) {
        this.processoRepository = processoRepository;
        this.parteRepository = parteRepository;
        this.andamentoRepository = andamentoRepository;
        this.prazoRepository = prazoRepository;
        this.pessoaRepository = pessoaRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<ClienteListItemResponse> listarClientesResumo() {
        return pessoaRepository.findAll().stream()
                .sorted(Comparator.comparing(PessoaEntity::getId))
                .map(p -> new ClienteListItemResponse(
                        p.getId(), CodigoClienteUtil.formatar(p.getId()), p.getNome()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProcessoResponse> listarPorCodigoCliente(String codigoCliente) {
        long pessoaId = CodigoClienteUtil.parsePessoaId(codigoCliente);
        if (!pessoaRepository.existsById(pessoaId)) {
            return List.of();
        }
        return processoRepository.findByPessoa_IdOrderByNumeroInternoAsc(pessoaId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProcessoResponse buscar(Long id) {
        ProcessoEntity e = requireProcesso(id);
        e.getPessoa().getNome();
        return toResponse(e);
    }

    @Transactional
    public ProcessoResponse criar(ProcessoWriteRequest req) {
        PessoaEntity pessoa = pessoaRepository.findById(req.getClienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + req.getClienteId()));
        processoRepository
                .findByPessoa_IdAndNumeroInterno(req.getClienteId(), req.getNumeroInterno())
                .ifPresent(x -> {
                    throw new BusinessRuleException("Já existe processo com este número interno para o cliente.");
                });
        ProcessoEntity e = new ProcessoEntity();
        e.setPessoa(pessoa);
        aplicarCabecalho(e, req);
        e = processoRepository.save(e);
        return toResponse(requireProcesso(e.getId()));
    }

    @Transactional
    public ProcessoResponse atualizar(Long id, ProcessoWriteRequest req) {
        ProcessoEntity e = requireProcesso(id);
        PessoaEntity pessoa = pessoaRepository.findById(req.getClienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + req.getClienteId()));
        if (!pessoa.getId().equals(e.getPessoa().getId())
                || !req.getNumeroInterno().equals(e.getNumeroInterno())) {
            processoRepository
                    .findByPessoa_IdAndNumeroInterno(req.getClienteId(), req.getNumeroInterno())
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(x -> {
                        throw new BusinessRuleException("Já existe processo com este número interno para o cliente.");
                    });
        }
        e.setPessoa(pessoa);
        e.setNumeroInterno(req.getNumeroInterno());
        aplicarCabecalho(e, req);
        processoRepository.save(e);
        return toResponse(requireProcesso(id));
    }

    @Transactional
    public void patchAtivo(Long id, boolean ativo) {
        ProcessoEntity e = requireProcesso(id);
        e.setAtivo(ativo);
        processoRepository.save(e);
    }

    @Transactional(readOnly = true)
    public List<ProcessoParteResponse> listarPartes(Long processoId) {
        requireProcesso(processoId);
        return parteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId).stream()
                .map(this::toParteResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProcessoParteResponse criarParte(Long processoId, ProcessoParteWriteRequest req) {
        ProcessoEntity proc = requireProcesso(processoId);
        ProcessoParteEntity p = new ProcessoParteEntity();
        p.setProcesso(proc);
        aplicarParte(p, req);
        p = parteRepository.save(p);
        return toParteResponse(parteRepository.findById(p.getId()).orElseThrow());
    }

    @Transactional
    public ProcessoParteResponse atualizarParte(Long processoId, Long parteId, ProcessoParteWriteRequest req) {
        ProcessoParteEntity p = requireParte(processoId, parteId);
        aplicarParte(p, req);
        parteRepository.save(p);
        return toParteResponse(requireParte(processoId, parteId));
    }

    @Transactional
    public void excluirParte(Long processoId, Long parteId) {
        ProcessoParteEntity p = requireParte(processoId, parteId);
        parteRepository.delete(p);
    }

    @Transactional(readOnly = true)
    public List<ProcessoAndamentoResponse> listarAndamentos(Long processoId) {
        requireProcesso(processoId);
        return andamentoRepository.findByProcesso_IdOrderByMovimentoEmDescIdDesc(processoId).stream()
                .map(this::toAndamentoResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProcessoAndamentoResponse criarAndamento(Long processoId, ProcessoAndamentoWriteRequest req) {
        ProcessoEntity proc = requireProcesso(processoId);
        ProcessoAndamentoEntity a = new ProcessoAndamentoEntity();
        a.setProcesso(proc);
        aplicarAndamento(a, req);
        a = andamentoRepository.save(a);
        return toAndamentoResponse(andamentoRepository.findById(a.getId()).orElseThrow());
    }

    @Transactional
    public ProcessoAndamentoResponse atualizarAndamento(
            Long processoId, Long andamentoId, ProcessoAndamentoWriteRequest req) {
        ProcessoAndamentoEntity a = requireAndamento(processoId, andamentoId);
        aplicarAndamento(a, req);
        andamentoRepository.save(a);
        return toAndamentoResponse(requireAndamento(processoId, andamentoId));
    }

    @Transactional
    public void excluirAndamento(Long processoId, Long andamentoId) {
        ProcessoAndamentoEntity a = requireAndamento(processoId, andamentoId);
        andamentoRepository.delete(a);
    }

    @Transactional(readOnly = true)
    public List<ProcessoPrazoResponse> listarPrazos(Long processoId) {
        requireProcesso(processoId);
        return prazoRepository.findByProcesso_IdOrderByIdAsc(processoId).stream()
                .map(this::toPrazoResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProcessoPrazoResponse criarPrazo(Long processoId, ProcessoPrazoWriteRequest req) {
        ProcessoEntity proc = requireProcesso(processoId);
        ProcessoPrazoEntity z = new ProcessoPrazoEntity();
        z.setProcesso(proc);
        aplicarPrazo(z, req);
        z = prazoRepository.save(z);
        return toPrazoResponse(prazoRepository.findById(z.getId()).orElseThrow());
    }

    @Transactional
    public ProcessoPrazoResponse atualizarPrazo(Long processoId, Long prazoId, ProcessoPrazoWriteRequest req) {
        ProcessoPrazoEntity z = requirePrazo(processoId, prazoId);
        aplicarPrazo(z, req);
        prazoRepository.save(z);
        return toPrazoResponse(requirePrazo(processoId, prazoId));
    }

    private ProcessoEntity requireProcesso(Long id) {
        return processoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + id));
    }

    private ProcessoParteEntity requireParte(Long processoId, Long parteId) {
        ProcessoParteEntity p = parteRepository
                .findById(parteId)
                .orElseThrow(() -> new ResourceNotFoundException("Parte não encontrada: " + parteId));
        if (!p.getProcesso().getId().equals(processoId)) {
            throw new ResourceNotFoundException("Parte não encontrada neste processo.");
        }
        return p;
    }

    private ProcessoAndamentoEntity requireAndamento(Long processoId, Long andamentoId) {
        ProcessoAndamentoEntity a = andamentoRepository
                .findById(andamentoId)
                .orElseThrow(() -> new ResourceNotFoundException("Andamento não encontrado: " + andamentoId));
        if (!a.getProcesso().getId().equals(processoId)) {
            throw new ResourceNotFoundException("Andamento não encontrado neste processo.");
        }
        return a;
    }

    private ProcessoPrazoEntity requirePrazo(Long processoId, Long prazoId) {
        ProcessoPrazoEntity z = prazoRepository
                .findById(prazoId)
                .orElseThrow(() -> new ResourceNotFoundException("Prazo não encontrado: " + prazoId));
        if (!z.getProcesso().getId().equals(processoId)) {
            throw new ResourceNotFoundException("Prazo não encontrado neste processo.");
        }
        return z;
    }

    private void aplicarCabecalho(ProcessoEntity e, ProcessoWriteRequest req) {
        e.setNumeroInterno(req.getNumeroInterno());
        e.setNumeroCnj(trimToNull(req.getNumeroCnj()));
        e.setNumeroProcessoAntigo(trimToNull(req.getNumeroProcessoAntigo()));
        e.setNaturezaAcao(trimToNull(req.getNaturezaAcao()));
        e.setDescricaoAcao(trimToNull(req.getDescricaoAcao()));
        e.setCompetencia(trimToNull(req.getCompetencia()));
        e.setFase(trimToNull(req.getFase()));
        e.setStatus(trimToNull(req.getStatus()));
        e.setTramitacao(trimToNull(req.getTramitacao()));
        e.setDataProtocolo(req.getDataProtocolo());
        e.setPrazoFatal(req.getPrazoFatal());
        e.setProximaConsulta(req.getProximaConsulta());
        e.setObservacao(trimToNull(req.getObservacao()));
        e.setValorCausa(req.getValorCausa());
        if (req.getUf() != null && StringUtils.hasText(req.getUf())) {
            String u = req.getUf().trim().toUpperCase();
            e.setUf(u.length() > 2 ? u.substring(0, 2) : u);
        } else {
            e.setUf(null);
        }
        e.setCidade(trimToNull(req.getCidade()));
        e.setConsultaAutomatica(Boolean.TRUE.equals(req.getConsultaAutomatica()));
        if (req.getAtivo() != null) {
            e.setAtivo(req.getAtivo());
        }
        e.setConsultor(trimToNull(req.getConsultor()));
        if (req.getUsuarioResponsavelId() != null) {
            UsuarioEntity u = usuarioRepository
                    .findById(req.getUsuarioResponsavelId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Usuário não encontrado: " + req.getUsuarioResponsavelId()));
            e.setUsuarioResponsavel(u);
        } else {
            e.setUsuarioResponsavel(null);
        }
    }

    private void aplicarParte(ProcessoParteEntity p, ProcessoParteWriteRequest req) {
        if (req.getPessoaId() != null) {
            PessoaEntity pe = pessoaRepository
                    .findById(req.getPessoaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + req.getPessoaId()));
            p.setPessoa(pe);
        } else {
            p.setPessoa(null);
        }
        p.setNomeLivre(trimToNull(req.getNomeLivre()));
        p.setPolo(req.getPolo().trim());
        p.setQualificacao(trimToNull(req.getQualificacao()));
        p.setOrdem(req.getOrdem() != null ? req.getOrdem() : 0);
    }

    private void aplicarAndamento(ProcessoAndamentoEntity a, ProcessoAndamentoWriteRequest req) {
        a.setMovimentoEm(req.getMovimentoEm() != null ? req.getMovimentoEm() : Instant.now());
        a.setTitulo(req.getTitulo().trim());
        a.setDetalhe(trimToNull(req.getDetalhe()));
        String origem = StringUtils.hasText(req.getOrigem()) ? req.getOrigem().trim() : "MANUAL";
        a.setOrigem(origem);
        a.setOrigemAutomatica(Boolean.TRUE.equals(req.getOrigemAutomatica()));
        if (req.getUsuarioId() != null) {
            UsuarioEntity u = usuarioRepository
                    .findById(req.getUsuarioId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + req.getUsuarioId()));
            a.setUsuario(u);
        } else {
            a.setUsuario(null);
        }
    }

    private void aplicarPrazo(ProcessoPrazoEntity z, ProcessoPrazoWriteRequest req) {
        if (req.getAndamentoId() != null) {
            ProcessoAndamentoEntity a = requireAndamento(z.getProcesso().getId(), req.getAndamentoId());
            z.setAndamento(a);
        } else {
            z.setAndamento(null);
        }
        z.setDescricao(trimToNull(req.getDescricao()));
        z.setDataInicio(req.getDataInicio());
        z.setDataFim(req.getDataFim());
        z.setPrazoFatal(Boolean.TRUE.equals(req.getPrazoFatal()));
        z.setStatus(trimToNull(req.getStatus()));
        z.setObservacao(trimToNull(req.getObservacao()));
    }

    private ProcessoResponse toResponse(ProcessoEntity e) {
        Long pessoaId = e.getPessoa().getId();
        ProcessoResponse r = new ProcessoResponse();
        r.setId(e.getId());
        r.setClienteId(pessoaId);
        r.setCodigoCliente(CodigoClienteUtil.formatar(pessoaId));
        r.setNumeroInterno(e.getNumeroInterno());
        r.setNumeroCnj(e.getNumeroCnj());
        r.setNumeroProcessoAntigo(e.getNumeroProcessoAntigo());
        r.setNaturezaAcao(e.getNaturezaAcao());
        r.setCompetencia(e.getCompetencia());
        r.setFase(e.getFase());
        r.setStatus(e.getStatus());
        r.setTramitacao(e.getTramitacao());
        r.setDataProtocolo(e.getDataProtocolo());
        r.setPrazoFatal(e.getPrazoFatal());
        r.setProximaConsulta(e.getProximaConsulta());
        r.setObservacao(e.getObservacao());
        r.setValorCausa(e.getValorCausa());
        r.setUf(e.getUf());
        r.setCidade(e.getCidade());
        r.setConsultaAutomatica(e.getConsultaAutomatica());
        r.setAtivo(e.getAtivo());
        r.setConsultor(e.getConsultor());
        if (e.getUsuarioResponsavel() != null) {
            r.setUsuarioResponsavelId(e.getUsuarioResponsavel().getId());
        } else {
            r.setUsuarioResponsavelId(null);
        }
        return r;
    }

    private ProcessoParteResponse toParteResponse(ProcessoParteEntity p) {
        ProcessoParteResponse r = new ProcessoParteResponse();
        r.setId(p.getId());
        if (p.getPessoa() != null) {
            r.setPessoaId(p.getPessoa().getId());
            r.setNomeExibicao(p.getPessoa().getNome());
        } else {
            r.setPessoaId(null);
            r.setNomeExibicao(trimToNull(p.getNomeLivre()));
        }
        r.setNomeLivre(p.getNomeLivre());
        r.setPolo(p.getPolo());
        r.setQualificacao(p.getQualificacao());
        r.setOrdem(p.getOrdem());
        return r;
    }

    private ProcessoAndamentoResponse toAndamentoResponse(ProcessoAndamentoEntity a) {
        ProcessoAndamentoResponse r = new ProcessoAndamentoResponse();
        r.setId(a.getId());
        r.setMovimentoEm(a.getMovimentoEm());
        r.setTitulo(a.getTitulo());
        r.setDetalhe(a.getDetalhe());
        r.setOrigem(a.getOrigem());
        r.setOrigemAutomatica(a.getOrigemAutomatica());
        if (a.getUsuario() != null) {
            r.setUsuarioId(a.getUsuario().getId());
        } else {
            r.setUsuarioId(null);
        }
        return r;
    }

    private ProcessoPrazoResponse toPrazoResponse(ProcessoPrazoEntity z) {
        ProcessoPrazoResponse r = new ProcessoPrazoResponse();
        r.setId(z.getId());
        if (z.getAndamento() != null) {
            r.setAndamentoId(z.getAndamento().getId());
        } else {
            r.setAndamentoId(null);
        }
        r.setDescricao(z.getDescricao());
        r.setDataInicio(z.getDataInicio());
        r.setDataFim(z.getDataFim());
        r.setPrazoFatal(z.getPrazoFatal());
        r.setStatus(z.getStatus());
        r.setObservacao(z.getObservacao());
        return r;
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
