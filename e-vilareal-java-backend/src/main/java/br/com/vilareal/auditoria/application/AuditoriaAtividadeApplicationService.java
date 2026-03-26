package br.com.vilareal.auditoria.application;

import br.com.vilareal.auditoria.api.dto.AuditoriaAtividadeResponse;
import br.com.vilareal.auditoria.api.dto.AuditoriaAtividadeWriteRequest;
import br.com.vilareal.auditoria.infrastructure.persistence.AuditoriaAtividadeSpecifications;
import br.com.vilareal.auditoria.infrastructure.persistence.entity.AuditoriaAtividadeEntity;
import br.com.vilareal.auditoria.infrastructure.persistence.repository.AuditoriaAtividadeRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Service
public class AuditoriaAtividadeApplicationService {

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter FMT_DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_HORA_BR = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final AuditoriaAtividadeRepository repository;

    public AuditoriaAtividadeApplicationService(AuditoriaAtividadeRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<AuditoriaAtividadeResponse> listar(
            java.time.LocalDate dataInicio,
            java.time.LocalDate dataFim,
            String usuarioId,
            String modulo,
            String tipoAcao,
            String registroAfetadoId,
            String q,
            Pageable pageable) {
        Specification<AuditoriaAtividadeEntity> spec =
                AuditoriaAtividadeSpecifications.comFiltros(dataInicio, dataFim, usuarioId, modulo, tipoAcao, registroAfetadoId, q);
        return repository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional
    public AuditoriaAtividadeResponse registrar(
            AuditoriaAtividadeWriteRequest request,
            String headerUsuarioId,
            String headerUsuarioNomeB64,
            String ipOrigem) {
        String usuarioRef = firstNonBlank(request.getUsuarioId(), headerUsuarioId, "desconhecido");
        String usuarioNome =
                firstNonBlank(request.getUsuarioNome(), decodeNomeB64(headerUsuarioNomeB64), "Desconhecido");

        AuditoriaAtividadeEntity e = new AuditoriaAtividadeEntity();
        e.setOcorridoEm(Instant.now());
        e.setUsuarioRef(trimToNull(usuarioRef));
        e.setUsuarioNome(trimToNull(usuarioNome));
        e.setModulo(request.getModulo().trim());
        e.setTela(request.getTela().trim());
        e.setTipoAcao(request.getTipoAcao().trim());
        e.setDescricao(request.getDescricao().trim());
        e.setRegistroAfetadoId(trimToNull(request.getRegistroAfetadoId()));
        e.setRegistroAfetadoNome(trimToNull(request.getRegistroAfetadoNome()));
        e.setObservacoesTecnicas(trimToNull(request.getObservacoesTecnicas()));
        e.setIpOrigem(trimToNull(ipOrigem));

        return toResponse(repository.save(e));
    }

    private static String firstNonBlank(String a, String b, String fallback) {
        if (a != null && !a.isBlank()) {
            return a.trim();
        }
        if (b != null && !b.isBlank()) {
            return b.trim();
        }
        return fallback;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String decodeNomeB64(String b64) {
        if (b64 == null || b64.isBlank()) {
            return null;
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(b64.trim());
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private AuditoriaAtividadeResponse toResponse(AuditoriaAtividadeEntity e) {
        Instant when = e.getOcorridoEm();
        var z = when.atZone(ZONA_BR);
        return AuditoriaAtividadeResponse.builder()
                .id(e.getId())
                .ocorridoEm(when.toString())
                .dataBr(z.format(FMT_DATA_BR))
                .horaBr(z.format(FMT_HORA_BR))
                .usuarioId(e.getUsuarioRef())
                .usuarioNome(e.getUsuarioNome())
                .modulo(e.getModulo())
                .tela(e.getTela())
                .tipoAcao(e.getTipoAcao())
                .descricao(e.getDescricao())
                .registroAfetadoId(e.getRegistroAfetadoId())
                .registroAfetadoNome(e.getRegistroAfetadoNome())
                .ipOrigem(e.getIpOrigem())
                .observacoesTecnicas(e.getObservacoesTecnicas())
                .build();
    }
}
