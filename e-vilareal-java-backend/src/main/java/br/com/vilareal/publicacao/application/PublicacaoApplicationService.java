package br.com.vilareal.publicacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.api.dto.*;
import br.com.vilareal.publicacao.application.event.PublicacaoVinculadaEvent;
import br.com.vilareal.publicacao.infrastructure.persistence.PublicacaoSpecifications;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PublicacaoApplicationService {

    private static final Set<String> STATUS_TRATAMENTO = Set.of("PENDENTE", "VINCULADA", "TRATADA", "IGNORADA");
    private static final Set<String> ORIGENS_MOVIMENTACAO_EMAIL = Set.of("PROJUDI", "TRT");

    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ProcessoApplicationService processoApplicationService;
    private final ClienteResolverService clienteResolverService;
    private final ApplicationEventPublisher applicationEventPublisher;

    public PublicacaoApplicationService(
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            ProcessoApplicationService processoApplicationService,
            ClienteResolverService clienteResolverService,
            ApplicationEventPublisher applicationEventPublisher) {
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.processoApplicationService = processoApplicationService;
        this.clienteResolverService = clienteResolverService;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Transactional(readOnly = true)
    public List<PublicacaoResponse> listar(
            LocalDate dataInicio,
            LocalDate dataFim,
            LocalDate recebimentoInicio,
            LocalDate recebimentoFim,
            String statusTratamento,
            Long processoId,
            Long clienteId,
            String texto,
            String origemImportacao) {
        Long clientePk = null;
        if (clienteId != null && clienteId > 0) {
            clientePk = clienteResolverService.buscarPorId(clienteId).getId();
        }
        boolean movimentacaoEmail = isOrigemMovimentacaoEmail(origemImportacao);
        var spec = PublicacaoSpecifications.comFiltros(
                dataInicio,
                dataFim,
                recebimentoInicio,
                recebimentoFim,
                statusTratamento,
                processoId,
                clientePk,
                texto,
                origemImportacao,
                movimentacaoEmail);
        // Ordenação por emailRecebidoEm em memória: Hibernate Criteria não suporta nullsLast no Sort.
        List<PublicacaoEntity> lista = publicacaoRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
        lista.sort(
                Comparator.comparing(
                                PublicacaoEntity::getGmailCaixaOrdem,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(
                                PublicacaoEntity::getEmailRecebidoEm,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(
                                PublicacaoApplicationService::extrairGmailMessageId,
                                Comparator.reverseOrder())
                        .thenComparing(
                                PublicacaoEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        Set<Long> procIds = new LinkedHashSet<>();
        for (PublicacaoEntity e : lista) {
            Long pid = extrairProcessoIdSeguro(e);
            if (pid != null) {
                procIds.add(pid);
            }
        }
        Map<Long, ProcessoEntity> processosPorId =
                processoRepository.findAllById(procIds).stream()
                        .collect(Collectors.toMap(ProcessoEntity::getId, Function.identity(), (a, b) -> a));
        Map<Long, ProcessoPartesVinculoTexto> partesPorProcesso =
                procIds.isEmpty() ? Map.of() : processoApplicationService.resolverTextosPartesVinculoEmLote(procIds);
        return lista.stream()
                .map(e -> {
                    Long pid = extrairProcessoIdSeguro(e);
                    ProcessoEntity proc = pid != null ? processosPorId.get(pid) : null;
                    return toResponse(e, proc, partesPorProcesso);
                })
                .toList();
    }

    /**
     * FK {@code processo_id} pode apontar para processo já removido; o proxy Hibernate lança
     * {@link EntityNotFoundException} ao acessar o id — tratar como sem vínculo na listagem.
     */
    private static Long extrairProcessoIdSeguro(PublicacaoEntity e) {
        ProcessoEntity ref = e.getProcesso();
        if (ref == null) {
            return null;
        }
        try {
            return ref.getId();
        } catch (EntityNotFoundException ex) {
            return null;
        }
    }

    static String extrairGmailMessageId(PublicacaoEntity e) {
        if (e == null) {
            return "";
        }
        String nome = e.getArquivoOrigemNome();
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        int abre = nome.lastIndexOf('[');
        int fecha = nome.lastIndexOf(']');
        if (abre < 0 || fecha <= abre) {
            return "";
        }
        return nome.substring(abre + 1, fecha).trim().toLowerCase();
    }

    private static boolean isOrigemMovimentacaoEmail(String origemImportacao) {
        if (!StringUtils.hasText(origemImportacao)) {
            return false;
        }
        return ORIGENS_MOVIMENTACAO_EMAIL.contains(origemImportacao.trim().toUpperCase(Locale.ROOT));
    }

    /** Entrada exibida: horário do email (cabeçalho Date/internalDate); sem ele, a importação. */
    static Instant entradaEmailExibicao(PublicacaoEntity e) {
        if (e == null) {
            return null;
        }
        Instant recebido = e.getEmailRecebidoEm();
        return recebido != null ? recebido : e.getCreatedAt();
    }

    private ProcessoEntity carregarProcessoParaPublicacao(PublicacaoEntity e) {
        Long pid = extrairProcessoIdSeguro(e);
        if (pid == null) {
            return null;
        }
        return processoRepository.findById(pid).orElse(null);
    }

    @Transactional(readOnly = true)
    public PublicacaoResponse buscar(Long id) {
        PublicacaoEntity e = requirePublicacao(id);
        return toResponse(e, carregarProcessoParaPublicacao(e), null);
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
        e.setTitulo(capLen(trimToNull(req.getTitulo()), 255));
        e.setTipoPublicacao(capLen(trimToNull(req.getTipoPublicacao()), 80));
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
        e.setGmailCaixaOrdem(req.getGmailCaixaOrdem());
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
        e = publicacaoRepository.save(e);
        applicationEventPublisher.publishEvent(new PublicacaoVinculadaEvent(e.getId(), p.getId()));
        return toResponse(e, null);
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
        List<BigInteger> ids = buscarIdsProcessoPorNumeroPublicacao(cnj);
        if (ids.isEmpty()) {
            throw new BusinessRuleException(
                    "Nenhum processo cadastrado com o número "
                            + cnj.trim()
                            + ". Cadastre o processo ou vincule manualmente.");
        }
        if (ids.size() > 1) {
            throw new BusinessRuleException(
                    "Mais de um processo cadastrado com número semelhante; use vínculo manual por código cliente e proc. interno.");
        }
        PublicacaoVinculoPatchRequest req = new PublicacaoVinculoPatchRequest();
        req.setProcessoId(ids.getFirst().longValue());
        req.setObservacao(observacaoOpcional);
        return patchVinculoProcesso(id, req);
    }

    /** Tenta vínculo por CNJ sem falhar o lote de importação (ex.: email Jusbrasil). */
    @Transactional
    public boolean tentarVinculoAutomaticoPorCnj(Long publicacaoId) {
        return tentarVinculoAutomaticoPorCnjDevolvendoProcessoId(publicacaoId).isPresent();
    }

    /**
     * Vínculo automático por CNJ; retorna o {@code processo.id} quando o vínculo foi aplicado.
     */
    @Transactional
    public Optional<Long> tentarVinculoAutomaticoPorCnjDevolvendoProcessoId(Long publicacaoId) {
        try {
            PublicacaoEntity pub = requirePublicacao(publicacaoId);
            String cnj = pub.getNumeroProcessoEncontrado();
            if (!StringUtils.hasText(cnj)) {
                return Optional.empty();
            }
            List<BigInteger> ids = buscarIdsProcessoPorNumeroPublicacao(cnj);
            Optional<Long> processoIdOpt = escolherProcessoParaVinculoAutomaticoPorCnj(pub, ids);
            if (processoIdOpt.isEmpty()) {
                return Optional.empty();
            }
            long processoId = processoIdOpt.get();
            ProcessoEntity proc = processoRepository
                    .findById(processoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
            proc.getPessoa().getNome();
            String observacao = montarObservacaoVinculoAutomaticoPorCnj(pub, proc);
            PublicacaoVinculoPatchRequest req = new PublicacaoVinculoPatchRequest();
            req.setProcessoId(processoId);
            req.setObservacao(observacao);
            patchVinculoProcesso(publicacaoId, req);
            return Optional.of(processoId);
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private List<BigInteger> buscarIdsProcessoPorNumeroPublicacao(String numeroBruto) {
        return ProcessoDiagnosticoNumeroBuscaUtil.buscarIdsProcessoPorNumero(numeroBruto, processoRepository);
    }

    /**
     * Um CNJ pode existir em cadastros duplicados (legado). Preferimos o processo cujo texto da publicação
     * bate com titular/partes e, em empate, o que tem cliente contratante distinto do titular.
     */
    private Optional<Long> escolherProcessoParaVinculoAutomaticoPorCnj(PublicacaoEntity pub, List<BigInteger> ids) {
        if (ids == null || ids.isEmpty()) {
            return Optional.empty();
        }
        if (ids.size() == 1) {
            return Optional.of(ids.getFirst().longValue());
        }
        int melhorPontuacao = Integer.MIN_VALUE;
        Long melhorId = null;
        int empates = 0;
        for (BigInteger idBi : ids) {
            long id = idBi.longValue();
            Optional<ProcessoEntity> procOpt = processoRepository.findById(id);
            if (procOpt.isEmpty()) {
                continue;
            }
            int pontuacao = pontuacaoProcessoParaVinculoAutomaticoPorCnj(pub, procOpt.get());
            if (pontuacao > melhorPontuacao) {
                melhorPontuacao = pontuacao;
                melhorId = id;
                empates = 1;
            } else if (pontuacao == melhorPontuacao && pontuacao > 0) {
                empates++;
            }
        }
        if (melhorId != null && empates == 1 && melhorPontuacao > 0) {
            return Optional.of(melhorId);
        }
        return Optional.empty();
    }

    private int pontuacaoProcessoParaVinculoAutomaticoPorCnj(PublicacaoEntity pub, ProcessoEntity proc) {
        int score = 0;
        if (textoPublicacaoContemNomeTitularOuParte(pub, proc)) {
            score += 10;
        }
        if (proc.getCliente() != null) {
            score += 2;
            if (proc.getPessoa() != null
                    && proc.getCliente().getPessoa() != null
                    && proc.getCliente().getPessoa().getId() != proc.getPessoa().getId()) {
                score += 5;
            }
        }
        return score;
    }

    private String montarObservacaoVinculoAutomaticoPorCnj(PublicacaoEntity pub, ProcessoEntity proc) {
        String base = "Vínculo automático por CNJ na importação.";
        if (textoPublicacaoContemNomeTitularOuParte(pub, proc)) {
            return base;
        }
        String titular = Utf8MojibakeUtil.corrigir(proc.getPessoa().getNome());
        return base
                + " ATENÇÃO: titular do processo ("
                + titular
                + ") e partes cadastradas não encontrados no texto da publicação. Conferir.";
    }

    private boolean textoPublicacaoContemNomeTitularOuParte(PublicacaoEntity pub, ProcessoEntity proc) {
        String texto = montarTextoBuscaNomesPublicacao(pub);
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String up = texto.toUpperCase(Locale.ROOT);
        String titular = Utf8MojibakeUtil.corrigir(proc.getPessoa().getNome());
        if (fragmentoNomeEncontradoNoTexto(up, titular)) {
            return true;
        }
        for (ProcessoParteEntity parte : processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(proc.getId())) {
            String nome = null;
            if (parte.getPessoa() != null && StringUtils.hasText(parte.getPessoa().getNome())) {
                nome = Utf8MojibakeUtil.corrigir(parte.getPessoa().getNome());
            } else if (StringUtils.hasText(parte.getNomeLivre())) {
                nome = Utf8MojibakeUtil.corrigir(parte.getNomeLivre());
            }
            if (fragmentoNomeEncontradoNoTexto(up, nome)) {
                return true;
            }
        }
        return false;
    }

    private static String montarTextoBuscaNomesPublicacao(PublicacaoEntity pub) {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(pub.getTitulo())) {
            sb.append(pub.getTitulo().trim()).append(' ');
        }
        if (StringUtils.hasText(pub.getResumo())) {
            sb.append(pub.getResumo().trim()).append(' ');
        }
        if (StringUtils.hasText(pub.getTeor())) {
            sb.append(pub.getTeor().trim());
        }
        return sb.toString().trim();
    }

    /** Fragmento inicial do nome (mín. 4, máx. 15 caracteres) para busca tolerante no texto. */
    private static boolean fragmentoNomeEncontradoNoTexto(String textoUpper, String nome) {
        if (!StringUtils.hasText(nome) || !StringUtils.hasText(textoUpper)) {
            return false;
        }
        String n = nome.trim().toUpperCase(Locale.ROOT);
        if (n.length() < 4) {
            return false;
        }
        int len = Math.min(15, n.length());
        return textoUpper.contains(n.substring(0, len));
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

    /** Limita o tamanho ao da coluna, evitando "Data too long" (perda da publicação inteira). */
    private static String capLen(String s, int max) {
        if (s == null || s.length() <= max) {
            return s;
        }
        return s.substring(0, max);
    }

    private static String normalizarOrigem(String o) {
        if (!StringUtils.hasText(o)) {
            return "PDF";
        }
        String u = o.trim().toUpperCase();
        return switch (u) {
            case "MANUAL", "PDF", "DATAJUD", "MONITORAMENTO", "PROJUDI", "TRT" -> u;
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

    private PublicacaoResponse toResponse(
            PublicacaoEntity e, Map<Long, ProcessoPartesVinculoTexto> partesPorProcessoIdOrNull) {
        return toResponse(e, carregarProcessoParaPublicacao(e), partesPorProcessoIdOrNull);
    }

    private PublicacaoResponse toResponse(
            PublicacaoEntity e,
            ProcessoEntity proc,
            Map<Long, ProcessoPartesVinculoTexto> partesPorProcessoIdOrNull) {
        PublicacaoResponse r = new PublicacaoResponse();
        r.setId(e.getId());
        r.setCreatedAt(e.getCreatedAt());
        r.setNumeroProcessoEncontrado(e.getNumeroProcessoEncontrado());
        if (proc != null) {
            r.setProcessoId(proc.getId());
            r.setNumeroInternoProcesso(proc.getNumeroInterno());
            r.setCodigoClienteProcesso(trimToNull(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(proc)));
            if (proc.getPessoa() != null) {
                long pessoaId = proc.getPessoa().getId();
                String titularNome = Utf8MojibakeUtil.corrigir(proc.getPessoa().getNome());
                r.setTitularNome(trimToNull(titularNome));
                r.setPessoaRefId(pessoaId);
            } else {
                r.setTitularNome(null);
            }
            r.setPapelCliente(trimToNull(proc.getPapelCliente()));
            Map<Long, ProcessoPartesVinculoTexto> map =
                    partesPorProcessoIdOrNull != null
                            ? partesPorProcessoIdOrNull
                            : processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(proc.getId()));
            ProcessoPartesVinculoTexto pt = map.get(proc.getId());
            if (pt != null) {
                r.setParteCliente(trimToNull(pt.getParteCliente()));
                r.setParteOposta(trimToNull(pt.getParteOposta()));
            }
        } else {
            r.setProcessoId(null);
            r.setNumeroInternoProcesso(null);
            r.setCodigoClienteProcesso(null);
            r.setTitularNome(null);
            r.setParteCliente(null);
            r.setParteOposta(null);
        }
        if (e.getCliente() != null) {
            r.setClienteId(e.getCliente().getId());
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
        r.setEmailRecebidoEm(entradaEmailExibicao(e));
        r.setGmailCaixaOrdem(e.getGmailCaixaOrdem());
        r.setJsonReferencia(e.getJsonReferencia());
        r.setStatusTratamento(e.getStatusTratamento());
        r.setLida(e.isLida());
        r.setObservacao(e.getObservacao());
        r.setAndamentosNoDrive(e.isAndamentosNoDrive());
        r.setDriveFolderUrl(e.getDriveFolderUrl());
        r.setAndamentosNoDriveEm(e.getAndamentosNoDriveEm());
        r.setQtdArquivosDrive(e.getQtdArquivosDrive());
        return r;
    }
}
