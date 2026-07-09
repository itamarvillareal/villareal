package br.com.vilareal.agenda.application;

import br.com.vilareal.agenda.api.dto.AgendaLoteDetalheResponse;
import br.com.vilareal.agenda.api.dto.AgendaLoteEventoDto;
import br.com.vilareal.agenda.api.dto.AgendaLoteLinhaDto;
import br.com.vilareal.agenda.api.dto.AgendaLoteResumoResponse;
import br.com.vilareal.agenda.infrastructure.persistence.entity.AgendaEventoEntity;
import br.com.vilareal.agenda.infrastructure.persistence.repository.AgendaEventoRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

@Service
public class AgendaLoteService {

    public static final String ORIGEM_LOTE_PREFIX = "agenda-lote:";

    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final String SUFIXO_ULTIMO = "Último agendamento";

    private final AgendaEventoRepository agendaEventoRepository;

    public AgendaLoteService(AgendaEventoRepository agendaEventoRepository) {
        this.agendaEventoRepository = agendaEventoRepository;
    }

    public static String montarOrigemLote(String loteRef) {
        String id = loteRef == null ? "" : loteRef.trim();
        if (!StringUtils.hasText(id)) {
            throw new BusinessRuleException("loteRef é obrigatório.");
        }
        return ORIGEM_LOTE_PREFIX + id;
    }

    public static String extrairLoteRef(String origem) {
        if (!StringUtils.hasText(origem) || !origem.startsWith(ORIGEM_LOTE_PREFIX)) {
            return "";
        }
        return origem.substring(ORIGEM_LOTE_PREFIX.length()).trim();
    }

    @Transactional(readOnly = true)
    public List<AgendaLoteResumoResponse> listarResumos() {
        List<String> origens = agendaEventoRepository.findDistinctOrigensStartingWith(ORIGEM_LOTE_PREFIX);
        List<AgendaLoteResumoResponse> out = new ArrayList<>();
        for (String origem : origens) {
            String loteRef = extrairLoteRef(origem);
            if (!StringUtils.hasText(loteRef)) {
                continue;
            }
            List<AgendaEventoEntity> eventos = agendaEventoRepository.findByOrigem(origem);
            if (eventos.isEmpty()) {
                continue;
            }
            out.add(resumoFromEventos(loteRef, eventos));
        }
        out.sort(Comparator.comparing(AgendaLoteResumoResponse::getUltimaData, Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    @Transactional(readOnly = true)
    public AgendaLoteDetalheResponse obterDetalhe(String loteRef) {
        String ref = loteRef == null ? "" : loteRef.trim();
        if (!StringUtils.hasText(ref)) {
            throw new BusinessRuleException("loteRef é obrigatório.");
        }
        String origem = montarOrigemLote(ref);
        List<AgendaEventoEntity> eventos = agendaEventoRepository.findByOrigem(origem);
        if (eventos.isEmpty()) {
            throw new ResourceNotFoundException("Lote de agenda não encontrado: " + ref);
        }
        return detalheFromEventos(ref, eventos);
    }

    @Transactional
    public int excluirLote(String loteRef) {
        String ref = loteRef == null ? "" : loteRef.trim();
        if (!StringUtils.hasText(ref)) {
            throw new BusinessRuleException("loteRef é obrigatório.");
        }
        return agendaEventoRepository.deleteByOrigemAndDataEventoGreaterThanEqual(
                montarOrigemLote(ref),
                LocalDate.now());
    }

    private AgendaLoteResumoResponse resumoFromEventos(String loteRef, List<AgendaEventoEntity> eventos) {
        AgendaLoteResumoResponse r = new AgendaLoteResumoResponse();
        r.setLoteRef(loteRef);
        r.setQtdEventos(eventos.size());
        Set<Long> usuarios = new LinkedHashSet<>();
        LocalDate min = null;
        LocalDate max = null;
        Map<LocalDate, AgendaLoteLinhaDto> linhas = new TreeMap<>();
        for (AgendaEventoEntity e : eventos) {
            if (e.getUsuario() != null && e.getUsuario().getId() != null) {
                usuarios.add(e.getUsuario().getId());
            }
            LocalDate d = e.getDataEvento();
            if (d != null) {
                min = min == null || d.isBefore(min) ? d : min;
                max = max == null || d.isAfter(max) ? d : max;
                linhas.putIfAbsent(d, linhaFromEntity(e));
            }
        }
        r.setUsuarioIds(new ArrayList<>(usuarios));
        r.setPrimeiraData(min);
        r.setUltimaData(max);
        r.setQtdLinhas(linhas.size());
        r.setTextoBase(textoBaseFromLinhas(new ArrayList<>(linhas.values())));
        return r;
    }

    private AgendaLoteDetalheResponse detalheFromEventos(String loteRef, List<AgendaEventoEntity> eventos) {
        AgendaLoteDetalheResponse d = new AgendaLoteDetalheResponse();
        d.setLoteRef(loteRef);
        Map<LocalDate, AgendaLoteLinhaDto> linhasMap = new TreeMap<>();
        Set<Long> usuarios = new LinkedHashSet<>();
        String processoRef = null;
        String horaPadrao = "";
        List<AgendaLoteEventoDto> eventosDto = new ArrayList<>();
        for (AgendaEventoEntity e : eventos) {
            if (e.getUsuario() != null && e.getUsuario().getId() != null) {
                usuarios.add(e.getUsuario().getId());
            }
            if (!StringUtils.hasText(processoRef) && StringUtils.hasText(e.getProcessoRef())) {
                processoRef = e.getProcessoRef();
            }
            LocalDate data = e.getDataEvento();
            if (data != null) {
                linhasMap.putIfAbsent(data, linhaFromEntity(e));
            }
            String hora = e.getHoraEvento() == null ? "" : e.getHoraEvento().trim();
            if (!StringUtils.hasText(horaPadrao) && StringUtils.hasText(hora)) {
                horaPadrao = hora.length() > 5 ? hora.substring(0, 5) : hora;
            }
            AgendaLoteEventoDto ev = new AgendaLoteEventoDto();
            ev.setId(e.getId());
            ev.setUsuarioId(e.getUsuario() != null ? e.getUsuario().getId() : null);
            ev.setDataBr(data != null ? data.format(BR) : "");
            ev.setHora(hora.length() > 5 ? hora.substring(0, 5) : hora);
            ev.setDescricao(e.getDescricao());
            eventosDto.add(ev);
        }
        d.setProcessoRef(processoRef);
        d.setUsuarioIds(new ArrayList<>(usuarios));
        List<AgendaLoteLinhaDto> linhas = new ArrayList<>(linhasMap.values());
        d.setLinhas(linhas);
        d.setTextoBase(textoBaseFromLinhas(linhas));
        d.setHoraPadrao(horaPadrao);
        d.setEventos(eventosDto);
        return d;
    }

    private static AgendaLoteLinhaDto linhaFromEntity(AgendaEventoEntity e) {
        AgendaLoteLinhaDto l = new AgendaLoteLinhaDto();
        l.setDataBr(e.getDataEvento() != null ? e.getDataEvento().format(BR) : "");
        String hora = e.getHoraEvento() == null ? "" : e.getHoraEvento().trim();
        l.setHora(hora.length() > 5 ? hora.substring(0, 5) : hora);
        l.setInformacao(e.getDescricao() == null ? "" : e.getDescricao());
        return l;
    }

    private static String textoBaseFromLinhas(List<AgendaLoteLinhaDto> linhas) {
        for (AgendaLoteLinhaDto l : linhas) {
            String t = removerSufixoUltimo(l.getInformacao());
            if (StringUtils.hasText(t)) {
                return t;
            }
        }
        return "";
    }

    private static String removerSufixoUltimo(String informacao) {
        if (!StringUtils.hasText(informacao)) {
            return "";
        }
        String t = informacao.trim();
        String sufixo = " — " + SUFIXO_ULTIMO;
        if (t.endsWith(sufixo)) {
            return t.substring(0, t.length() - sufixo.length()).trim();
        }
        if (SUFIXO_ULTIMO.equals(t)) {
            return "";
        }
        return t;
    }
}
