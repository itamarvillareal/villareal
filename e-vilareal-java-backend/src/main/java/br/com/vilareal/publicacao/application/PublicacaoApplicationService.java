package br.com.vilareal.publicacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
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

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PublicacaoApplicationService {

    private static final Set<String> STATUS_TRATAMENTO = Set.of("PENDENTE", "VINCULADA", "TRATADA", "IGNORADA");

    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ProcessoApplicationService processoApplicationService;
    private final ClienteResolverService clienteResolverService;

    public PublicacaoApplicationService(
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            ProcessoApplicationService processoApplicationService,
            ClienteResolverService clienteResolverService) {
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.processoApplicationService = processoApplicationService;
        this.clienteResolverService = clienteResolverService;
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
        Long clientePk = null;
        if (clienteId != null && clienteId > 0) {
            clientePk = clienteResolverService.buscarPorId(clienteId).getId();
        }
        var spec = PublicacaoSpecifications.comFiltros(
                dataInicio, dataFim, statusTratamento, processoId, clientePk, texto, origemImportacao);
        List<PublicacaoEntity> lista = publicacaoRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
        Set<Long> procIds = new LinkedHashSet<>();
        for (PublicacaoEntity e : lista) {
            if (e.getProcesso() != null && e.getProcesso().getId() != null) {
                procIds.add(e.getProcesso().getId());
            }
        }
        Map<Long, ProcessoPartesVinculoTexto> partesPorProcesso =
                procIds.isEmpty() ? Map.of() : processoApplicationService.resolverTextosPartesVinculoEmLote(procIds);
        return lista.stream().map(e -> toResponse(e, partesPorProcesso)).toList();
    }

    @Transactional(readOnly = true)
    public PublicacaoResponse buscar(Long id) {
        return toResponse(requirePublicacao(id), null);
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
        String origem = normalizarOrigem(req.getOrigemImportacao());
        PublicacaoEntity e = new PublicacaoEntity();
        String numeroProcesso =
                StringUtils.hasText(req.getNumeroProcessoEncontrado()) ? req.getNumeroProcessoEncontrado().trim() : "";
        e.setNumeroProcessoEncontrado(numeroProcesso);
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
        e.setOrigemImportacao(origem);
        e.setArquivoOrigemNome(trimToNull(req.getArquivoOrigemNome()));
        e.setArquivoOrigemHash(trimToNull(req.getArquivoOrigemHash()));
        e.setEmailRecebidoEm(req.getEmailRecebidoEm());
        e.setJsonReferencia(trimToNull(req.getJsonReferencia()));
        e.setStatusTratamento(normalizarStatus(req.getStatusTratamento()));
        e.setLida(Boolean.TRUE.equals(req.getLida()));
        e.setObservacao(trimToNull(req.getObservacao()));
        return toResponse(publicacaoRepository.save(e), null);
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
        return toResponse(publicacaoRepository.save(e), null);
    }

    @Transactional
    public PublicacaoResponse patchVinculoProcesso(Long id, PublicacaoVinculoPatchRequest req) {
        PublicacaoEntity e = requirePublicacao(id);
        ProcessoEntity p = processoRepository
                .findById(req.getProcessoId())
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
        e.setProcesso(p);
        if (p.getCliente() != null) {
            e.setCliente(p.getCliente());
        } else {
            e.setCliente(clienteResolverService.resolverClienteParaTitular(p.getPessoa().getId()));
        }
        e.setStatusTratamento("VINCULADA");
        if (StringUtils.hasText(req.getObservacao())) {
            e.setObservacao(req.getObservacao().trim());
        }
        return toResponse(publicacaoRepository.save(e), null);
    }

    /**
     * Vincula a publicação ao processo cadastrado cujo {@code numero_cnj} coincide com
     * {@link PublicacaoEntity#getNumeroProcessoEncontrado()} (mesma normalização dos diagnósticos).
     */
    @Transactional
    public PublicacaoResponse patchVinculoPorCnj(Long id, String observacaoOpcional) {
        PublicacaoEntity e = requirePublicacao(id);
        String cnj = e.getNumeroProcessoEncontrado();
        if (!StringUtils.hasText(cnj)) {
            throw new BusinessRuleException("Publicação sem número de processo para vincular.");
        }
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.length() < 20) {
            throw new BusinessRuleException(
                    "CNJ da publicação incompleto para vínculo automático (mínimo 20 dígitos).");
        }
        List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.isEmpty()) {
            throw new BusinessRuleException(
                    "Nenhum processo cadastrado com o CNJ " + cnj.trim() + ". Cadastre o processo ou vincule manualmente.");
        }
        if (ids.size() > 1) {
            throw new BusinessRuleException(
                    "Mais de um processo cadastrado com o mesmo CNJ; use vínculo manual por código cliente e proc. interno.");
        }
        PublicacaoVinculoPatchRequest req = new PublicacaoVinculoPatchRequest();
        req.setProcessoId(ids.getFirst().longValue());
        req.setObservacao(observacaoOpcional);
        return patchVinculoProcesso(id, req);
    }

    /** Tenta vínculo por CNJ sem falhar o lote de importação (ex.: email Jusbrasil). */
    @Transactional
    public boolean tentarVinculoAutomaticoPorCnj(Long publicacaoId) {
        try {
            patchVinculoPorCnj(publicacaoId, "Vínculo automático por CNJ na importação.");
            return true;
        } catch (Exception ex) {
            return false;
        }
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

    private PublicacaoResponse toResponse(PublicacaoEntity e, Map<Long, ProcessoPartesVinculoTexto> partesPorProcessoIdOrNull) {
        PublicacaoResponse r = new PublicacaoResponse();
        r.setId(e.getId());
        r.setCreatedAt(e.getCreatedAt());
        r.setNumeroProcessoEncontrado(e.getNumeroProcessoEncontrado());
        ProcessoEntity proc = e.getProcesso();
        if (proc != null) {
            r.setProcessoId(proc.getId());
            r.setNumeroInternoProcesso(proc.getNumeroInterno());
            long pessoaId = proc.getPessoa().getId();
            r.setCodigoClienteProcesso(clienteCodigoPessoaResolver.codigoClienteExibicaoParaPessoaId(pessoaId));
            Map<Long, ProcessoPartesVinculoTexto> map =
                    partesPorProcessoIdOrNull != null
                            ? partesPorProcessoIdOrNull
                            : processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(proc.getId()));
            ProcessoPartesVinculoTexto pt = map.get(proc.getId());
            if (pt != null) {
                r.setParteCliente(trimToNull(pt.getParteCliente()));
                r.setParteOposta(trimToNull(pt.getParteOposta()));
            } else {
                r.setParteCliente(null);
                r.setParteOposta(null);
            }
        } else {
            r.setProcessoId(null);
            r.setNumeroInternoProcesso(null);
            r.setCodigoClienteProcesso(null);
            r.setParteCliente(null);
            r.setParteOposta(null);
        }
        if (e.getCliente() != null) {
            r.setClienteId(e.getCliente().getId());
        }
        if (proc != null && proc.getPessoa() != null) {
            r.setPessoaRefId(proc.getPessoa().getId());
        }
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
        r.setEmailRecebidoEm(e.getEmailRecebidoEm());
        r.setJsonReferencia(e.getJsonReferencia());
        r.setStatusTratamento(e.getStatusTratamento());
        r.setLida(e.isLida());
        r.setObservacao(e.getObservacao());
        return r;
    }
}
