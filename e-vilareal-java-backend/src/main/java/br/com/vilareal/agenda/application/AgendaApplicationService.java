package br.com.vilareal.agenda.application;

import br.com.vilareal.agenda.api.dto.AgendaEventoResponse;
import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.infrastructure.persistence.entity.AgendaEventoEntity;
import br.com.vilareal.agenda.infrastructure.persistence.repository.AgendaEventoRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AgendaApplicationService {

    private static final Comparator<AgendaEventoResponse> ORDEM_REACT =
            Comparator.comparingInt((AgendaEventoResponse e) -> isOk(e.getStatusCurto()) ? 0 : 1)
                    .thenComparingInt(e -> horaTrim(e.getHoraEvento()).isEmpty() ? 1 : 0)
                    .thenComparing(e -> horaTrim(e.getHoraEvento()), String::compareTo)
                    .thenComparing(e -> e.getId() != null ? e.getId() : 0L);

    private final AgendaEventoRepository agendaEventoRepository;
    private final UsuarioRepository usuarioRepository;

    public AgendaApplicationService(AgendaEventoRepository agendaEventoRepository, UsuarioRepository usuarioRepository) {
        this.agendaEventoRepository = agendaEventoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<AgendaEventoResponse> listarPorUsuarioEPeriodo(Long usuarioId, LocalDate dataInicio, LocalDate dataFim) {
        validarUsuarioExiste(usuarioId);
        if (dataInicio == null || dataFim == null) {
            throw new BusinessRuleException("dataInicio e dataFim são obrigatórias.");
        }
        if (dataFim.isBefore(dataInicio)) {
            throw new BusinessRuleException("dataFim não pode ser anterior a dataInicio.");
        }
        List<AgendaEventoEntity> rows = agendaEventoRepository.findByUsuarioAndPeriodo(usuarioId, dataInicio, dataFim);
        return rows.stream().map(this::toResponse).sorted(ORDEM_REACT).collect(Collectors.toList());
    }

    @Transactional
    public AgendaEventoResponse criar(AgendaEventoWriteRequest req) {
        UsuarioEntity usuario = usuarioRepository.findById(req.getUsuarioId())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + req.getUsuarioId()));
        AgendaEventoEntity e = new AgendaEventoEntity();
        e.setUsuario(usuario);
        aplicarCampos(e, req);
        e = agendaEventoRepository.save(e);
        return toResponse(e);
    }

    @Transactional
    public AgendaEventoResponse atualizar(Long id, AgendaEventoWriteRequest req) {
        AgendaEventoEntity e = agendaEventoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Compromisso não encontrado: " + id));
        UsuarioEntity usuario = usuarioRepository.findById(req.getUsuarioId())
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + req.getUsuarioId()));
        e.setUsuario(usuario);
        aplicarCampos(e, req);
        e = agendaEventoRepository.save(e);
        return toResponse(e);
    }

    private void aplicarCampos(AgendaEventoEntity e, AgendaEventoWriteRequest req) {
        e.setDataEvento(req.getDataEvento());
        e.setHoraEvento(trimToNull(req.getHoraEvento()));
        String desc = StringUtils.hasText(req.getDescricao()) ? req.getDescricao().trim() : "Compromisso";
        if (desc.length() > 2000) {
            throw new BusinessRuleException("Descrição excede 2000 caracteres.");
        }
        e.setDescricao(desc);
        e.setStatusCurto(normalizarStatusCurto(req.getStatusCurto()));
        e.setProcessoRef(trimToNull(req.getProcessoRef()));
        e.setOrigem(StringUtils.hasText(req.getOrigem()) ? req.getOrigem().trim() : "frontend-agenda");
    }

    private static String normalizarStatusCurto(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        if ("OK".equalsIgnoreCase(raw.trim())) {
            return "OK";
        }
        return null;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String horaTrim(String h) {
        return h == null ? "" : h.trim();
    }

    private static boolean isOk(String statusCurto) {
        return statusCurto != null && "OK".equalsIgnoreCase(statusCurto.trim());
    }

    private void validarUsuarioExiste(Long usuarioId) {
        if (usuarioId == null || usuarioId < 1) {
            throw new BusinessRuleException("usuarioId inválido.");
        }
        if (!usuarioRepository.existsById(usuarioId)) {
            throw new ResourceNotFoundException("Usuário não encontrado: " + usuarioId);
        }
    }

    private AgendaEventoResponse toResponse(AgendaEventoEntity e) {
        AgendaEventoResponse r = new AgendaEventoResponse();
        r.setId(e.getId());
        if (e.getUsuario() != null) {
            r.setUsuarioId(e.getUsuario().getId());
            r.setUsuarioNome(e.getUsuario().getNome());
        }
        r.setDataEvento(e.getDataEvento());
        r.setHoraEvento(e.getHoraEvento());
        r.setDescricao(e.getDescricao());
        r.setStatusCurto(e.getStatusCurto() != null ? e.getStatusCurto() : "");
        r.setOrigem(e.getOrigem());
        return r;
    }
}
