package br.com.vilareal.publicacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.api.dto.*;
import br.com.vilareal.publicacao.infrastructure.persistence.PublicacaoSpecifications;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
public class PublicacaoApplicationService {

    private static final Set<String> STATUS_TRATAMENTO = Set.of("PENDENTE", "VINCULADA", "TRATADA", "IGNORADA");

    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;

    public PublicacaoApplicationService(
            PublicacaoRepository publicacaoRepository, ProcessoRepository processoRepository) {
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public List<PublicacaoResponse> listar(
            LocalDate dataInicio,
            LocalDate dataFim,
            String statusTratamento,
            Long processoId,
            Long clienteId,
            String texto,
            String origemImportacao) {
        var spec = PublicacaoSpecifications.comFiltros(
                dataInicio, dataFim, statusTratamento, processoId, clienteId, texto, origemImportacao);
        return publicacaoRepository
                .findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicacaoResponse buscar(Long id) {
        return toResponse(requirePublicacao(id));
    }

    @Transactional
    public PublicacaoResponse criar(PublicacaoWriteRequest req) {
        String teor = req.getTeor() != null ? req.getTeor() : "";
        String hashConteudo;
        if (StringUtils.hasText(req.getHashConteudo())) {
            hashConteudo = req.getHashConteudo().trim();
        } else {
            hashConteudo = PublicacaoHashing.sha256Hex(teor);
        }
        if (publicacaoRepository.existsByHashConteudo(hashConteudo)) {
            throw new BusinessRuleException("Publicação já existe (conteúdo duplicado).");
        }
        PublicacaoEntity e = new PublicacaoEntity();
        e.setNumeroProcessoEncontrado(
                StringUtils.hasText(req.getNumeroProcessoEncontrado()) ? req.getNumeroProcessoEncontrado().trim() : "");
        e.setDataDisponibilizacao(req.getDataDisponibilizacao());
        e.setDataPublicacao(req.getDataPublicacao());
        e.setFonte(trimToNull(req.getFonte()));
        e.setDiario(trimToNull(req.getDiario()));
        e.setTitulo(trimToNull(req.getTitulo()));
        e.setTipoPublicacao(trimToNull(req.getTipoPublicacao()));
        e.setResumo(trimToNull(req.getResumo()));
        e.setTeor(teor);
        e.setStatusValidacaoCnj(trimToNull(req.getStatusValidacaoCnj()));
        e.setScoreConfianca(trimToNull(req.getScoreConfianca()));
        e.setHashTeor(StringUtils.hasText(req.getHashTeor()) ? req.getHashTeor().trim() : "");
        e.setHashConteudo(hashConteudo);
        e.setOrigemImportacao(normalizarOrigem(req.getOrigemImportacao()));
        e.setArquivoOrigemNome(trimToNull(req.getArquivoOrigemNome()));
        e.setArquivoOrigemHash(trimToNull(req.getArquivoOrigemHash()));
        e.setJsonReferencia(trimToNull(req.getJsonReferencia()));
        e.setStatusTratamento(normalizarStatus(req.getStatusTratamento()));
        e.setLida(Boolean.TRUE.equals(req.getLida()));
        e.setObservacao(trimToNull(req.getObservacao()));
        return toResponse(publicacaoRepository.save(e));
    }

    @Transactional
    public PublicacaoResponse patchStatus(Long id, PublicacaoStatusPatchRequest req) {
        PublicacaoEntity e = requirePublicacao(id);
        String st = req.getStatus().trim().toUpperCase();
        if (!STATUS_TRATAMENTO.contains(st)) {
            throw new BusinessRuleException("status inválido: " + st);
        }
        e.setStatusTratamento(st);
        if (StringUtils.hasText(req.getObservacao())) {
            e.setObservacao(req.getObservacao().trim());
        }
        return toResponse(publicacaoRepository.save(e));
    }

    @Transactional
    public PublicacaoResponse patchVinculoProcesso(Long id, PublicacaoVinculoPatchRequest req) {
        PublicacaoEntity e = requirePublicacao(id);
        ProcessoEntity p = processoRepository
                .findById(req.getProcessoId())
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
        e.setProcesso(p);
        e.setClienteRefId(p.getPessoa().getId());
        e.setStatusTratamento("VINCULADA");
        if (StringUtils.hasText(req.getObservacao())) {
            e.setObservacao(req.getObservacao().trim());
        }
        return toResponse(publicacaoRepository.save(e));
    }

    @Transactional
    public void excluir(Long id) {
        if (!publicacaoRepository.existsById(id)) {
            throw new ResourceNotFoundException("Publicação não encontrada: " + id);
        }
        publicacaoRepository.deleteById(id);
    }

    private PublicacaoEntity requirePublicacao(Long id) {
        return publicacaoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Publicação não encontrada: " + id));
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        return s.trim();
    }

    private static String normalizarOrigem(String o) {
        if (!StringUtils.hasText(o)) {
            return "PDF";
        }
        String u = o.trim().toUpperCase();
        return switch (u) {
            case "MANUAL", "PDF", "DATAJUD", "MONITORAMENTO" -> u;
            default -> "PDF";
        };
    }

    private static String normalizarStatus(String s) {
        if (!StringUtils.hasText(s)) {
            return "PENDENTE";
        }
        String u = s.trim().toUpperCase();
        if (STATUS_TRATAMENTO.contains(u)) {
            return u;
        }
        return "PENDENTE";
    }

    private PublicacaoResponse toResponse(PublicacaoEntity e) {
        PublicacaoResponse r = new PublicacaoResponse();
        r.setId(e.getId());
        r.setCreatedAt(e.getCreatedAt());
        r.setNumeroProcessoEncontrado(e.getNumeroProcessoEncontrado());
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        r.setClienteId(e.getClienteRefId());
        r.setDataDisponibilizacao(e.getDataDisponibilizacao());
        r.setDataPublicacao(e.getDataPublicacao());
        r.setFonte(e.getFonte());
        r.setDiario(e.getDiario());
        r.setTitulo(e.getTitulo());
        r.setTipoPublicacao(e.getTipoPublicacao());
        r.setResumo(e.getResumo());
        r.setTeor(e.getTeor());
        r.setStatusValidacaoCnj(e.getStatusValidacaoCnj());
        r.setScoreConfianca(e.getScoreConfianca());
        r.setHashTeor(e.getHashTeor());
        r.setHashConteudo(e.getHashConteudo());
        r.setOrigemImportacao(e.getOrigemImportacao());
        r.setArquivoOrigemNome(e.getArquivoOrigemNome());
        r.setArquivoOrigemHash(e.getArquivoOrigemHash());
        r.setJsonReferencia(e.getJsonReferencia());
        r.setStatusTratamento(e.getStatusTratamento());
        r.setLida(e.isLida());
        r.setObservacao(e.getObservacao());
        return r;
    }
}
