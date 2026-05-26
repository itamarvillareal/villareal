package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.PortuguesTextoCorrecaoUtil;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.importacao.PlanilhaPasta1MapeamentoUtil;
import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import br.com.vilareal.pessoa.api.dto.ClienteCreateRequest;
import br.com.vilareal.pessoa.api.dto.ClienteCreateResult;
import br.com.vilareal.pessoa.api.dto.ClienteListItemResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.*;
import br.com.vilareal.processo.domain.HistoricoTituloLegadoSistema;
import br.com.vilareal.processo.infrastructure.persistence.entity.*;
import br.com.vilareal.processo.infrastructure.persistence.repository.*;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigInteger;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class ProcessoApplicationService {

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");

    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository parteRepository;
    private final ProcessoParteAdvogadoRepository parteAdvogadoRepository;
    private final ProcessoAndamentoRepository andamentoRepository;
    private final ProcessoPrazoRepository prazoRepository;
    private final PessoaRepository pessoaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ClienteRepository clienteRepository;
    private final ClienteResolverService clienteResolverService;
    private final DocumentoDrivePastaService documentoDrivePastaService;

    public ProcessoApplicationService(
            ProcessoRepository processoRepository,
            ProcessoParteRepository parteRepository,
            ProcessoParteAdvogadoRepository parteAdvogadoRepository,
            ProcessoAndamentoRepository andamentoRepository,
            ProcessoPrazoRepository prazoRepository,
            PessoaRepository pessoaRepository,
            UsuarioRepository usuarioRepository,
            PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            ClienteRepository clienteRepository,
            ClienteResolverService clienteResolverService,
            DocumentoDrivePastaService documentoDrivePastaService) {
        this.processoRepository = processoRepository;
        this.parteRepository = parteRepository;
        this.parteAdvogadoRepository = parteAdvogadoRepository;
        this.andamentoRepository = andamentoRepository;
        this.prazoRepository = prazoRepository;
        this.pessoaRepository = pessoaRepository;
        this.usuarioRepository = usuarioRepository;
        this.planilhaPasta1ClienteRepository = planilhaPasta1ClienteRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.clienteRepository = clienteRepository;
        this.clienteResolverService = clienteResolverService;
        this.documentoDrivePastaService = documentoDrivePastaService;
    }

    /**
     * Lista códigos de cliente para a UI.
     *
     * <p><strong>Fonte de verdade:</strong> a tabela {@code cliente} ({@code codigo_cliente} → {@code pessoa_id}).
     * Inclui-se depois, só para códigos que ainda não existem no mapa, o import Pasta1
     * ({@code planilha_pasta1_cliente}). Assim um vínculo corrigido na base prevalece sobre uma linha antiga
     * na planilha (ex.: código {@code 00000728} com pessoa correta 1809 em {@code cliente}, enquanto a
     * planilha ainda apontava para outro id).
     */
    @Transactional(readOnly = true)
    public List<ClienteListItemResponse> listarClientesResumo() {
        Map<String, ClienteListItemResponse> porCodigo = new LinkedHashMap<>();

        for (var c : clienteRepository.findAllFetchPessoaOrderByCodigo()) {
            String codKey = codigoClienteNormalizadoParaMapa(c.getCodigoCliente());
            if (!StringUtils.hasText(codKey)) {
                continue;
            }
            porCodigo.put(codKey, clienteEntityParaResumo(c));
        }

        List<PlanilhaPasta1ClienteEntity> mapeamentosPlanilha = planilhaPasta1ClienteRepository.findAll();
        if (!mapeamentosPlanilha.isEmpty()) {
            Map<String, List<PlanilhaPasta1ClienteEntity>> porCod8 = new HashMap<>();
            for (PlanilhaPasta1ClienteEntity m : mapeamentosPlanilha) {
                String cod8 = PlanilhaPasta1MapeamentoUtil.codigoClienteExibicaoParaChavePlanilha(m.getChaveCliente());
                if (cod8 == null) {
                    continue;
                }
                porCod8.computeIfAbsent(cod8, k -> new ArrayList<>()).add(m);
            }
            List<String> chavesOrdenadas = new ArrayList<>(porCod8.keySet());
            chavesOrdenadas.sort(String::compareTo);
            for (String cod8 : chavesOrdenadas) {
                if (porCodigo.containsKey(cod8)) {
                    continue;
                }
                long numeroCliente;
                try {
                    numeroCliente = CodigoClienteUtil.parsePessoaId(cod8);
                } catch (BusinessRuleException e) {
                    continue;
                }
                PlanilhaPasta1MapeamentoUtil.escolherEntreCandidatos(porCod8.get(cod8), numeroCliente)
                        .flatMap(m -> pessoaRepository.findById(m.getPessoaId()))
                        .ifPresent(
                                p -> porCodigo.put(
                                        cod8,
                                        new ClienteListItemResponse(
                                                null,
                                                p.getId(),
                                                cod8,
                                                Utf8MojibakeUtil.corrigir(p.getNome()),
                                                somenteDigitosDocumento(p.getCpf()))));
            }
        }

        return porCodigo.values().stream()
                .sorted(Comparator.comparing(ClienteListItemResponse::getCodigoCliente))
                .collect(Collectors.toList());
    }

    /**
     * Índice leve para busca/navegação (tela Clientes): só tabela {@code cliente}, sem varrer planilha Pasta1.
     * Códigos só na planilha continuam acessíveis via {@link #resolverClientePorCodigo(String)}.
     */
    @Transactional(readOnly = true)
    public List<ClienteListItemResponse> listarClientesIndice() {
        return clienteRepository.findAllFetchPessoaOrderByCodigo().stream()
                .map(this::clienteEntityParaResumo)
                .collect(Collectors.toList());
    }

    private static String somenteDigitosDocumento(String cpf) {
        if (cpf == null) {
            return null;
        }
        String d = cpf.replaceAll("\\D", "");
        return d.isEmpty() ? null : d;
    }

    /**
     * Resolve um código de cliente (8 dígitos) para cabeçalho da tela / cadastro. Com planilha Pasta1
     * importada, só existe resposta se houver linha na tabela — nunca assume pessoa = número do código.
     */
    @Transactional(readOnly = true)
    public Optional<ClienteListItemResponse> resolverClientePorCodigo(String codigoCliente) {
        if (!StringUtils.hasText(codigoCliente)) {
            return Optional.empty();
        }
        String trimmed = codigoCliente.trim();
        final String cod8;
        try {
            cod8 = CodigoClienteUtil.formatar(CodigoClienteUtil.parsePessoaId(trimmed));
        } catch (BusinessRuleException e) {
            return Optional.empty();
        }
        Optional<Long> pessoaOpt = clienteCodigoPessoaResolver.resolverPessoaIdComFallbackCliente(trimmed);
        return pessoaOpt.flatMap(
                pid -> pessoaRepository
                        .findById(pid)
                        .map(
                                p -> {
                                    Optional<ClienteEntity> linhaCliente =
                                            clienteRepository.findByCodigoClienteFetchPessoa(cod8);
                                    if (linhaCliente.isEmpty()) {
                                        linhaCliente =
                                                clienteRepository.findByCodigoClienteFetchPessoaTrim(cod8);
                                    }
                                    Long clientePk = linhaCliente.map(ClienteEntity::getId).orElse(null);
                                    return new ClienteListItemResponse(
                                            clientePk,
                                            p.getId(),
                                            cod8,
                                            Utf8MojibakeUtil.corrigir(p.getNome()),
                                            somenteDigitosDocumento(p.getCpf()));
                                }));
    }

    /**
     * Insere em {@code cliente} (código único → pessoa) ou devolve o registo existente se o par coincidir.
     */
    @Transactional
    public ClienteCreateResult criarClienteMinimo(ClienteCreateRequest req) {
        if (req.getPessoaId() == null) {
            throw new BusinessRuleException("pessoaId é obrigatório");
        }
        if (!StringUtils.hasText(req.getCodigoCliente())) {
            throw new BusinessRuleException("codigoCliente é obrigatório");
        }
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(req.getCodigoCliente().trim());
        if (!StringUtils.hasText(cod8)) {
            throw new BusinessRuleException("codigoCliente inválido");
        }
        PessoaEntity pessoa = pessoaRepository
                .findById(req.getPessoaId())
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + req.getPessoaId()));

        Optional<ClienteEntity> existente = clienteRepository.findByCodigoClienteFetchPessoa(cod8);
        if (existente.isPresent()) {
            ClienteEntity c = existente.get();
            if (!c.getPessoa().getId().equals(req.getPessoaId())) {
                throw new BusinessRuleException("Código de cliente já existe para outra pessoa.");
            }
            return new ClienteCreateResult(clienteEntityParaResumo(c), false);
        }

        ClienteEntity novo = new ClienteEntity();
        novo.setCodigoCliente(cod8);
        novo.setPessoa(pessoa);
        novo.setInativo(false);
        novo = clienteRepository.save(novo);
        return new ClienteCreateResult(clienteEntityParaResumo(novo), true);
    }

    private ClienteListItemResponse clienteEntityParaResumo(ClienteEntity c) {
        PessoaEntity p = c.getPessoa();
        String codigoExibicao = codigoClienteNormalizadoParaMapa(c.getCodigoCliente());
        String nome =
                StringUtils.hasText(c.getNomeReferencia()) ? c.getNomeReferencia() : p.getNome();
        String doc =
                StringUtils.hasText(c.getDocumentoReferencia())
                        ? somenteDigitosDocumento(c.getDocumentoReferencia())
                        : somenteDigitosDocumento(p.getCpf());
        return new ClienteListItemResponse(
                c.getId(), p.getId(), codigoExibicao, Utf8MojibakeUtil.corrigir(nome), doc);
    }

    /** Alinha CHAR(8) / espaços do MySQL ao mesmo formato que o front usa na busca (8 dígitos). */
    private static String codigoClienteNormalizadoParaMapa(String raw) {
        if (raw == null) {
            return "";
        }
        String t = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(raw.trim());
        return t != null ? t : "";
    }

    /**
     * Um processo pela chave natural (código cliente 8 dígitos + nº interno), sem listar todos os processos do titular.
     */
    @Transactional(readOnly = true)
    public Optional<ProcessoResponse> buscarPorCodigoClienteENumeroInterno(String codigoCliente, int numeroInterno) {
        if (numeroInterno < 0) {
            return Optional.empty();
        }
        Optional<ClienteEntity> clienteOpt = clienteResolverService.encontrarClientePorCodigo(codigoCliente);
        if (clienteOpt.isPresent()) {
            ClienteEntity cliente = clienteOpt.get();
            Optional<ProcessoEntity> porCliente = resolverProcessoCanonicoPorCliente(
                    cliente.getId(), cliente.getPessoa().getId(), numeroInterno);
            if (porCliente.isPresent()) {
                return porCliente.map(this::toResponse);
            }
            return processoRepository
                    .findByPessoa_IdAndNumeroInterno(cliente.getPessoa().getId(), numeroInterno)
                    .map(this::toResponse);
        }
        Optional<Long> resolved = clienteCodigoPessoaResolver.resolverPessoaIdComFallbackCliente(codigoCliente);
        if (resolved.isEmpty()) {
            return Optional.empty();
        }
        return processoRepository
                .findByPessoa_IdAndNumeroInterno(resolved.get(), numeroInterno)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<ProcessoResponse> listarPorCodigoCliente(String codigoCliente, Pageable pageable) {
        return listarPorCodigoCliente(codigoCliente, pageable, false);
    }

    /**
     * @param resumo se {@code true}, não carrega partes (grade Clientes / combos); {@code parteOposta} fica vazia na API.
     */
    @Transactional(readOnly = true)
    public Page<ProcessoResponse> listarPorCodigoCliente(String codigoCliente, Pageable pageable, boolean resumo) {
        Page<ProcessoEntity> page;
        Optional<ClienteEntity> clienteOpt = clienteResolverService.encontrarClientePorCodigo(codigoCliente);
        if (clienteOpt.isPresent()) {
            ClienteEntity cliente = clienteOpt.get();
            page = processoRepository.findByCliente_Id(cliente.getId(), pageable);
            if (page.isEmpty()) {
                page = processoRepository.findByPessoa_Id(cliente.getPessoa().getId(), pageable);
            }
        } else {
            Optional<Long> resolved = clienteCodigoPessoaResolver.resolverPessoaIdComFallbackCliente(codigoCliente);
            if (resolved.isEmpty() || !pessoaRepository.existsById(resolved.get())) {
                return Page.empty(pageable);
            }
            page = processoRepository.findByPessoa_Id(resolved.get(), pageable);
        }
        if (resumo) {
            return page.map(this::toResponse);
        }
        List<Long> procIds = page.getContent().stream().map(ProcessoEntity::getId).collect(Collectors.toList());
        Map<Long, List<ProcessoParteEntity>> partesPorProcesso = new LinkedHashMap<>();
        if (!procIds.isEmpty()) {
            for (ProcessoParteEntity parte :
                    parteRepository.findAllByProcessoIdInWithPessoaEProcesso(procIds)) {
                Long pid = parte.getProcesso().getId();
                partesPorProcesso.computeIfAbsent(pid, k -> new ArrayList<>()).add(parte);
            }
        }
        return page.map(
                e -> {
                    ProcessoResponse r = toResponse(e);
                    r.setParteOposta(montarTextoParteOpostaListagem(
                            partesPorProcesso.getOrDefault(e.getId(), List.of())));
                    return r;
                });
    }

    /**
     * Lista todos os processos com paginação Spring (sem filtro de cliente).
     * Usado quando {@code GET /api/processos} é chamado sem {@code codigoCliente} (ex.: {@code ?page=0}).
     */
    @Transactional(readOnly = true)
    public Page<ProcessoResponse> listarTodosPaginado(Pageable pageable) {
        Page<ProcessoEntity> page = processoRepository.findAll(pageable);
        List<Long> procIds = page.getContent().stream().map(ProcessoEntity::getId).collect(Collectors.toList());
        Map<Long, List<ProcessoParteEntity>> partesPorProcesso = new LinkedHashMap<>();
        if (!procIds.isEmpty()) {
            for (ProcessoParteEntity parte :
                    parteRepository.findAllByProcessoIdInWithPessoaEProcesso(procIds)) {
                Long pid = parte.getProcesso().getId();
                partesPorProcesso.computeIfAbsent(pid, k -> new ArrayList<>()).add(parte);
            }
        }
        return page.map(e -> {
            ProcessoResponse r = toResponse(e);
            r.setParteOposta(montarTextoParteOpostaListagem(
                    partesPorProcesso.getOrDefault(e.getId(), List.of())));
            return r;
        });
    }

    @Transactional(readOnly = true)
    public List<ProcessoResponse> listarPorNumeroInterno(int numeroInterno) {
        if (numeroInterno < 0) {
            return List.of();
        }
        List<ProcessoEntity> lista = processoRepository.findByNumeroInternoOrderByIdAsc(numeroInterno);
        if (lista.isEmpty()) {
            return List.of();
        }
        List<Long> procIds = lista.stream().map(ProcessoEntity::getId).collect(Collectors.toList());
        Map<Long, List<ProcessoParteEntity>> partesPorProcesso = new LinkedHashMap<>();
        for (ProcessoParteEntity parte :
                parteRepository.findAllByProcessoIdInWithPessoaEProcesso(procIds)) {
            Long pid = parte.getProcesso().getId();
            partesPorProcesso.computeIfAbsent(pid, k -> new ArrayList<>()).add(parte);
        }
        return lista.stream()
                .map(e -> {
                    ProcessoResponse r = toResponse(e);
                    r.setParteOposta(montarTextoParteOpostaListagem(
                            partesPorProcesso.getOrDefault(e.getId(), List.of())));
                    return r;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProcessoDiagnosticoPessoaItemResponse> listarVinculosDiagnosticoPorPessoa(Long pessoaId) {
        if (pessoaId == null || pessoaId < 1 || !pessoaRepository.existsById(pessoaId)) {
            return List.of();
        }
        List<ProcessoEntity> lista = new ArrayList<>(processoRepository.findAllDistinctVinculadosPessoa(pessoaId));
        lista.sort(Comparator.comparing((ProcessoEntity e) -> e.getPessoa().getId())
                .thenComparing(ProcessoEntity::getNumeroInterno));

        List<Long> procIds = lista.stream().map(ProcessoEntity::getId).collect(Collectors.toList());
        Map<Long, List<ProcessoParteEntity>> partesPorProcesso = new LinkedHashMap<>();
        if (!procIds.isEmpty()) {
            for (ProcessoParteEntity parte :
                    parteRepository.findAllByProcessoIdInWithPessoaEProcesso(procIds)) {
                Long pid = parte.getProcesso().getId();
                partesPorProcesso.computeIfAbsent(pid, k -> new ArrayList<>()).add(parte);
            }
        }

        List<ProcessoDiagnosticoPessoaItemResponse> out = new ArrayList<>();
        for (ProcessoEntity e : lista) {
            List<ProcessoParteEntity> partes = partesPorProcesso.getOrDefault(e.getId(), List.of());
            Long ownerId = e.getPessoa().getId();
            String cod8 = resolverCodigoClienteExibicaoParaPessoa(ownerId);
            String nomeCliente = Utf8MojibakeUtil.corrigir(e.getPessoa().getNome());
            String parteOpostaTxt = montarTextoParteOpostaListagem(partes);

            LinkedHashSet<String> papeis = new LinkedHashSet<>();
            if (ownerId.equals(pessoaId)) {
                papeis.add("Cliente do processo");
            }
            for (ProcessoParteEntity parte : partes) {
                if (parte.getPessoa() != null && parte.getPessoa().getId().equals(pessoaId)) {
                    String poloNorm = normalizarPoloParaComparacao(parte.getPolo());
                    if (poloNorm.contains("AUTOR")
                            || poloNorm.contains("REQUERENTE")
                            || poloNorm.contains("CLIENTE")) {
                        papeis.add("Parte Cliente");
                    } else {
                        papeis.add("Parte Oposta");
                    }
                }
                for (ProcessoParteAdvogadoEntity adv :
                        parteAdvogadoRepository.findByProcessoParte_IdOrderByOrdemAscIdAsc(parte.getId())) {
                    if (adv.getAdvogadoPessoa().getId().equals(pessoaId)) {
                        papeis.add("Advogado(a)");
                    }
                }
            }

            String cnj = trimToNull(e.getNumeroCnj());
            ProcessoDiagnosticoPessoaItemResponse r = new ProcessoDiagnosticoPessoaItemResponse();
            r.setCodigoCliente(cod8);
            r.setNumeroInterno(e.getNumeroInterno());
            r.setCliente(nomeCliente);
            r.setParteCliente(nomeCliente);
            r.setParteOposta(parteOpostaTxt);
            r.setNumeroProcessoNovo(cnj == null ? "" : Utf8MojibakeUtil.corrigir(cnj));
            r.setPapeis(String.join(" · ", papeis));
            out.add(r);
        }
        return out;
    }

    /**
     * Diagnósticos: localiza processos pelo número CNJ (entrada com ou sem pontuação).
     */
    @Transactional(readOnly = true)
    public List<ProcessoDiagnosticoPessoaItemResponse> buscarDiagnosticoPorNumeroProcesso(String numeroBruto) {
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(numeroBruto);
        if (norm.length() < 7) {
            return List.of();
        }
        List<BigInteger> rawIds =
                norm.length() < 20
                        ? processoRepository.findIdsByNumeroCnjDigitosContendo(norm)
                        : processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (rawIds.isEmpty()) {
            return List.of();
        }
        List<Long> ids = rawIds.stream().map(BigInteger::longValue).collect(Collectors.toList());
        List<ProcessoEntity> lista = new ArrayList<>(processoRepository.findAllById(ids));
        lista.sort(Comparator.comparing((ProcessoEntity e) -> e.getPessoa().getId())
                .thenComparing(ProcessoEntity::getNumeroInterno));
        return montarDiagnosticoListaPorProcessos(lista, "Busca por número (CNJ)");
    }

    /**
     * Diagnósticos: processos com prazo fatal na data (coluna {@code processo.prazo_fatal} ou prazo fatal na tabela
     * de prazos com {@code data_fim}).
     */
    @Transactional(readOnly = true)
    public List<ProcessoDiagnosticoPessoaItemResponse> buscarDiagnosticoPorPrazoFatal(String dataBruta) {
        LocalDate data = parseDataParametroDiagnostico(dataBruta);
        if (data == null) {
            return List.of();
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (ProcessoEntity e : processoRepository.findByPrazoFatal(data)) {
            ids.add(e.getId());
        }
        for (Long pid : prazoRepository.findDistinctProcessoIdsComPrazoFatalTrueAndDataFim(data)) {
            ids.add(pid);
        }
        if (ids.isEmpty()) {
            return List.of();
        }
        List<ProcessoEntity> lista = new ArrayList<>(processoRepository.findAllById(ids));
        lista.sort(Comparator.comparing((ProcessoEntity e) -> e.getPessoa().getId())
                .thenComparing(ProcessoEntity::getNumeroInterno));
        return montarDiagnosticoListaPorProcessos(lista, "Prazo fatal (cadastro API)");
    }

    /**
     * Diagnósticos «Consultas Realizadas»: linhas de histórico cuja <strong>data do movimento</strong>
     * ({@code movimento_em}, fuso America/Sao_Paulo) coincide com o parâmetro — como o legado VB
     * (campo «data» de cada informação), não a data técnica de gravação na API.
     */
    @Transactional(readOnly = true)
    public List<ProcessoDiagnosticoHistoricoItemResponse> buscarDiagnosticoHistoricoPorData(String dataBruta) {
        LocalDate data = parseDataParametroDiagnostico(dataBruta);
        if (data == null) {
            return List.of();
        }
        Instant inicio = data.atStartOfDay(ZONA_BR).toInstant();
        Instant fim = data.plusDays(1).atStartOfDay(ZONA_BR).toInstant();
        List<ProcessoAndamentoEntity> andamentos = andamentoRepository.findByMovimentoEmBetween(inicio, fim);
        if (andamentos.isEmpty()) {
            return List.of();
        }
        List<Long> procIds =
                andamentos.stream().map(a -> a.getProcesso().getId()).distinct().collect(Collectors.toList());
        Map<Long, List<ProcessoParteEntity>> partesPorProcesso = new LinkedHashMap<>();
        for (ProcessoParteEntity parte : parteRepository.findAllByProcessoIdInWithPessoaEProcesso(procIds)) {
            Long pid = parte.getProcesso().getId();
            partesPorProcesso.computeIfAbsent(pid, k -> new ArrayList<>()).add(parte);
        }
        List<ProcessoDiagnosticoHistoricoItemResponse> out = new ArrayList<>();
        for (ProcessoAndamentoEntity a : andamentos) {
            ProcessoEntity p = a.getProcesso();
            List<ProcessoParteEntity> partes = partesPorProcesso.getOrDefault(p.getId(), List.of());
            Long ownerId = p.getPessoa().getId();
            String cod8 = resolverCodigoClienteExibicaoParaPessoa(ownerId);
            String nomeCliente = Utf8MojibakeUtil.corrigir(p.getPessoa().getNome());
            String parteOpostaTxt = montarTextoParteOpostaListagem(partes);
            String cnj = trimToNull(p.getNumeroCnj());
            String titulo = Utf8MojibakeUtil.corrigir(StringUtils.hasText(a.getTitulo()) ? a.getTitulo() : "Andamento");
            if (HistoricoTituloLegadoSistema.ehTituloSistemaLegado(titulo)) {
                continue;
            }
            ProcessoDiagnosticoHistoricoItemResponse r = new ProcessoDiagnosticoHistoricoItemResponse();
            r.setCodigoCliente(cod8);
            r.setNumeroInterno(p.getNumeroInterno());
            r.setCliente(nomeCliente);
            r.setParteCliente(nomeCliente);
            r.setParteOposta(parteOpostaTxt);
            r.setNumeroProcessoNovo(cnj == null ? "" : Utf8MojibakeUtil.corrigir(cnj));
            r.setAndamentoId(a.getId());
            r.setInfo(titulo);
            r.setData(formatarDataBrDiagnostico(a.getMovimentoEm()));
            UsuarioEntity u = a.getUsuario();
            if (u != null) {
                String nome = StringUtils.hasText(u.getNome()) ? u.getNome() : u.getLogin();
                r.setUsuario(Utf8MojibakeUtil.corrigir(nome).toUpperCase(Locale.ROOT));
            } else {
                r.setUsuario("");
            }
            out.add(r);
        }
        out = agruparConsultasRealizadasUmaLinhaPorProcesso(out);
        out.sort(Comparator.comparing(ProcessoDiagnosticoHistoricoItemResponse::getCodigoCliente)
                .thenComparing(ProcessoDiagnosticoHistoricoItemResponse::getNumeroInterno)
                .thenComparing((ProcessoDiagnosticoHistoricoItemResponse x) -> x.getAndamentoId() != null ? x.getAndamentoId() : 0L,
                        Comparator.reverseOrder()));
        return out;
    }

    /**
     * Legado VB: no dia, um processo aparece uma vez no relatório «Consultas Realizadas»
     * (fica o andamento de maior id na data).
     */
    private static List<ProcessoDiagnosticoHistoricoItemResponse> agruparConsultasRealizadasUmaLinhaPorProcesso(
            List<ProcessoDiagnosticoHistoricoItemResponse> linhas) {
        Map<String, ProcessoDiagnosticoHistoricoItemResponse> melhor = new LinkedHashMap<>();
        for (ProcessoDiagnosticoHistoricoItemResponse r : linhas) {
            String chave = r.getCodigoCliente() + ":" + r.getNumeroInterno();
            ProcessoDiagnosticoHistoricoItemResponse prev = melhor.get(chave);
            long id = r.getAndamentoId() != null ? r.getAndamentoId() : 0L;
            long prevId = prev != null && prev.getAndamentoId() != null ? prev.getAndamentoId() : -1L;
            if (prev == null || id >= prevId) {
                melhor.put(chave, r);
            }
        }
        return new ArrayList<>(melhor.values());
    }

    private static String formatarDataBrDiagnostico(Instant instant) {
        if (instant == null) {
            return "";
        }
        return instant.atZone(ZONA_BR).toLocalDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private List<ProcessoDiagnosticoPessoaItemResponse> montarDiagnosticoListaPorProcessos(
            List<ProcessoEntity> lista, String papeisRotulo) {
        List<Long> procIds = lista.stream().map(ProcessoEntity::getId).collect(Collectors.toList());
        Map<Long, List<ProcessoParteEntity>> partesPorProcesso = new LinkedHashMap<>();
        if (!procIds.isEmpty()) {
            for (ProcessoParteEntity parte : parteRepository.findAllByProcessoIdInWithPessoaEProcesso(procIds)) {
                Long pid = parte.getProcesso().getId();
                partesPorProcesso.computeIfAbsent(pid, k -> new ArrayList<>()).add(parte);
            }
        }
        List<ProcessoDiagnosticoPessoaItemResponse> out = new ArrayList<>();
        for (ProcessoEntity e : lista) {
            List<ProcessoParteEntity> partes = partesPorProcesso.getOrDefault(e.getId(), List.of());
            Long ownerId = e.getPessoa().getId();
            String cod8 = resolverCodigoClienteExibicaoParaPessoa(ownerId);
            String nomeCliente = Utf8MojibakeUtil.corrigir(e.getPessoa().getNome());
            String parteOpostaTxt = montarTextoParteOpostaListagem(partes);
            String cnj = trimToNull(e.getNumeroCnj());
            ProcessoDiagnosticoPessoaItemResponse r = new ProcessoDiagnosticoPessoaItemResponse();
            r.setCodigoCliente(cod8);
            r.setNumeroInterno(e.getNumeroInterno());
            r.setCliente(nomeCliente);
            r.setParteCliente(nomeCliente);
            r.setParteOposta(parteOpostaTxt);
            r.setNumeroProcessoNovo(cnj == null ? "" : Utf8MojibakeUtil.corrigir(cnj));
            r.setPapeis(papeisRotulo);
            out.add(r);
        }
        return out;
    }

    private static LocalDate parseDataParametroDiagnostico(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String t = raw.trim();
        try {
            return LocalDate.parse(t, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException ignored) {
            // tenta dd/mm/aaaa
        }
        DateTimeFormatter[] formatos = {
            DateTimeFormatter.ofPattern("dd/MM/uuuu"),
            DateTimeFormatter.ofPattern("d/M/uuuu"),
            DateTimeFormatter.ofPattern("dd/M/uuuu"),
            DateTimeFormatter.ofPattern("d/MM/uuuu")
        };
        for (DateTimeFormatter fmt : formatos) {
            try {
                return LocalDate.parse(t, fmt);
            } catch (DateTimeParseException ignored) {
                // próximo
            }
        }
        return null;
    }

    private String resolverCodigoClienteExibicaoParaPessoa(Long pessoaIdDonoProcesso) {
        return clienteCodigoPessoaResolver.codigoClienteExibicaoParaPessoaId(pessoaIdDonoProcesso);
    }

    /**
     * Nomes «parte cliente» e «parte oposta» para listagens (ex.: vínculo em Publicações), em lote para evitar N+1.
     */
    @Transactional(readOnly = true)
    public Map<Long, ProcessoPartesVinculoTexto> resolverTextosPartesVinculoEmLote(Set<Long> processoIds) {
        if (processoIds == null || processoIds.isEmpty()) {
            return Map.of();
        }
        List<Long> idList = processoIds.stream().filter(id -> id != null && id > 0).distinct().toList();
        if (idList.isEmpty()) {
            return Map.of();
        }
        List<ProcessoEntity> processos = processoRepository.findAllById(idList);
        Map<Long, List<ProcessoParteEntity>> partesPorProcesso = new LinkedHashMap<>();
        for (ProcessoParteEntity parte : parteRepository.findAllByProcessoIdInWithPessoaEProcesso(idList)) {
            Long pid = parte.getProcesso().getId();
            partesPorProcesso.computeIfAbsent(pid, k -> new ArrayList<>()).add(parte);
        }
        Map<Long, ProcessoPartesVinculoTexto> out = new LinkedHashMap<>();
        for (ProcessoEntity e : processos) {
            e.getPessoa().getNome();
            List<ProcessoParteEntity> partes = partesPorProcesso.getOrDefault(e.getId(), List.of());
            String pc = Utf8MojibakeUtil.corrigir(e.getPessoa().getNome());
            String parteCliente = StringUtils.hasText(pc) ? pc.trim() : "";
            String po = montarTextoParteOpostaListagem(partes);
            String parteOposta = StringUtils.hasText(po) ? po.trim() : "";
            out.put(e.getId(), new ProcessoPartesVinculoTexto(parteCliente, parteOposta));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public ProcessoResponse buscar(Long id) {
        ProcessoEntity e = requireProcesso(id);
        e.getPessoa().getNome();
        return toResponse(e);
    }

    private Optional<ProcessoEntity> resolverProcessoCanonicoPorCliente(
            Long clienteId, Long clientePessoaId, int numeroInterno) {
        return ProcessoCanonicalLookup.escolher(
                processoRepository.findAllByCliente_IdAndNumeroInternoOrderByIdDesc(clienteId, numeroInterno),
                clientePessoaId);
    }

    @Transactional
    public ProcessoResponse criar(ProcessoWriteRequest req) {
        ClienteEntity cliente = clienteResolverService.buscarPorId(req.getClienteId());
        resolverProcessoCanonicoPorCliente(
                        cliente.getId(), cliente.getPessoa().getId(), req.getNumeroInterno())
                .ifPresent(x -> {
                    throw new BusinessRuleException("Já existe processo com este número interno para o cliente.");
                });
        ProcessoEntity e = new ProcessoEntity();
        aplicarClienteTitularDoRequest(e, cliente, req);
        aplicarCabecalho(e, req);
        e = processoRepository.save(e);
        return toResponse(requireProcesso(e.getId()));
    }

    @Transactional
    public ProcessoResponse atualizar(Long id, ProcessoWriteRequest req) {
        ProcessoEntity e = requireProcesso(id);
        ClienteEntity cliente = clienteResolverService.buscarPorId(req.getClienteId());
        boolean chaveNaturalMudou =
                e.getCliente() == null
                        || !cliente.getId().equals(e.getCliente().getId())
                        || !req.getNumeroInterno().equals(e.getNumeroInterno());
        if (chaveNaturalMudou) {
            resolverProcessoCanonicoPorCliente(
                            cliente.getId(), cliente.getPessoa().getId(), req.getNumeroInterno())
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(x -> {
                        throw new BusinessRuleException("Já existe processo com este número interno para o cliente.");
                    });
        }
        aplicarClienteTitularDoRequest(e, cliente, req);
        e.setNumeroInterno(req.getNumeroInterno());
        aplicarCabecalho(e, req);
        processoRepository.save(e);
        return toResponse(requireProcesso(id));
    }

    @Transactional
    public void patchAtivo(Long id, boolean ativo) {
        ProcessoEntity e = requireProcesso(id);
        e.setAtivo(ativo);
        processoRepository.save(e);
    }

    @Transactional(readOnly = true)
    public List<ProcessoParteResponse> listarPartes(Long processoId) {
        requireProcesso(processoId);
        List<ProcessoParteEntity> partes = parteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId);
        if (partes.isEmpty()) {
            return List.of();
        }
        List<Long> parteIds = partes.stream().map(ProcessoParteEntity::getId).collect(Collectors.toList());
        Map<Long, List<Long>> advogadosPorParteId = new HashMap<>();
        for (ProcessoParteAdvogadoEntity link :
                parteAdvogadoRepository.findByProcessoParte_IdInOrderByProcessoParte_IdAscOrdemAscIdAsc(parteIds)) {
            Long parteId = link.getProcessoParte().getId();
            advogadosPorParteId
                    .computeIfAbsent(parteId, k -> new ArrayList<>())
                    .add(link.getAdvogadoPessoa().getId());
        }
        return partes.stream()
                .map(p -> toParteResponse(p, advogadosPorParteId.getOrDefault(p.getId(), List.of())))
                .collect(Collectors.toList());
    }

    @Transactional
    public ProcessoParteResponse criarParte(Long processoId, ProcessoParteWriteRequest req) {
        ProcessoEntity proc = requireProcesso(processoId);
        ProcessoParteEntity p = new ProcessoParteEntity();
        p.setProcesso(proc);
        aplicarParte(p, req);
        p = parteRepository.save(p);
        substituirAdvogadosDaParte(p, req.getAdvogadoPessoaIds() != null ? req.getAdvogadoPessoaIds() : List.of());
        agendarAtualizacaoPastaDrive(processoId);
        return toParteResponse(requireParte(processoId, p.getId()));
    }

    @Transactional
    public ProcessoParteResponse atualizarParte(Long processoId, Long parteId, ProcessoParteWriteRequest req) {
        ProcessoParteEntity p = requireParte(processoId, parteId);
        aplicarParte(p, req);
        parteRepository.save(p);
        if (req.getAdvogadoPessoaIds() != null) {
            substituirAdvogadosDaParte(p, req.getAdvogadoPessoaIds());
        }
        agendarAtualizacaoPastaDrive(processoId);
        return toParteResponse(requireParte(processoId, parteId));
    }

    @Transactional
    public void excluirParte(Long processoId, Long parteId) {
        ProcessoParteEntity p = requireParte(processoId, parteId);
        parteRepository.delete(p);
        agendarAtualizacaoPastaDrive(processoId);
    }

    private void agendarAtualizacaoPastaDrive(Long processoId) {
        CompletableFuture.runAsync(() -> documentoDrivePastaService.atualizarPastaDriveAposAlteracaoPartes(processoId));
    }

    @Transactional(readOnly = true)
    public List<ProcessoAndamentoResponse> listarAndamentos(Long processoId) {
        requireProcesso(processoId);
        List<ProcessoAndamentoEntity> rows =
                andamentoRepository.findByProcesso_IdOrderByMovimentoEmDescIdDesc(processoId);
        if (rows.isEmpty()) {
            return List.of();
        }
        try {
            Map<Long, Long> usuarioIdPorAndamentoId = new HashMap<>();
            for (Object[] pair : andamentoRepository.findAndamentoUsuarioFkPairsByProcessoId(processoId)) {
                if (pair == null || pair.length < 2) {
                    continue;
                }
                Long andamentoId = longIdOrNull(pair[0]);
                if (andamentoId == null) {
                    continue;
                }
                Long usuarioFk = longIdOrNull(pair[1]);
                if (usuarioFk == null) {
                    continue;
                }
                usuarioIdPorAndamentoId.put(andamentoId, usuarioFk);
            }
            Set<Long> idsUsuarios = usuarioIdPorAndamentoId.values().stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            Map<Long, UsuarioEntity> usuarioPorId =
                    idsUsuarios.isEmpty()
                            ? Map.of()
                            : usuarioRepository.findAllById(idsUsuarios).stream()
                                    .collect(Collectors.toMap(UsuarioEntity::getId, u -> u));
            return rows.stream()
                    .map(a -> {
                        UsuarioEntity u = a.getUsuario();
                        if (u == null) {
                            Long uid = usuarioIdPorAndamentoId.get(a.getId());
                            if (uid != null) {
                                u = usuarioPorId.get(uid);
                            }
                        }
                        return toAndamentoResponse(a, u);
                    })
                    .collect(Collectors.toList());
        } catch (RuntimeException ignored) {
            return rows.stream()
                    .map(a -> toAndamentoResponse(a, a.getUsuario()))
                    .collect(Collectors.toList());
        }
    }

    /** Converte coluna escalar de consulta JPQL (id / FK) para Long. */
    private static Long longIdOrNull(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        String s = String.valueOf(o).trim();
        if (!StringUtils.hasText(s)) {
            return null;
        }
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    @Transactional
    public ProcessoAndamentoResponse criarAndamento(Long processoId, ProcessoAndamentoWriteRequest req) {
        ProcessoEntity proc = requireProcesso(processoId);
        ProcessoAndamentoEntity a = new ProcessoAndamentoEntity();
        a.setProcesso(proc);
        aplicarAndamento(a, req);
        a = andamentoRepository.save(a);
        return toAndamentoResponse(andamentoRepository.findById(a.getId()).orElseThrow(), null);
    }

    @Transactional
    public ProcessoAndamentoResponse atualizarAndamento(
            Long processoId, Long andamentoId, ProcessoAndamentoWriteRequest req) {
        ProcessoAndamentoEntity a = requireAndamento(processoId, andamentoId);
        aplicarAndamento(a, req);
        andamentoRepository.save(a);
        return toAndamentoResponse(requireAndamento(processoId, andamentoId), null);
    }

    @Transactional
    public void excluirAndamento(Long processoId, Long andamentoId) {
        ProcessoAndamentoEntity a = requireAndamento(processoId, andamentoId);
        andamentoRepository.delete(a);
    }

    /**
     * Exclusão em massa por {@code origem} (ex.: {@code IMPORT_PLANILHA} do script de importação de histórico).
     *
     * @return número de linhas removidas
     */
    @Transactional
    public int excluirAndamentosPorOrigem(String origem) {
        if (origem == null || !origem.matches("^[A-Za-z0-9_]{1,40}$")) {
            throw new BusinessRuleException("Origem inválida para exclusão em massa.");
        }
        return andamentoRepository.deleteByOrigem(origem.trim());
    }

    @Transactional(readOnly = true)
    public List<ProcessoPrazoResponse> listarPrazos(Long processoId) {
        requireProcesso(processoId);
        return prazoRepository.findByProcesso_IdOrderByIdAsc(processoId).stream()
                .map(this::toPrazoResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProcessoPrazoResponse criarPrazo(Long processoId, ProcessoPrazoWriteRequest req) {
        ProcessoEntity proc = requireProcesso(processoId);
        ProcessoPrazoEntity z = new ProcessoPrazoEntity();
        z.setProcesso(proc);
        aplicarPrazo(z, req);
        z = prazoRepository.save(z);
        return toPrazoResponse(prazoRepository.findById(z.getId()).orElseThrow());
    }

    @Transactional
    public ProcessoPrazoResponse atualizarPrazo(Long processoId, Long prazoId, ProcessoPrazoWriteRequest req) {
        ProcessoPrazoEntity z = requirePrazo(processoId, prazoId);
        aplicarPrazo(z, req);
        prazoRepository.save(z);
        return toPrazoResponse(requirePrazo(processoId, prazoId));
    }

    private ProcessoEntity requireProcesso(Long id) {
        return processoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + id));
    }

    private ProcessoParteEntity requireParte(Long processoId, Long parteId) {
        ProcessoParteEntity p = parteRepository
                .findById(parteId)
                .orElseThrow(() -> new ResourceNotFoundException("Parte não encontrada: " + parteId));
        if (!p.getProcesso().getId().equals(processoId)) {
            throw new ResourceNotFoundException("Parte não encontrada neste processo.");
        }
        return p;
    }

    private ProcessoAndamentoEntity requireAndamento(Long processoId, Long andamentoId) {
        ProcessoAndamentoEntity a = andamentoRepository
                .findById(andamentoId)
                .orElseThrow(() -> new ResourceNotFoundException("Andamento não encontrado: " + andamentoId));
        if (!a.getProcesso().getId().equals(processoId)) {
            throw new ResourceNotFoundException("Andamento não encontrado neste processo.");
        }
        return a;
    }

    private ProcessoPrazoEntity requirePrazo(Long processoId, Long prazoId) {
        ProcessoPrazoEntity z = prazoRepository
                .findById(prazoId)
                .orElseThrow(() -> new ResourceNotFoundException("Prazo não encontrado: " + prazoId));
        if (!z.getProcesso().getId().equals(processoId)) {
            throw new ResourceNotFoundException("Prazo não encontrado neste processo.");
        }
        return z;
    }

    private static String normalizarPapelCliente(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String n = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT);
        if (n.contains("REQUERIDO") || n.equals("REU")) {
            return "REQUERIDO";
        }
        if (n.contains("REQUERENTE") || n.equals("AUTOR")) {
            return "REQUERENTE";
        }
        return null;
    }

    private static String normalizarAvisoAudiencia(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String n = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT);
        if (n.startsWith("N") || n.contains("NAO") || n.equals("0") || n.equals("FALSE")) {
            return "NAO_AVISADO";
        }
        if (n.startsWith("S") || n.contains("AVIS") || n.equals("1") || n.equals("TRUE")) {
            return "AVISADO";
        }
        return null;
    }

    private static String normalizarHoraAudiencia(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String t = raw.trim().replace('.', ':');
        if (t.matches("^\\d{1,2}:\\d{2}$")) {
            String[] p = t.split(":");
            int h = Integer.parseInt(p[0]);
            int m = Integer.parseInt(p[1]);
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                return String.format(Locale.ROOT, "%02d:%02d", h, m);
            }
        }
        if (t.matches("^\\d{3,4}$")) {
            String d = t.length() == 3 ? "0" + t : t;
            int h = Integer.parseInt(d.substring(0, 2));
            int m = Integer.parseInt(d.substring(2));
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                return String.format(Locale.ROOT, "%02d:%02d", h, m);
            }
        }
        return null;
    }

    private void aplicarCabecalho(ProcessoEntity e, ProcessoWriteRequest req) {
        e.setNumeroInterno(req.getNumeroInterno());
        e.setNumeroCnj(trimToNull(req.getNumeroCnj()));
        e.setNumeroProcessoAntigo(trimToNull(req.getNumeroProcessoAntigo()));
        e.setNaturezaAcao(trimToNull(req.getNaturezaAcao()));
        e.setDescricaoAcao(trimToNull(req.getDescricaoAcao()));
        e.setCompetencia(trimToNull(req.getCompetencia()));
        e.setFase(trimToNull(req.getFase()));
        e.setObservacaoFase(trimToNull(req.getObservacaoFase()));
        e.setTramitacao(trimToNull(req.getTramitacao()));
        e.setDataProtocolo(req.getDataProtocolo());
        e.setPrazoFatal(req.getPrazoFatal());
        e.setProximaConsulta(req.getProximaConsulta());
        e.setObservacao(trimToNull(req.getObservacao()));
        e.setValorCausa(req.getValorCausa());
        if (req.getUf() != null && StringUtils.hasText(req.getUf())) {
            String u = req.getUf().trim().toUpperCase();
            e.setUf(u.length() > 2 ? u.substring(0, 2) : u);
        } else {
            e.setUf(null);
        }
        e.setCidade(trimToNull(req.getCidade()));
        e.setUnidade(trimToNull(req.getUnidade()));
        e.setPasta(trimToNull(req.getPasta()));
        e.setPapelCliente(normalizarPapelCliente(req.getPapelCliente()));
        e.setAudienciaData(req.getAudienciaData());
        e.setAudienciaHora(normalizarHoraAudiencia(req.getAudienciaHora()));
        e.setAudienciaTipo(trimToNull(req.getAudienciaTipo()));
        e.setAvisoAudiencia(normalizarAvisoAudiencia(req.getAvisoAudiencia()));
        e.setConsultaAutomatica(Boolean.TRUE.equals(req.getConsultaAutomatica()));
        if (req.getAtivo() != null) {
            e.setAtivo(req.getAtivo());
        }
        e.setConsultor(trimToNull(req.getConsultor()));
        if (req.getUsuarioResponsavelId() != null) {
            UsuarioEntity u = usuarioRepository
                    .findById(req.getUsuarioResponsavelId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Usuário não encontrado: " + req.getUsuarioResponsavelId()));
            e.setUsuarioResponsavel(u);
        } else {
            e.setUsuarioResponsavel(null);
        }
        if (StringUtils.hasText(req.getImportacaoId())) {
            e.setImportacaoId(req.getImportacaoId().trim());
        }
    }

    private void aplicarParte(ProcessoParteEntity p, ProcessoParteWriteRequest req) {
        if (req.getPessoaId() != null) {
            PessoaEntity pe = pessoaRepository
                    .findById(req.getPessoaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + req.getPessoaId()));
            p.setPessoa(pe);
        } else {
            p.setPessoa(null);
        }
        p.setNomeLivre(trimToNull(req.getNomeLivre()));
        p.setPolo(req.getPolo().trim());
        p.setQualificacao(trimToNull(req.getQualificacao()));
        p.setOrdem(req.getOrdem() != null ? req.getOrdem() : 0);
        if (StringUtils.hasText(req.getImportacaoId())) {
            p.setImportacaoId(req.getImportacaoId().trim());
        }
    }

    /**
     * Substitui advogados da parte. Cada advogado é uma {@code pessoa}; a mesma pessoa-parte pode ter vários.
     * Ignora id igual ao da própria parte (não auto-representação).
     */
    private void substituirAdvogadosDaParte(ProcessoParteEntity parte, List<Long> advogadoPessoaIds) {
        parteAdvogadoRepository.deleteByProcessoParte_Id(parte.getId());
        if (advogadoPessoaIds == null || advogadoPessoaIds.isEmpty()) {
            return;
        }
        Set<Long> vistos = new LinkedHashSet<>();
        int ordem = 0;
        for (Long aid : advogadoPessoaIds) {
            if (aid == null || !vistos.add(aid)) {
                continue;
            }
            if (parte.getPessoa() != null && aid.equals(parte.getPessoa().getId())) {
                continue;
            }
            PessoaEntity adv = pessoaRepository
                    .findById(aid)
                    .orElseThrow(() -> new ResourceNotFoundException("Advogado (pessoa) não encontrado: " + aid));
            ProcessoParteAdvogadoEntity row = new ProcessoParteAdvogadoEntity();
            row.setProcessoParte(parte);
            row.setAdvogadoPessoa(adv);
            row.setOrdem(ordem++);
            parteAdvogadoRepository.save(row);
        }
    }

    private void aplicarAndamento(ProcessoAndamentoEntity a, ProcessoAndamentoWriteRequest req) {
        a.setMovimentoEm(req.getMovimentoEm() != null ? req.getMovimentoEm() : Instant.now());
        a.setTitulo(req.getTitulo().trim());
        a.setDetalhe(trimToNull(req.getDetalhe()));
        String origem = StringUtils.hasText(req.getOrigem()) ? req.getOrigem().trim() : "MANUAL";
        a.setOrigem(origem);
        a.setOrigemAutomatica(Boolean.TRUE.equals(req.getOrigemAutomatica()));
        if (req.getUsuarioId() != null) {
            UsuarioEntity u = usuarioRepository
                    .findById(req.getUsuarioId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + req.getUsuarioId()));
            a.setUsuario(u);
        } else {
            a.setUsuario(null);
        }
    }

    private void aplicarPrazo(ProcessoPrazoEntity z, ProcessoPrazoWriteRequest req) {
        if (req.getAndamentoId() != null) {
            ProcessoAndamentoEntity a = requireAndamento(z.getProcesso().getId(), req.getAndamentoId());
            z.setAndamento(a);
        } else {
            z.setAndamento(null);
        }
        z.setDescricao(trimToNull(req.getDescricao()));
        z.setDataInicio(req.getDataInicio());
        z.setDataFim(req.getDataFim());
        z.setPrazoFatal(Boolean.TRUE.equals(req.getPrazoFatal()));
        z.setStatus(trimToNull(req.getStatus()));
        z.setObservacao(trimToNull(req.getObservacao()));
    }

    private void aplicarClienteTitularDoRequest(ProcessoEntity e, ClienteEntity cliente, ProcessoWriteRequest req) {
        PessoaEntity titular;
        if (req.getPessoaTitularId() != null) {
            titular = pessoaRepository
                    .findById(req.getPessoaTitularId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Titular não encontrado: " + req.getPessoaTitularId()));
        } else {
            titular = cliente.getPessoa();
        }
        e.setCliente(cliente);
        e.setPessoa(titular);
    }

    private ProcessoResponse toResponse(ProcessoEntity e) {
        Long titularId = e.getPessoa().getId();
        ProcessoResponse r = new ProcessoResponse();
        r.setId(e.getId());
        r.setPessoaTitularId(titularId);
        if (e.getCliente() != null) {
            r.setClienteId(e.getCliente().getId());
            r.setCodigoCliente(codigoClienteNormalizadoParaMapa(e.getCliente().getCodigoCliente()));
        } else {
            r.setClienteId(null);
            r.setCodigoCliente(resolverCodigoClienteExibicaoParaPessoa(titularId));
        }
        r.setNumeroInterno(e.getNumeroInterno());
        r.setNumeroCnj(Utf8MojibakeUtil.corrigir(e.getNumeroCnj()));
        r.setNumeroProcessoAntigo(Utf8MojibakeUtil.corrigir(e.getNumeroProcessoAntigo()));
        r.setNaturezaAcao(Utf8MojibakeUtil.corrigir(e.getNaturezaAcao()));
        r.setDescricaoAcao(Utf8MojibakeUtil.corrigir(e.getDescricaoAcao()));
        r.setCompetencia(Utf8MojibakeUtil.corrigir(e.getCompetencia()));
        String faseExibir =
                StringUtils.hasText(e.getFase()) ? e.getFase().trim() : ProcessoEntity.FASE_PADRAO_EM_ANDAMENTO;
        r.setFase(Utf8MojibakeUtil.corrigir(faseExibir));
        r.setObservacaoFase(Utf8MojibakeUtil.corrigir(e.getObservacaoFase()));
        r.setTramitacao(Utf8MojibakeUtil.corrigir(e.getTramitacao()));
        r.setDataProtocolo(e.getDataProtocolo());
        r.setPrazoFatal(e.getPrazoFatal());
        r.setProximaConsulta(e.getProximaConsulta());
        r.setObservacao(Utf8MojibakeUtil.corrigir(e.getObservacao()));
        r.setValorCausa(e.getValorCausa());
        r.setUf(e.getUf());
        r.setCidade(Utf8MojibakeUtil.corrigir(e.getCidade()));
        r.setUnidade(Utf8MojibakeUtil.corrigir(trimToNull(e.getUnidade())));
        r.setPasta(Utf8MojibakeUtil.corrigir(trimToNull(e.getPasta())));
        r.setPapelCliente(e.getPapelCliente());
        r.setAudienciaData(e.getAudienciaData());
        r.setAudienciaHora(e.getAudienciaHora());
        r.setAudienciaTipo(Utf8MojibakeUtil.corrigir(trimToNull(e.getAudienciaTipo())));
        r.setAvisoAudiencia(e.getAvisoAudiencia());
        r.setConsultaAutomatica(e.getConsultaAutomatica());
        r.setAtivo(e.getAtivo());
        r.setConsultor(Utf8MojibakeUtil.corrigir(e.getConsultor()));
        if (e.getUsuarioResponsavel() != null) {
            r.setUsuarioResponsavelId(e.getUsuarioResponsavel().getId());
        } else {
            r.setUsuarioResponsavelId(null);
        }
        return r;
    }

    private ProcessoParteResponse toParteResponse(ProcessoParteEntity p) {
        List<Long> advIds = parteAdvogadoRepository.findByProcessoParte_IdOrderByOrdemAscIdAsc(p.getId()).stream()
                .map(x -> x.getAdvogadoPessoa().getId())
                .collect(Collectors.toList());
        return toParteResponse(p, advIds);
    }

    private ProcessoParteResponse toParteResponse(ProcessoParteEntity p, List<Long> advogadoPessoaIds) {
        ProcessoParteResponse r = new ProcessoParteResponse();
        r.setId(p.getId());
        if (p.getPessoa() != null) {
            r.setPessoaId(p.getPessoa().getId());
            r.setNomeExibicao(Utf8MojibakeUtil.corrigir(p.getPessoa().getNome()));
        } else {
            r.setPessoaId(null);
            r.setNomeExibicao(Utf8MojibakeUtil.corrigir(trimToNull(p.getNomeLivre())));
        }
        r.setNomeLivre(Utf8MojibakeUtil.corrigir(p.getNomeLivre()));
        r.setPolo(Utf8MojibakeUtil.corrigir(p.getPolo()));
        r.setQualificacao(Utf8MojibakeUtil.corrigir(p.getQualificacao()));
        r.setOrdem(p.getOrdem());
        r.setAdvogadoPessoaIds(new ArrayList<>(advogadoPessoaIds != null ? advogadoPessoaIds : List.of()));
        return r;
    }

    /** Apelido; se vazio, login (nunca o nome civil completo do cadastro). */
    private static String nomeExibicaoUsuario(UsuarioEntity u) {
        if (u == null) {
            return "";
        }
        String ap = u.getApelido() != null ? u.getApelido().trim() : "";
        if (StringUtils.hasText(ap)) {
            return Utf8MojibakeUtil.corrigir(ap);
        }
        return Utf8MojibakeUtil.corrigir(u.getLogin() != null ? u.getLogin().trim() : "");
    }

    /**
     * @param usuarioResolvido se não nulo, usado para nome/login no DTO; se nulo, usa {@code a.getUsuario()}
     *        (criação/atualização de um único andamento dentro da mesma transação).
     */
    private ProcessoAndamentoResponse toAndamentoResponse(ProcessoAndamentoEntity a, UsuarioEntity usuarioResolvido) {
        ProcessoAndamentoResponse r = new ProcessoAndamentoResponse();
        r.setId(a.getId());
        r.setMovimentoEm(a.getMovimentoEm());
        r.setTitulo(PortuguesTextoCorrecaoUtil.normalizar(a.getTitulo()));
        r.setDetalhe(PortuguesTextoCorrecaoUtil.normalizar(a.getDetalhe()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(a.getOrigem()));
        r.setOrigemAutomatica(a.getOrigemAutomatica());
        UsuarioEntity u = usuarioResolvido != null ? usuarioResolvido : a.getUsuario();
        if (u != null) {
            r.setUsuarioId(u.getId());
            String exibicao = nomeExibicaoUsuario(u);
            String login = StringUtils.hasText(u.getLogin()) ? Utf8MojibakeUtil.corrigir(u.getLogin().trim()) : "";
            r.setUsuarioNome(StringUtils.hasText(exibicao) ? exibicao : null);
            r.setUsuarioLogin(StringUtils.hasText(login) ? login : null);
        } else {
            r.setUsuarioId(null);
            String nomeDetalhe = nomeResponsavelDeDetalhe(a.getTitulo(), a.getDetalhe());
            if (StringUtils.hasText(nomeDetalhe)) {
                r.setUsuarioNome(Utf8MojibakeUtil.corrigir(nomeDetalhe));
            } else {
                r.setUsuarioNome(null);
            }
            r.setUsuarioLogin(null);
        }
        return r;
    }

    /**
     * Import da planilha grava equipa reconhecida em {@code detalhe} sem FK em {@code usuario_id}.
     * Expõe o nome em {@code usuarioNome} para a UI quando o título já está preenchido.
     */
    private static String nomeResponsavelDeDetalhe(String titulo, String detalhe) {
        if (!StringUtils.hasText(titulo) || !StringUtils.hasText(detalhe)) {
            return null;
        }
        String d = detalhe.trim();
        for (String line : d.split("\\r?\\n")) {
            String t = line.trim();
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?i)^\\s*Consultor:\\s*(.+)$")
                    .matcher(t);
            if (m.matches()) {
                return m.group(1).trim();
            }
        }
        java.util.regex.Matcher m2 =
                java.util.regex.Pattern.compile("(?i)Consultor:\\s*([^\\r\\n]+)").matcher(d);
        if (m2.find()) {
            return m2.group(1).trim();
        }
        String[] lines = d.split("\\r?\\n");
        String unica = null;
        int n = 0;
        for (String line : lines) {
            String t = line.trim();
            if (t.isEmpty()) {
                continue;
            }
            n++;
            unica = t;
            if (n > 1) {
                return null;
            }
        }
        if (n != 1 || unica == null) {
            return null;
        }
        if (unica.length() > 120) {
            return null;
        }
        if (unica.matches("(?i)^\\s*Consultor:.*")) {
            return null;
        }
        return unica;
    }

    private ProcessoPrazoResponse toPrazoResponse(ProcessoPrazoEntity z) {
        ProcessoPrazoResponse r = new ProcessoPrazoResponse();
        r.setId(z.getId());
        if (z.getAndamento() != null) {
            r.setAndamentoId(z.getAndamento().getId());
        } else {
            r.setAndamentoId(null);
        }
        r.setDescricao(Utf8MojibakeUtil.corrigir(z.getDescricao()));
        r.setDataInicio(z.getDataInicio());
        r.setDataFim(z.getDataFim());
        r.setPrazoFatal(z.getPrazoFatal());
        r.setStatus(Utf8MojibakeUtil.corrigir(z.getStatus()));
        r.setObservacao(Utf8MojibakeUtil.corrigir(z.getObservacao()));
        return r;
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /**
     * Mesmo critério de {@code aplicarListaPartesApiNaUi} no front (polo não-autor/requerente/cliente;
     * só entradas com {@code pessoa} vinculada para o texto agregado).
     */
    private static String montarTextoParteOpostaListagem(List<ProcessoParteEntity> partes) {
        if (partes == null || partes.isEmpty()) {
            return "";
        }
        List<String> nomesOposta = new ArrayList<>();
        for (ProcessoParteEntity p : partes) {
            String poloNorm = normalizarPoloParaComparacao(p.getPolo());
            boolean alvoCliente = poloNorm.contains("AUTOR")
                    || poloNorm.contains("REQUERENTE")
                    || poloNorm.contains("CLIENTE");
            if (alvoCliente || p.getPessoa() == null) {
                continue;
            }
            PessoaEntity pes = p.getPessoa();
            String nomeApi = "";
            if (StringUtils.hasText(pes.getNome())) {
                nomeApi = Utf8MojibakeUtil.corrigir(pes.getNome().trim());
            }
            if (!StringUtils.hasText(nomeApi) && StringUtils.hasText(p.getNomeLivre())) {
                nomeApi = Utf8MojibakeUtil.corrigir(p.getNomeLivre().trim());
            }
            long pessoaNum = pes.getId();
            String rotulo = StringUtils.hasText(nomeApi)
                    ? nomeApi
                    : ("Pessoa nº " + pessoaNum);
            if (StringUtils.hasText(rotulo)) {
                nomesOposta.add(rotulo);
            }
        }
        return formatarListaComConjuncaoE(nomesOposta);
    }

    private static String normalizarPoloParaComparacao(String polo) {
        if (!StringUtils.hasText(polo)) {
            return "";
        }
        String nfd = Normalizer.normalize(polo.trim(), Normalizer.Form.NFD);
        String semAcentos = nfd.replaceAll("\\p{M}+", "");
        return semAcentos.toUpperCase(Locale.ROOT);
    }

    /** Igual a {@code formatarListaComConjuncaoE} no front (Processos.jsx). */
    private static String formatarListaComConjuncaoE(List<String> itens) {
        List<String> lista = (itens == null ? List.<String>of() : itens).stream()
                .map(s -> s == null ? "" : s.trim())
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());
        if (lista.isEmpty()) {
            return "";
        }
        if (lista.size() == 1) {
            return lista.get(0);
        }
        if (lista.size() == 2) {
            return lista.get(0) + " e " + lista.get(1);
        }
        return String.join(", ", lista.subList(0, lista.size() - 1)) + " e " + lista.get(lista.size() - 1);
    }
}
