package br.com.vilareal.julia.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.julia.api.dto.JuliaCaixaCardResponse;
import br.com.vilareal.julia.api.dto.JuliaCaixaPatchRequest;
import br.com.vilareal.julia.domain.JuliaStatusCaixa;
import br.com.vilareal.julia.infrastructure.persistence.entity.JuliaTriagemEntity;
import br.com.vilareal.julia.infrastructure.persistence.repository.JuliaTriagemRepository;
import br.com.vilareal.julia.triagem.TriagemResultado;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class JuliaCaixaApplicationService {

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");

    private final JuliaTriagemRepository juliaTriagemRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final ObjectMapper objectMapper;

    public JuliaCaixaApplicationService(
            JuliaTriagemRepository juliaTriagemRepository,
            ProcessoApplicationService processoApplicationService,
            ObjectMapper objectMapper) {
        this.juliaTriagemRepository = juliaTriagemRepository;
        this.processoApplicationService = processoApplicationService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<JuliaCaixaCardResponse> listarCaixa(String status) {
        JuliaStatusCaixa filtro = JuliaStatusCaixa.parse(status != null ? status : "AGUARDANDO_VOCE");
        LocalDate hoje = LocalDate.now(ZONA_BR);
        List<JuliaTriagemEntity> entidades = juliaTriagemRepository.findForCaixa(filtro.name(), hoje);
        Set<Long> processoIds = entidades.stream()
                .map(JuliaTriagemEntity::getProcesso)
                .filter(Objects::nonNull)
                .map(ProcessoEntity::getId)
                .collect(Collectors.toSet());
        Map<Long, ProcessoPartesVinculoTexto> partesPorProcesso =
                processoApplicationService.resolverPartesAutoraOpostaEmLote(processoIds);
        return entidades.stream()
                .map(e -> toCard(e, partesPorProcesso))
                .toList();
    }

    @Transactional
    public JuliaCaixaCardResponse atualizarCaixa(Long triagemId, JuliaCaixaPatchRequest req) {
        if (req == null
                || (!StringUtils.hasText(req.statusCaixa())
                        && !StringUtils.hasText(req.categoria())
                        && req.postergarAte() == null)) {
            throw new BusinessRuleException("Informe ao menos um campo para atualizar.");
        }

        JuliaTriagemEntity entity = juliaTriagemRepository
                .findById(triagemId)
                .orElseThrow(() -> new ResourceNotFoundException("Triagem não encontrada: " + triagemId));

        if (req.categoria() != null) {
            entity.setCategoria(StringUtils.hasText(req.categoria()) ? req.categoria().trim() : null);
        }

        if (req.postergarAte() != null) {
            entity.setPostergarAte(req.postergarAte());
        }

        if (StringUtils.hasText(req.statusCaixa())) {
            JuliaStatusCaixa novoStatus = JuliaStatusCaixa.parse(req.statusCaixa());
            entity.setStatusCaixa(novoStatus.name());
            if (novoStatus != JuliaStatusCaixa.POSTERGADO) {
                entity.setPostergarAte(null);
            }
        }

        if (JuliaStatusCaixa.POSTERGADO.name().equals(entity.getStatusCaixa()) && entity.getPostergarAte() == null) {
            throw new BusinessRuleException("POSTERGADO exige postergarAte.");
        }

        JuliaTriagemEntity saved = juliaTriagemRepository.save(entity);
        Map<Long, ProcessoPartesVinculoTexto> partes = Map.of();
        if (saved.getProcesso() != null && saved.getProcesso().getId() != null) {
            partes = processoApplicationService.resolverPartesAutoraOpostaEmLote(Set.of(saved.getProcesso().getId()));
        }
        return toCard(saved, partes);
    }

    private JuliaCaixaCardResponse toCard(
            JuliaTriagemEntity entity, Map<Long, ProcessoPartesVinculoTexto> partesPorProcesso) {
        TriagemResultado payload = lerPayload(entity);
        ProcessoEntity processo = entity.getProcesso();
        PublicacaoEntity publicacao = entity.getPublicacao();

        Long publicacaoId = publicacao != null ? publicacao.getId() : null;
        Long processoId = processo != null ? processo.getId() : null;
        String numeroCnj = processo != null ? processo.getNumeroCnj() : null;
        if (!StringUtils.hasText(numeroCnj) && publicacao != null) {
            numeroCnj = publicacao.getNumeroProcessoEncontrado();
        }

        String parteAutora = null;
        String parteOposta = null;
        if (processoId != null && partesPorProcesso != null) {
            ProcessoPartesVinculoTexto pt = partesPorProcesso.get(processoId);
            if (pt != null) {
                parteAutora = trimToNull(pt.getParteCliente());
                parteOposta = trimToNull(pt.getParteOposta());
            }
        }

        LocalDate prazoDataFim = null;
        Boolean prazoVencido = null;
        if (payload != null && payload.prazo() != null && Boolean.TRUE.equals(payload.prazo().existe())) {
            prazoDataFim = payload.prazo().dataRealAsLocalDate();
            if (prazoDataFim != null) {
                prazoVencido = prazoDataFim.isBefore(LocalDate.now(ZONA_BR));
            }
        }

        return new JuliaCaixaCardResponse(
                entity.getId(),
                publicacaoId,
                processoId,
                numeroCnj,
                resolverNomeCliente(processo),
                parteAutora,
                parteOposta,
                entity.getClassificacao(),
                entity.getImpactoCliente(),
                entity.getPrioridade(),
                entity.getConfianca(),
                payload != null ? payload.resumo() : null,
                payload != null ? payload.providenciaCliente() : null,
                payload != null ? payload.acaoSugerida() : null,
                entity.getStatusCaixa(),
                entity.getCategoria(),
                entity.getPostergarAte(),
                entity.getCriadoEm(),
                prazoDataFim,
                prazoVencido);
    }

    private TriagemResultado lerPayload(JuliaTriagemEntity entity) {
        if (!StringUtils.hasText(entity.getPayloadJson())) {
            return null;
        }
        try {
            return objectMapper.readValue(entity.getPayloadJson(), TriagemResultado.class);
        } catch (Exception e) {
            throw new BusinessRuleException(
                    "Falha ao ler payload da triagem id=" + entity.getId() + ": " + e.getMessage());
        }
    }

    private static String resolverNomeCliente(ProcessoEntity processo) {
        if (processo == null) {
            return null;
        }
        ClienteEntity cliente = processo.getCliente();
        if (cliente != null) {
            if (StringUtils.hasText(cliente.getNomeReferencia())) {
                return cliente.getNomeReferencia().trim();
            }
            if (cliente.getPessoa() != null && StringUtils.hasText(cliente.getPessoa().getNome())) {
                return cliente.getPessoa().getNome().trim();
            }
        }
        if (processo.getPessoa() != null && StringUtils.hasText(processo.getPessoa().getNome())) {
            return processo.getPessoa().getNome().trim();
        }
        return null;
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        return s.trim();
    }
}
