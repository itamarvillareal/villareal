package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.context.UsuarioContext;
import br.com.vilareal.api.dto.AuditoriaAtividadeRequest;
import br.com.vilareal.api.dto.AuditoriaAtividadeResponse;
import br.com.vilareal.api.entity.AuditoriaAtividade;
import br.com.vilareal.api.repository.AuditoriaAtividadeRepository;
import br.com.vilareal.api.repository.spec.AuditoriaAtividadeSpecs;
import br.com.vilareal.api.service.AuditoriaAtividadeService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

@Service
public class AuditoriaAtividadeServiceImpl implements AuditoriaAtividadeService {

    private static final ZoneId TZ_BR = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter FMT_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_HORA = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final AuditoriaAtividadeRepository repository;

    public AuditoriaAtividadeServiceImpl(AuditoriaAtividadeRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public AuditoriaAtividadeResponse registrar(AuditoriaAtividadeRequest request) {
        String uid = primeiroNaoVazio(UsuarioContext.getUsuarioId(), request.getUsuarioId(), "desconhecido");
        String unome = primeiroNaoVazio(UsuarioContext.getUsuarioNome(), request.getUsuarioNome(), "Não identificado");
        String ip = UsuarioContext.getIpOrigem();

        AuditoriaAtividade e = new AuditoriaAtividade();
        e.setUsuarioId(uid);
        e.setUsuarioNome(unome);
        e.setOcorridoEm(Instant.now());
        e.setModulo(request.getModulo().trim());
        e.setTela(trimToNull(request.getTela()));
        e.setTipoAcao(request.getTipoAcao().trim());
        e.setDescricao(request.getDescricao().trim());
        e.setRegistroAfetadoId(trimToNull(request.getRegistroAfetadoId()));
        e.setRegistroAfetadoNome(trimToNull(request.getRegistroAfetadoNome()));
        e.setIpOrigem(trimToNull(ip));
        e.setObservacoesTecnicas(trimToNull(request.getObservacoesTecnicas()));
        e = repository.save(e);
        return toResponse(e);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarInterno(String tipoAcao, String modulo, String tela, String descricao,
                                 String registroAfetadoId, String registroAfetadoNome, String observacoesTecnicas) {
        String uid = primeiroNaoVazio(UsuarioContext.getUsuarioId(), "desconhecido");
        String unome = primeiroNaoVazio(UsuarioContext.getUsuarioNome(), "Não identificado");
        AuditoriaAtividade e = new AuditoriaAtividade();
        e.setUsuarioId(uid);
        e.setUsuarioNome(unome);
        e.setOcorridoEm(Instant.now());
        e.setModulo(modulo);
        e.setTela(trimToNull(tela));
        e.setTipoAcao(tipoAcao);
        e.setDescricao(descricao);
        e.setRegistroAfetadoId(trimToNull(registroAfetadoId));
        e.setRegistroAfetadoNome(trimToNull(registroAfetadoNome));
        e.setIpOrigem(trimToNull(UsuarioContext.getIpOrigem()));
        e.setObservacoesTecnicas(trimToNull(observacoesTecnicas));
        repository.save(e);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditoriaAtividadeResponse> buscar(
            LocalDate dataInicio,
            LocalDate dataFim,
            String usuarioId,
            String modulo,
            String tipoAcao,
            String registroAfetadoId,
            String textoLivre,
            Pageable pageable) {
        Instant inicio = null;
        Instant fimExclusivo = null;
        if (dataInicio != null) {
            inicio = dataInicio.atStartOfDay(TZ_BR).toInstant();
        }
        if (dataFim != null) {
            fimExclusivo = dataFim.plusDays(1).atStartOfDay(TZ_BR).toInstant();
        }
        Specification<AuditoriaAtividade> spec = AuditoriaAtividadeSpecs.comFiltros(
                inicio, fimExclusivo, usuarioId, modulo, tipoAcao, registroAfetadoId, textoLivre);
        return repository.findAll(spec, pageable).map(this::toResponse);
    }

    private static String primeiroNaoVazio(String... vals) {
        if (vals == null) return "";
        for (String v : vals) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return "";
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private AuditoriaAtividadeResponse toResponse(AuditoriaAtividade e) {
        AuditoriaAtividadeResponse r = new AuditoriaAtividadeResponse();
        r.setId(e.getId());
        r.setUsuarioId(e.getUsuarioId());
        r.setUsuarioNome(e.getUsuarioNome());
        r.setOcorridoEm(e.getOcorridoEm());
        var z = Objects.requireNonNull(e.getOcorridoEm()).atZone(TZ_BR);
        r.setDataBr(z.format(FMT_DATA));
        r.setHoraBr(z.format(FMT_HORA));
        r.setModulo(e.getModulo());
        r.setTela(e.getTela());
        r.setTipoAcao(e.getTipoAcao());
        r.setDescricao(e.getDescricao());
        r.setRegistroAfetadoId(e.getRegistroAfetadoId());
        r.setRegistroAfetadoNome(e.getRegistroAfetadoNome());
        r.setIpOrigem(e.getIpOrigem());
        r.setObservacoesTecnicas(e.getObservacoesTecnicas());
        return r;
    }
}
