package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.AgendaEventoRequest;
import br.com.vilareal.api.dto.AgendaEventoResponse;
import br.com.vilareal.api.entity.AgendaEvento;
import br.com.vilareal.api.entity.Usuario;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.repository.AgendaEventoRepository;
import br.com.vilareal.api.repository.UsuarioRepository;
import br.com.vilareal.api.service.AgendaEventoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AgendaEventoServiceImpl implements AgendaEventoService {
    private final AgendaEventoRepository repository;
    private final UsuarioRepository usuarioRepository;

    public AgendaEventoServiceImpl(AgendaEventoRepository repository, UsuarioRepository usuarioRepository) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AgendaEventoResponse> listar(Long usuarioId, LocalDate dataInicio, LocalDate dataFim) {
        LocalDate ini = dataInicio == null ? LocalDate.now().minusDays(30) : dataInicio;
        LocalDate fim = dataFim == null ? LocalDate.now().plusDays(30) : dataFim;
        return repository.findByUsuario_IdAndDataEventoBetweenOrderByDataEventoAscHoraEventoAsc(usuarioId, ini, fim)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public AgendaEventoResponse criar(AgendaEventoRequest request) {
        Usuario usuario = usuarioRepository.findById(request.getUsuarioId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + request.getUsuarioId()));
        AgendaEvento e = new AgendaEvento();
        e.setUsuario(usuario);
        e.setDataEvento(request.getDataEvento());
        e.setHoraEvento(request.getHoraEvento());
        e.setDescricao(request.getDescricao().trim());
        e.setStatusCurto(normalizarStatusCurto(request.getStatusCurto()));
        e.setProcessoRef(trimOrNull(request.getProcessoRef()));
        e.setOrigem(trimOrNull(request.getOrigem()) == null ? "MANUAL" : trimOrNull(request.getOrigem()));
        return toResponse(repository.save(e));
    }

    @Override
    @Transactional
    public AgendaEventoResponse atualizar(Long id, AgendaEventoRequest request) {
        AgendaEvento e = repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Evento não encontrado: " + id));
        Usuario usuario = usuarioRepository.findById(request.getUsuarioId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + request.getUsuarioId()));
        e.setUsuario(usuario);
        e.setDataEvento(request.getDataEvento());
        e.setHoraEvento(request.getHoraEvento());
        e.setDescricao(request.getDescricao().trim());
        e.setStatusCurto(normalizarStatusCurto(request.getStatusCurto()));
        e.setProcessoRef(trimOrNull(request.getProcessoRef()));
        e.setOrigem(trimOrNull(request.getOrigem()) == null ? e.getOrigem() : trimOrNull(request.getOrigem()));
        return toResponse(repository.save(e));
    }

    @Override
    @Transactional
    public AgendaEventoResponse alterarStatusCurto(Long id, String statusCurto) {
        AgendaEvento e = repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Evento não encontrado: " + id));
        e.setStatusCurto(normalizarStatusCurto(statusCurto));
        return toResponse(repository.save(e));
    }

    @Override
    @Transactional
    public void excluir(Long id) {
        AgendaEvento e = repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Evento não encontrado: " + id));
        repository.delete(e);
    }

    private AgendaEventoResponse toResponse(AgendaEvento e) {
        AgendaEventoResponse r = new AgendaEventoResponse();
        r.setId(e.getId());
        r.setUsuarioId(e.getUsuario().getId());
        r.setUsuarioNome(e.getUsuario().getApelido() != null && !e.getUsuario().getApelido().isBlank() ? e.getUsuario().getApelido() : e.getUsuario().getNome());
        r.setDataEvento(e.getDataEvento());
        r.setHoraEvento(e.getHoraEvento());
        r.setDescricao(e.getDescricao());
        r.setStatusCurto(e.getStatusCurto());
        r.setProcessoRef(e.getProcessoRef());
        r.setOrigem(e.getOrigem());
        r.setCreatedAt(e.getCreatedAt());
        r.setUpdatedAt(e.getUpdatedAt());
        return r;
    }

    private static String normalizarStatusCurto(String s) {
        String t = trimOrNull(s);
        return t == null ? null : ("OK".equalsIgnoreCase(t) ? "OK" : null);
    }

    private static String trimOrNull(String s) {
        String t = String.valueOf(s == null ? "" : s).trim();
        return t.isBlank() ? null : t;
    }
}
