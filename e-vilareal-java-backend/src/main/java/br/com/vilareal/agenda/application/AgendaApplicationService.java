package br.com.vilareal.agenda.application;

import br.com.vilareal.agenda.api.dto.AgendaEventoLinhaDto;
import br.com.vilareal.agenda.api.dto.AgendaEventoResponse;
import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.api.dto.AgendaMensalResponse;
import br.com.vilareal.agenda.api.dto.DiaAgendaMensalDto;
import br.com.vilareal.agenda.infrastructure.persistence.entity.AgendaEventoEntity;
import br.com.vilareal.agenda.infrastructure.persistence.repository.AgendaEventoRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
public class AgendaApplicationService {

    private static final Comparator<AgendaEventoResponse> ORDEM_REACT =
            Comparator.comparingInt((AgendaEventoResponse e) -> isOk(e.getStatusCurto()) ? 0 : 1)
                    .thenComparingInt(e -> horaTrim(e.getHoraEvento()).isEmpty() ? 1 : 0)
                    .thenComparing(e -> horaTrim(e.getHoraEvento()), String::compareTo)
                    .thenComparing(e -> e.getId() != null ? e.getId() : 0L);

    private static final Comparator<AgendaEventoEntity> ORDEM_ENTIDADE =
            Comparator.comparingInt((AgendaEventoEntity e) -> isOk(e.getStatusCurto()) ? 0 : 1)
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

    /**
     * Todos os compromissos no intervalo, qualquer usuário (visão «Geral» no React — só leitura agregada).
     */
    @Transactional(readOnly = true)
    public List<AgendaEventoResponse> listarTodosUsuariosNoPeriodo(LocalDate dataInicio, LocalDate dataFim) {
        if (dataInicio == null || dataFim == null) {
            throw new BusinessRuleException("dataInicio e dataFim são obrigatórias.");
        }
        if (dataFim.isBefore(dataInicio)) {
            throw new BusinessRuleException("dataFim não pode ser anterior a dataInicio.");
        }
        List<AgendaEventoEntity> rows = agendaEventoRepository.findByPeriodoTodosUsuarios(dataInicio, dataFim);
        return rows.stream().map(this::toResponse).sorted(ORDEM_REACT).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AgendaMensalResponse resumoMensal(Long usuarioId, int ano, int mes) {
        validarUsuarioExiste(usuarioId);
        if (mes < 1 || mes > 12) {
            throw new BusinessRuleException("Mês inválido.");
        }
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());
        List<AgendaEventoEntity> rows = agendaEventoRepository.findByUsuarioAndPeriodo(usuarioId, inicio, fim);
        Map<LocalDate, List<AgendaEventoEntity>> porDia = rows.stream()
                .collect(Collectors.groupingBy(AgendaEventoEntity::getDataEvento, TreeMap::new, Collectors.toList()));
        List<DiaAgendaMensalDto> dias = new ArrayList<>();
        for (Map.Entry<LocalDate, List<AgendaEventoEntity>> e : porDia.entrySet()) {
            List<AgendaEventoEntity> lista = e.getValue();
            if (lista.isEmpty()) {
                continue;
            }
            DiaAgendaMensalDto d = new DiaAgendaMensalDto();
            d.setDataBr(formatarDataBr(e.getKey()));
            d.setEventos(lista.stream().sorted(ORDEM_ENTIDADE).map(this::toLinha).collect(Collectors.toList()));
            dias.add(d);
        }
        AgendaMensalResponse r = new AgendaMensalResponse();
        r.setAno(ano);
        r.setMes(mes);
        r.setUsuarioId(usuarioId);
        r.setTodosUsuarios(false);
        r.setDiasComEventos(dias);
        return r;
    }

    @Transactional(readOnly = true)
    public AgendaMensalResponse resumoMensalTodosUsuarios(int ano, int mes) {
        if (mes < 1 || mes > 12) {
            throw new BusinessRuleException("Mês inválido.");
        }
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());
        List<AgendaEventoEntity> rows = agendaEventoRepository.findByPeriodoTodosUsuarios(inicio, fim);
        Map<LocalDate, List<AgendaEventoEntity>> porDia = rows.stream()
                .collect(Collectors.groupingBy(AgendaEventoEntity::getDataEvento, TreeMap::new, Collectors.toList()));
        List<DiaAgendaMensalDto> dias = new ArrayList<>();
        for (Map.Entry<LocalDate, List<AgendaEventoEntity>> e : porDia.entrySet()) {
            List<AgendaEventoEntity> lista = e.getValue();
            if (lista.isEmpty()) {
                continue;
            }
            DiaAgendaMensalDto d = new DiaAgendaMensalDto();
            d.setDataBr(formatarDataBr(e.getKey()));
            d.setEventos(lista.stream().sorted(ORDEM_ENTIDADE).map(this::toLinhaComUsuario).collect(Collectors.toList()));
            dias.add(d);
        }
        AgendaMensalResponse r = new AgendaMensalResponse();
        r.setAno(ano);
        r.setMes(mes);
        r.setUsuarioId(null);
        r.setTodosUsuarios(true);
        r.setDiasComEventos(dias);
        return r;
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

    /** Mesma regra do login / front: apelido; se vazio, login (nunca o nome civil completo). */
    private static String nomeExibicaoAgendaUsuario(UsuarioEntity u) {
        if (u == null) {
            return "";
        }
        String ap = u.getApelido() != null ? u.getApelido().trim() : "";
        if (StringUtils.hasText(ap)) {
            return Utf8MojibakeUtil.corrigir(ap);
        }
        return Utf8MojibakeUtil.corrigir(u.getLogin() != null ? u.getLogin() : "");
    }

    private AgendaEventoResponse toResponse(AgendaEventoEntity e) {
        AgendaEventoResponse r = new AgendaEventoResponse();
        r.setId(e.getId());
        if (e.getUsuario() != null) {
            r.setUsuarioId(e.getUsuario().getId());
            r.setUsuarioNome(nomeExibicaoAgendaUsuario(e.getUsuario()));
        }
        r.setDataEvento(e.getDataEvento());
        r.setHoraEvento(Utf8MojibakeUtil.corrigir(e.getHoraEvento()));
        r.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao()));
        r.setStatusCurto(Utf8MojibakeUtil.corrigir(e.getStatusCurto() != null ? e.getStatusCurto() : ""));
        r.setProcessoRef(Utf8MojibakeUtil.corrigir(e.getProcessoRef()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        return r;
    }

    private AgendaEventoLinhaDto toLinha(AgendaEventoEntity e) {
        AgendaEventoLinhaDto x = new AgendaEventoLinhaDto();
        x.setId(String.valueOf(e.getId()));
        x.setHora(Utf8MojibakeUtil.corrigir(e.getHoraEvento() != null ? e.getHoraEvento() : ""));
        x.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao() != null ? e.getDescricao() : ""));
        x.setStatusCurto(Utf8MojibakeUtil.corrigir(e.getStatusCurto() != null ? e.getStatusCurto() : ""));
        x.setProcessoRef(Utf8MojibakeUtil.corrigir(e.getProcessoRef()));
        return x;
    }

    private AgendaEventoLinhaDto toLinhaComUsuario(AgendaEventoEntity e) {
        AgendaEventoLinhaDto x = toLinha(e);
        if (e.getUsuario() != null) {
            x.setUsuarioNome(nomeExibicaoAgendaUsuario(e.getUsuario()));
        }
        return x;
    }

    private static String formatarDataBr(LocalDate d) {
        return String.format("%02d/%02d/%d", d.getDayOfMonth(), d.getMonthValue(), d.getYear());
    }
}
