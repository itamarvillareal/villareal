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
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;

@Service
public class JuliaCaixaApplicationService {

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");

    private final JuliaTriagemRepository juliaTriagemRepository;
    private final ObjectMapper objectMapper;

    public JuliaCaixaApplicationService(JuliaTriagemRepository juliaTriagemRepository, ObjectMapper objectMapper) {
        this.juliaTriagemRepository = juliaTriagemRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<JuliaCaixaCardResponse> listarCaixa(String status) {
        JuliaStatusCaixa filtro = JuliaStatusCaixa.parse(status != null ? status : "AGUARDANDO_VOCE");
        LocalDate hoje = LocalDate.now(ZONA_BR);
        return juliaTriagemRepository.findForCaixa(filtro.name(), hoje).stream()
                .map(this::toCard)
                .sorted(ordenacaoCaixa())
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

        return toCard(juliaTriagemRepository.save(entity));
    }

    private JuliaCaixaCardResponse toCard(JuliaTriagemEntity entity) {
        TriagemResultado payload = lerPayload(entity);
        ProcessoEntity processo = entity.getProcesso();
        PublicacaoEntity publicacao = entity.getPublicacao();

        Long publicacaoId = publicacao != null ? publicacao.getId() : null;
        Long processoId = processo != null ? processo.getId() : null;
        String numeroCnj = processo != null ? processo.getNumeroCnj() : null;
        if (!StringUtils.hasText(numeroCnj) && publicacao != null) {
            numeroCnj = publicacao.getNumeroProcessoEncontrado();
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

    private static Comparator<JuliaCaixaCardResponse> ordenacaoCaixa() {
        return Comparator.<JuliaCaixaCardResponse>comparingInt(c -> rankPrioridade(c.prioridade()))
                .reversed()
                .thenComparing(c -> c.prazoDataFim() == null ? LocalDate.MAX : c.prazoDataFim())
                .thenComparing(JuliaCaixaCardResponse::criadoEm, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    private static int rankPrioridade(String prioridade) {
        if (!StringUtils.hasText(prioridade)) {
            return 0;
        }
        return switch (prioridade.trim().toUpperCase()) {
            case "URGENTE" -> 4;
            case "ALTA" -> 3;
            case "MEDIA", "MÉDIA" -> 2;
            case "BAIXA" -> 1;
            default -> 0;
        };
    }
}
