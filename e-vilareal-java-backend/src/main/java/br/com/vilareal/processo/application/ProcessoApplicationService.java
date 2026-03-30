package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.importacao.PlanilhaPasta1MapeamentoUtil;
import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import br.com.vilareal.pessoa.api.dto.ClienteListItemResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.*;
import br.com.vilareal.processo.infrastructure.persistence.entity.*;
import br.com.vilareal.processo.infrastructure.persistence.repository.*;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProcessoApplicationService {

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
            ClienteRepository clienteRepository) {
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
    }

    /**
     * Lista códigos de cliente para a UI.
     *
     * <p>Se existir ao menos um registro em {@code planilha_pasta1_cliente} (import Pasta1), a lista
     * contém <strong>só</strong> esses vínculos: código na coluna A (normalizado em 8 dígitos) → pessoa
     * da coluna B. Não se assume mais “cliente N = pessoa N”.
     *
     * <p>Sem dados na planilha, lista a tabela {@code cliente} (Flyway V34): uma linha por registro de
     * cliente, em geral canônico {@code codigoCliente = formatar(pessoa.id)} e aliases vindos de import.
     */
    @Transactional(readOnly = true)
    public List<ClienteListItemResponse> listarClientesResumo() {
        Map<String, ClienteListItemResponse> porCodigo = new LinkedHashMap<>();
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
                                                p.getId(),
                                                cod8,
                                                Utf8MojibakeUtil.corrigir(p.getNome()),
                                                somenteDigitosDocumento(p.getCpf()))));
            }
        } else {
            for (var c : clienteRepository.findAllFetchPessoaOrderByCodigo()) {
                PessoaEntity p = c.getPessoa();
                String nome =
                        StringUtils.hasText(c.getNomeReferencia())
                                ? c.getNomeReferencia()
                                : p.getNome();
                String doc =
                        StringUtils.hasText(c.getDocumentoReferencia())
                                ? somenteDigitosDocumento(c.getDocumentoReferencia())
                                : somenteDigitosDocumento(p.getCpf());
                porCodigo.put(
                        c.getCodigoCliente(),
                        new ClienteListItemResponse(
                                p.getId(),
                                c.getCodigoCliente(),
                                Utf8MojibakeUtil.corrigir(nome),
                                doc));
            }
        }
        return porCodigo.values().stream()
                .sorted(Comparator.comparing(ClienteListItemResponse::getCodigoCliente))
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
        Optional<Long> pessoaOpt;
        if (clienteCodigoPessoaResolver.haMapeamentosPlanilhaPasta1()) {
            pessoaOpt = clienteCodigoPessoaResolver.resolverPessoaIdSomentePlanilha(trimmed);
        } else {
            try {
                pessoaOpt = Optional.of(clienteCodigoPessoaResolver.resolverPessoaId(trimmed));
            } catch (BusinessRuleException e) {
                pessoaOpt = Optional.empty();
            }
        }
        return pessoaOpt.flatMap(
                pid -> pessoaRepository
                        .findById(pid)
                        .map(
                                p -> new ClienteListItemResponse(
                                        p.getId(),
                                        cod8,
                                        Utf8MojibakeUtil.corrigir(p.getNome()),
                                        somenteDigitosDocumento(p.getCpf()))));
    }

    @Transactional(readOnly = true)
    public List<ProcessoResponse> listarPorCodigoCliente(String codigoCliente) {
        long pessoaId;
        if (clienteCodigoPessoaResolver.haMapeamentosPlanilhaPasta1()) {
            Optional<Long> opt = clienteCodigoPessoaResolver.resolverPessoaIdSomentePlanilha(codigoCliente);
            if (opt.isEmpty() || !pessoaRepository.existsById(opt.get())) {
                return List.of();
            }
            pessoaId = opt.get();
        } else {
            pessoaId = clienteCodigoPessoaResolver.resolverPessoaId(codigoCliente);
            if (!pessoaRepository.existsById(pessoaId)) {
                return List.of();
            }
        }
        return processoRepository.findByPessoa_IdOrderByNumeroInternoAsc(pessoaId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProcessoResponse buscar(Long id) {
        ProcessoEntity e = requireProcesso(id);
        e.getPessoa().getNome();
        return toResponse(e);
    }

    @Transactional
    public ProcessoResponse criar(ProcessoWriteRequest req) {
        PessoaEntity pessoa = pessoaRepository.findById(req.getClienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + req.getClienteId()));
        processoRepository
                .findByPessoa_IdAndNumeroInterno(req.getClienteId(), req.getNumeroInterno())
                .ifPresent(x -> {
                    throw new BusinessRuleException("Já existe processo com este número interno para o cliente.");
                });
        ProcessoEntity e = new ProcessoEntity();
        e.setPessoa(pessoa);
        aplicarCabecalho(e, req);
        e = processoRepository.save(e);
        return toResponse(requireProcesso(e.getId()));
    }

    @Transactional
    public ProcessoResponse atualizar(Long id, ProcessoWriteRequest req) {
        ProcessoEntity e = requireProcesso(id);
        PessoaEntity pessoa = pessoaRepository.findById(req.getClienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + req.getClienteId()));
        if (!pessoa.getId().equals(e.getPessoa().getId())
                || !req.getNumeroInterno().equals(e.getNumeroInterno())) {
            processoRepository
                    .findByPessoa_IdAndNumeroInterno(req.getClienteId(), req.getNumeroInterno())
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(x -> {
                        throw new BusinessRuleException("Já existe processo com este número interno para o cliente.");
                    });
        }
        e.setPessoa(pessoa);
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
        return parteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId).stream()
                .map(this::toParteResponse)
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
        return toParteResponse(requireParte(processoId, parteId));
    }

    @Transactional
    public void excluirParte(Long processoId, Long parteId) {
        ProcessoParteEntity p = requireParte(processoId, parteId);
        parteRepository.delete(p);
    }

    @Transactional(readOnly = true)
    public List<ProcessoAndamentoResponse> listarAndamentos(Long processoId) {
        requireProcesso(processoId);
        return andamentoRepository.findByProcesso_IdOrderByMovimentoEmDescIdDesc(processoId).stream()
                .map(this::toAndamentoResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProcessoAndamentoResponse criarAndamento(Long processoId, ProcessoAndamentoWriteRequest req) {
        ProcessoEntity proc = requireProcesso(processoId);
        ProcessoAndamentoEntity a = new ProcessoAndamentoEntity();
        a.setProcesso(proc);
        aplicarAndamento(a, req);
        a = andamentoRepository.save(a);
        return toAndamentoResponse(andamentoRepository.findById(a.getId()).orElseThrow());
    }

    @Transactional
    public ProcessoAndamentoResponse atualizarAndamento(
            Long processoId, Long andamentoId, ProcessoAndamentoWriteRequest req) {
        ProcessoAndamentoEntity a = requireAndamento(processoId, andamentoId);
        aplicarAndamento(a, req);
        andamentoRepository.save(a);
        return toAndamentoResponse(requireAndamento(processoId, andamentoId));
    }

    @Transactional
    public void excluirAndamento(Long processoId, Long andamentoId) {
        ProcessoAndamentoEntity a = requireAndamento(processoId, andamentoId);
        andamentoRepository.delete(a);
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

    private void aplicarCabecalho(ProcessoEntity e, ProcessoWriteRequest req) {
        e.setNumeroInterno(req.getNumeroInterno());
        e.setNumeroCnj(trimToNull(req.getNumeroCnj()));
        e.setNumeroProcessoAntigo(trimToNull(req.getNumeroProcessoAntigo()));
        e.setNaturezaAcao(trimToNull(req.getNaturezaAcao()));
        e.setDescricaoAcao(trimToNull(req.getDescricaoAcao()));
        e.setCompetencia(trimToNull(req.getCompetencia()));
        e.setFase(trimToNull(req.getFase()));
        e.setStatus(trimToNull(req.getStatus()));
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

    private ProcessoResponse toResponse(ProcessoEntity e) {
        Long pessoaId = e.getPessoa().getId();
        ProcessoResponse r = new ProcessoResponse();
        r.setId(e.getId());
        r.setClienteId(pessoaId);
        r.setCodigoCliente(CodigoClienteUtil.formatar(pessoaId));
        r.setNumeroInterno(e.getNumeroInterno());
        r.setNumeroCnj(Utf8MojibakeUtil.corrigir(e.getNumeroCnj()));
        r.setNumeroProcessoAntigo(Utf8MojibakeUtil.corrigir(e.getNumeroProcessoAntigo()));
        r.setNaturezaAcao(Utf8MojibakeUtil.corrigir(e.getNaturezaAcao()));
        r.setDescricaoAcao(Utf8MojibakeUtil.corrigir(e.getDescricaoAcao()));
        r.setCompetencia(Utf8MojibakeUtil.corrigir(e.getCompetencia()));
        r.setFase(Utf8MojibakeUtil.corrigir(e.getFase()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setTramitacao(Utf8MojibakeUtil.corrigir(e.getTramitacao()));
        r.setDataProtocolo(e.getDataProtocolo());
        r.setPrazoFatal(e.getPrazoFatal());
        r.setProximaConsulta(e.getProximaConsulta());
        r.setObservacao(Utf8MojibakeUtil.corrigir(e.getObservacao()));
        r.setValorCausa(e.getValorCausa());
        r.setUf(e.getUf());
        r.setCidade(Utf8MojibakeUtil.corrigir(e.getCidade()));
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
        List<Long> advIds = parteAdvogadoRepository.findByProcessoParte_IdOrderByOrdemAscIdAsc(p.getId()).stream()
                .map(x -> x.getAdvogadoPessoa().getId())
                .collect(Collectors.toList());
        r.setAdvogadoPessoaIds(new ArrayList<>(advIds));
        return r;
    }

    private ProcessoAndamentoResponse toAndamentoResponse(ProcessoAndamentoEntity a) {
        ProcessoAndamentoResponse r = new ProcessoAndamentoResponse();
        r.setId(a.getId());
        r.setMovimentoEm(a.getMovimentoEm());
        r.setTitulo(Utf8MojibakeUtil.corrigir(a.getTitulo()));
        r.setDetalhe(Utf8MojibakeUtil.corrigir(a.getDetalhe()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(a.getOrigem()));
        r.setOrigemAutomatica(a.getOrigemAutomatica());
        if (a.getUsuario() != null) {
            r.setUsuarioId(a.getUsuario().getId());
        } else {
            r.setUsuarioId(null);
        }
        return r;
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
}
