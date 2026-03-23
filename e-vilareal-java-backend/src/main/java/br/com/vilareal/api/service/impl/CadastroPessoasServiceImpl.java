package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.CadastroPessoaResponsavelResumo;
import br.com.vilareal.api.dto.CadastroPessoasRequest;
import br.com.vilareal.api.dto.CadastroPessoasResponse;
import br.com.vilareal.api.entity.CadastroPessoa;
import br.com.vilareal.api.exception.CadastroPessoaNaoEncontradaException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.context.UsuarioContext;
import br.com.vilareal.api.monitoring.service.MonitoringPeopleService;
import br.com.vilareal.api.repository.CadastroPessoasRepository;
import br.com.vilareal.api.service.AuditoriaAtividadeService;
import br.com.vilareal.api.service.CadastroPessoasService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CadastroPessoasServiceImpl implements CadastroPessoasService {

    private static final Logger log = LoggerFactory.getLogger(CadastroPessoasServiceImpl.class);

    private final CadastroPessoasRepository repository;
    private final AuditoriaAtividadeService auditoriaAtividadeService;
    private final MonitoringPeopleService monitoringPeopleService;

    public CadastroPessoasServiceImpl(CadastroPessoasRepository repository,
                                    AuditoriaAtividadeService auditoriaAtividadeService,
                                    MonitoringPeopleService monitoringPeopleService) {
        this.repository = repository;
        this.auditoriaAtividadeService = auditoriaAtividadeService;
        this.monitoringPeopleService = monitoringPeopleService;
    }

    @Override
    @Transactional
    public CadastroPessoasResponse criar(CadastroPessoasRequest request) {
        validarEmailUnico(request.getEmail(), null);
        validarCpfUnico(request.getCpf(), null);
        validarResponsavel(null, request.getResponsavelId());
        CadastroPessoa entity = toEntity(request, null);
        entity = repository.save(entity);
        try {
            monitoringPeopleService.syncMonitoringAfterCadastroSave(
                    entity.getId(), Boolean.TRUE.equals(entity.getMarcadoMonitoramento()));
        } catch (Exception ex) {
            log.warn("Cadastro salvo, mas falha ao sincronizar monitoramento (personId={}): {}",
                    entity.getId(), ex.getMessage());
        }
        CadastroPessoasResponse response = toResponse(recarregarComResponsavel(entity.getId()));
        auditarPessoas("CRIACAO", response.getNome(), response.getId(),
                "cadastrou a pessoa %s (id %s).");
        return response;
    }

    @Override
    @Transactional
    public CadastroPessoasResponse atualizar(Long id, CadastroPessoasRequest request) {
        CadastroPessoa entity = buscarEntidadePorId(id);
        validarEmailUnico(request.getEmail(), id);
        validarCpfUnico(request.getCpf(), id);
        validarResponsavel(id, request.getResponsavelId());
        atualizarEntidade(entity, request);
        entity = repository.save(entity);
        try {
            monitoringPeopleService.syncMonitoringAfterCadastroSave(
                    entity.getId(), Boolean.TRUE.equals(entity.getMarcadoMonitoramento()));
        } catch (Exception ex) {
            log.warn("Cadastro salvo, mas falha ao sincronizar monitoramento (personId={}): {}",
                    entity.getId(), ex.getMessage());
        }
        CadastroPessoasResponse response = toResponse(recarregarComResponsavel(entity.getId()));
        auditarPessoas("EDICAO", response.getNome(), response.getId(),
                "alterou o cadastro de %s (id %s).");
        return response;
    }

    private CadastroPessoa recarregarComResponsavel(Long id) {
        return repository.findById(id).orElseThrow(() -> new CadastroPessoaNaoEncontradaException(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CadastroPessoasResponse> buscarPorId(Long id) {
        return repository.findById(id).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CadastroPessoasResponse> listarTodos() {
        return repository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CadastroPessoasResponse> listarAtivos() {
        return repository.findByAtivoTrue().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void excluir(Long id) {
        CadastroPessoa entity = buscarEntidadePorId(id);
        String nome = entity.getNome();
        Long idVal = entity.getId();
        repository.delete(entity);
        auditarPessoas("EXCLUSAO", nome, idVal, "excluiu o cadastro de %s (id %s).");
    }

    private void auditarPessoas(String tipoAcao, String nomePessoa, Long idPessoa, String templateMensagem) {
        String nu = nomeUsuarioAuditoria();
        String desc = String.format("Usuário %s " + templateMensagem, nu, nomePessoa, idPessoa);
        auditoriaAtividadeService.registrarInterno(
                tipoAcao,
                "Pessoas",
                "Cadastro de Pessoas",
                desc,
                idPessoa != null ? String.valueOf(idPessoa) : null,
                nomePessoa,
                null);
    }

    private static String nomeUsuarioAuditoria() {
        String n = UsuarioContext.getUsuarioNome();
        return n != null && !n.isBlank() ? n.trim() : "Não identificado";
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existePorId(Long id) {
        return repository.existsById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public long proximoIdDisponivel() {
        return repository.calcularProximoId();
    }

    private CadastroPessoa buscarEntidadePorId(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new CadastroPessoaNaoEncontradaException(id));
    }

    private void validarEmailUnico(String email, Long idExcluir) {
        if (email == null || email.isBlank()) return;
        boolean emUso = idExcluir == null
                ? repository.existsByEmail(email)
                : repository.existsByEmailAndIdNot(email, idExcluir);
        if (emUso) throw new RegraNegocioException("Já existe cadastro com o e-mail informado.");
    }

    private void validarCpfUnico(String cpf, Long idExcluir) {
        boolean emUso = idExcluir == null
                ? repository.existsByCpf(cpf)
                : repository.existsByCpfAndIdNot(cpf, idExcluir);
        if (emUso) throw new RegraNegocioException("Já existe cadastro com o CPF informado.");
    }

    /**
     * Garante existência, não auto-referência e ausência de ciclo na cadeia de responsáveis.
     */
    private void validarResponsavel(Long idEditado, Long responsavelId) {
        if (responsavelId == null) return;
        if (idEditado != null && responsavelId.equals(idEditado)) {
            throw new RegraNegocioException("A pessoa não pode ser responsável por si mesma.");
        }
        repository.findById(responsavelId)
                .orElseThrow(() -> new RegraNegocioException("Responsável não encontrado."));

        Long cur = responsavelId;
        int depth = 0;
        while (cur != null && depth++ < 64) {
            if (idEditado != null && cur.equals(idEditado)) {
                throw new RegraNegocioException("Vínculo de responsável inválido: referência circular na cadeia.");
            }
            CadastroPessoa p = repository.findById(cur)
                    .orElseThrow(() -> new RegraNegocioException("Responsável não encontrado."));
            cur = p.getResponsavel() != null ? p.getResponsavel().getId() : null;
        }
    }

    private static String normalizarCpf(String cpf) {
        return cpf == null ? null : cpf.replaceAll("\\D", "");
    }

    private static String normalizarEmailOpcional(String email) {
        if (email == null || email.isBlank()) return null;
        return email.trim();
    }

    private CadastroPessoa toEntity(CadastroPessoasRequest request, CadastroPessoa existente) {
        CadastroPessoa e = existente != null ? existente : new CadastroPessoa();
        e.setNome(request.getNome());
        e.setEmail(normalizarEmailOpcional(request.getEmail()));
        e.setCpf(normalizarCpf(request.getCpf()));
        e.setTelefone(request.getTelefone());
        e.setDataNascimento(request.getDataNascimento());
        e.setAtivo(request.getAtivo() != null ? request.getAtivo() : true);
        if (request.getMarcadoMonitoramento() != null) {
            e.setMarcadoMonitoramento(request.getMarcadoMonitoramento());
        }
        aplicarResponsavelNaEntidade(e, request.getResponsavelId());
        return e;
    }

    private void atualizarEntidade(CadastroPessoa entity, CadastroPessoasRequest request) {
        entity.setNome(request.getNome());
        entity.setEmail(normalizarEmailOpcional(request.getEmail()));
        entity.setCpf(normalizarCpf(request.getCpf()));
        entity.setTelefone(request.getTelefone());
        entity.setDataNascimento(request.getDataNascimento());
        if (request.getAtivo() != null) entity.setAtivo(request.getAtivo());
        if (request.getMarcadoMonitoramento() != null) {
            entity.setMarcadoMonitoramento(request.getMarcadoMonitoramento());
        }
        aplicarResponsavelNaEntidade(entity, request.getResponsavelId());
    }

    private void aplicarResponsavelNaEntidade(CadastroPessoa entity, Long responsavelId) {
        if (responsavelId == null) {
            entity.setResponsavel(null);
            return;
        }
        CadastroPessoa ref = repository.findById(responsavelId)
                .orElseThrow(() -> new RegraNegocioException("Responsável não encontrado."));
        entity.setResponsavel(ref);
    }

    private CadastroPessoasResponse toResponse(CadastroPessoa e) {
        CadastroPessoasResponse r = new CadastroPessoasResponse();
        r.setId(e.getId());
        r.setNome(e.getNome());
        r.setEmail(e.getEmail());
        r.setCpf(e.getCpf());
        r.setTelefone(e.getTelefone());
        r.setDataNascimento(e.getDataNascimento());
        r.setAtivo(e.getAtivo());
        r.setMarcadoMonitoramento(Boolean.TRUE.equals(e.getMarcadoMonitoramento()));
        r.setDataCriacao(e.getDataCriacao());
        r.setDataAtualizacao(e.getDataAtualizacao());
        if (e.getResponsavel() != null) {
            r.setResponsavelId(e.getResponsavel().getId());
            r.setResponsavel(toResumo(e.getResponsavel()));
        } else {
            r.setResponsavelId(null);
            r.setResponsavel(null);
        }
        return r;
    }

    private static CadastroPessoaResponsavelResumo toResumo(CadastroPessoa p) {
        CadastroPessoaResponsavelResumo s = new CadastroPessoaResponsavelResumo();
        s.setId(p.getId());
        s.setNome(p.getNome());
        s.setCpf(p.getCpf());
        s.setTipoPessoa(inferirTipoPessoa(p.getCpf()));
        return s;
    }

    /** Heurística até existir coluna dedicada no cadastro. */
    private static String inferirTipoPessoa(String cpf) {
        if (cpf == null) return null;
        String d = cpf.replaceAll("\\D", "");
        if (d.length() <= 11) return "FISICA";
        if (d.length() <= 14) return "JURIDICA";
        return null;
    }
}
