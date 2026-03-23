package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.PublicacaoRequest;
import br.com.vilareal.api.dto.PublicacaoResponse;
import br.com.vilareal.api.dto.PublicacaoStatusPatchRequest;
import br.com.vilareal.api.dto.PublicacaoVinculoProcessoPatchRequest;
import br.com.vilareal.api.entity.*;
import br.com.vilareal.api.entity.enums.PublicacaoAcaoTratamento;
import br.com.vilareal.api.entity.enums.PublicacaoOrigemImportacao;
import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.*;
import br.com.vilareal.api.service.PublicacaoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class PublicacaoServiceImpl implements PublicacaoService {
    private final PublicacaoRepository publicacaoRepository;
    private final PublicacaoTratamentoRepository tratamentoRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioRepository usuarioRepository;
    private final MonitoringHitRepository monitoringHitRepository;

    public PublicacaoServiceImpl(
            PublicacaoRepository publicacaoRepository,
            PublicacaoTratamentoRepository tratamentoRepository,
            ProcessoRepository processoRepository,
            ClienteRepository clienteRepository,
            UsuarioRepository usuarioRepository,
            MonitoringHitRepository monitoringHitRepository
    ) {
        this.publicacaoRepository = publicacaoRepository;
        this.tratamentoRepository = tratamentoRepository;
        this.processoRepository = processoRepository;
        this.clienteRepository = clienteRepository;
        this.usuarioRepository = usuarioRepository;
        this.monitoringHitRepository = monitoringHitRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PublicacaoResponse> listar(
            LocalDate dataInicio,
            LocalDate dataFim,
            PublicacaoStatusTratamento status,
            Long processoId,
            Long clienteId,
            String texto,
            PublicacaoOrigemImportacao origemImportacao
    ) {
        return publicacaoRepository.findAllFiltered(
                dataInicio, dataFim, status, processoId, clienteId, trimOrNull(texto), origemImportacao
        ).stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PublicacaoResponse buscar(Long id) {
        return toResponse(getPublicacaoOrFail(id));
    }

    @Override
    @Transactional
    public PublicacaoResponse criar(PublicacaoRequest request) {
        Publicacao p = new Publicacao();
        apply(p, request, null);
        Publicacao saved = publicacaoRepository.save(p);
        registrarTratamento(saved, null, saved.getStatusTratamento(), PublicacaoAcaoTratamento.STATUS, "Criação da publicação.", saved.getUsuarioResponsavel(), null);
        return toResponse(saved);
    }

    @Override
    @Transactional
    public PublicacaoResponse atualizar(Long id, PublicacaoRequest request) {
        Publicacao p = getPublicacaoOrFail(id);
        PublicacaoStatusTratamento statusAnterior = p.getStatusTratamento();
        apply(p, request, id);
        Publicacao saved = publicacaoRepository.save(p);
        if (statusAnterior != saved.getStatusTratamento()) {
            registrarTratamento(saved, statusAnterior, saved.getStatusTratamento(), PublicacaoAcaoTratamento.STATUS, "Status alterado na atualização.", saved.getUsuarioResponsavel(), null);
        }
        return toResponse(saved);
    }

    @Override
    @Transactional
    public PublicacaoResponse alterarStatus(Long id, PublicacaoStatusPatchRequest request) {
        Publicacao p = getPublicacaoOrFail(id);
        PublicacaoStatusTratamento anterior = p.getStatusTratamento();
        p.setStatusTratamento(request.getStatus());
        aplicarDatasPorStatus(p, request.getStatus());
        if (trimOrNull(request.getObservacao()) != null) p.setObservacao(trimOrNull(request.getObservacao()));
        Usuario usuario = getUsuarioIfPresent(request.getUsuarioId());
        if (usuario != null) p.setUsuarioResponsavel(usuario);
        Publicacao saved = publicacaoRepository.save(p);
        registrarTratamento(saved, anterior, saved.getStatusTratamento(), PublicacaoAcaoTratamento.STATUS, trimOrNull(request.getObservacao()), usuario, null);
        return toResponse(saved);
    }

    @Override
    @Transactional
    public PublicacaoResponse vincularProcesso(Long id, PublicacaoVinculoProcessoPatchRequest request) {
        Publicacao p = getPublicacaoOrFail(id);
        PublicacaoStatusTratamento anterior = p.getStatusTratamento();
        Processo processo = null;
        if (request.getProcessoId() != null) {
            processo = processoRepository.findById(request.getProcessoId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + request.getProcessoId()));
        }
        p.setProcesso(processo);
        p.setCliente(processo != null ? processo.getCliente() : null);
        if (processo != null && p.getStatusTratamento() == PublicacaoStatusTratamento.PENDENTE) {
            p.setStatusTratamento(PublicacaoStatusTratamento.VINCULADA);
        }
        Usuario usuario = getUsuarioIfPresent(request.getUsuarioId());
        if (usuario != null) p.setUsuarioResponsavel(usuario);
        if (trimOrNull(request.getObservacao()) != null) p.setObservacao(trimOrNull(request.getObservacao()));
        Publicacao saved = publicacaoRepository.save(p);
        registrarTratamento(
                saved,
                anterior,
                saved.getStatusTratamento(),
                PublicacaoAcaoTratamento.VINCULO_PROCESSO,
                trimOrNull(request.getObservacao()),
                usuario,
                processo
        );
        return toResponse(saved);
    }

    @Override
    @Transactional
    public void excluir(Long id) {
        Publicacao p = getPublicacaoOrFail(id);
        publicacaoRepository.delete(p);
    }

    private void apply(Publicacao p, PublicacaoRequest r, Long idAtualizacao) {
        Processo processo = getProcessoIfPresent(r.getProcessoId());
        Cliente cliente = getClienteIfPresent(r.getClienteId());
        if (processo != null && cliente != null && !processo.getCliente().getId().equals(cliente.getId())) {
            throw new RegraNegocioException("Processo informado não pertence ao cliente informado.");
        }
        if (processo != null && cliente == null) cliente = processo.getCliente();
        Usuario usuario = getUsuarioIfPresent(r.getUsuarioResponsavelId());
        MonitoringHit hit = getMonitoringHitIfPresent(r.getMonitoringHitId());

        p.setNumeroProcessoEncontrado(trimOrNull(r.getNumeroProcessoEncontrado()));
        p.setProcesso(processo);
        p.setCliente(cliente);
        p.setUsuarioResponsavel(usuario);
        p.setMonitoringHit(hit);
        p.setDataDisponibilizacao(r.getDataDisponibilizacao());
        p.setDataPublicacao(r.getDataPublicacao());
        p.setFonte(trimOrNull(r.getFonte()));
        p.setDiario(trimOrNull(r.getDiario()));
        p.setEdicao(trimOrNull(r.getEdicao()));
        p.setCaderno(trimOrNull(r.getCaderno()));
        p.setPagina(trimOrNull(r.getPagina()));
        p.setTitulo(trimOrNull(r.getTitulo()));
        p.setTipoPublicacao(trimOrNull(r.getTipoPublicacao()));
        p.setResumo(trimOrNull(r.getResumo()));
        p.setTeor(trimOrNull(r.getTeor()));
        p.setStatusValidacaoCnj(trimOrNull(r.getStatusValidacaoCnj()));
        p.setScoreConfianca(trimOrNull(r.getScoreConfianca()));
        p.setHashTeor(trimOrNull(r.getHashTeor()));
        p.setOrigemImportacao(r.getOrigemImportacao() != null ? r.getOrigemImportacao() : PublicacaoOrigemImportacao.MANUAL);
        p.setArquivoOrigemNome(trimOrNull(r.getArquivoOrigemNome()));
        p.setArquivoOrigemHash(trimOrNull(r.getArquivoOrigemHash()));
        p.setJsonReferencia(trimOrNull(r.getJsonReferencia()));
        p.setObservacao(trimOrNull(r.getObservacao()));
        p.setLida(r.getLida() != null ? r.getLida() : Boolean.FALSE);

        PublicacaoStatusTratamento status = r.getStatusTratamento() != null ? r.getStatusTratamento() : p.getStatusTratamento();
        p.setStatusTratamento(status != null ? status : PublicacaoStatusTratamento.PENDENTE);
        if (Boolean.TRUE.equals(p.getLida()) && p.getLidaEm() == null) {
            p.setLidaEm(LocalDateTime.now());
        }
        aplicarDatasPorStatus(p, p.getStatusTratamento());

        String hashConteudo = trimOrNull(r.getHashConteudo());
        if (hashConteudo == null) {
            hashConteudo = gerarHashConteudo(
                    p.getNumeroProcessoEncontrado(),
                    p.getDataPublicacao(),
                    p.getHashTeor(),
                    p.getTeor()
            );
        }
        p.setHashConteudo(hashConteudo);
        validarDuplicidadeHash(p.getHashConteudo(), idAtualizacao);
    }

    private void validarDuplicidadeHash(String hashConteudo, Long idAtualizacao) {
        boolean exists = idAtualizacao == null
                ? publicacaoRepository.existsByHashConteudo(hashConteudo)
                : publicacaoRepository.existsByHashConteudoAndIdNot(hashConteudo, idAtualizacao);
        if (exists) {
            throw new RegraNegocioException("Já existe publicação com a mesma chave técnica de deduplicação.");
        }
    }

    private void aplicarDatasPorStatus(Publicacao p, PublicacaoStatusTratamento status) {
        LocalDateTime agora = LocalDateTime.now();
        if (status == PublicacaoStatusTratamento.TRATADA && p.getTratadaEm() == null) p.setTratadaEm(agora);
        if (status == PublicacaoStatusTratamento.IGNORADA && p.getIgnoradaEm() == null) p.setIgnoradaEm(agora);
        if (status == PublicacaoStatusTratamento.VINCULADA && p.getLidaEm() == null) p.setLidaEm(agora);
    }

    private void registrarTratamento(
            Publicacao publicacao,
            PublicacaoStatusTratamento anterior,
            PublicacaoStatusTratamento novo,
            PublicacaoAcaoTratamento acao,
            String descricao,
            Usuario usuario,
            Processo processo
    ) {
        PublicacaoTratamento t = new PublicacaoTratamento();
        t.setPublicacao(publicacao);
        t.setStatusAnterior(anterior);
        t.setStatusNovo(novo);
        t.setAcao(acao);
        t.setDescricao(trimOrNull(descricao));
        t.setUsuario(usuario);
        t.setProcesso(processo != null ? processo : publicacao.getProcesso());
        t.setCliente(publicacao.getCliente());
        tratamentoRepository.save(t);
    }

    private Publicacao getPublicacaoOrFail(Long id) {
        return publicacaoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Publicação não encontrada: " + id));
    }

    private Processo getProcessoIfPresent(Long id) {
        if (id == null) return null;
        return processoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + id));
    }

    private Cliente getClienteIfPresent(Long id) {
        if (id == null) return null;
        return clienteRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Cliente não encontrado: " + id));
    }

    private Usuario getUsuarioIfPresent(Long id) {
        if (id == null) return null;
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
    }

    private MonitoringHit getMonitoringHitIfPresent(Long id) {
        if (id == null) return null;
        return monitoringHitRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Monitoring hit não encontrado: " + id));
    }

    private PublicacaoResponse toResponse(Publicacao p) {
        PublicacaoResponse o = new PublicacaoResponse();
        o.setId(p.getId());
        o.setNumeroProcessoEncontrado(p.getNumeroProcessoEncontrado());
        o.setProcessoId(p.getProcesso() != null ? p.getProcesso().getId() : null);
        o.setClienteId(p.getCliente() != null ? p.getCliente().getId() : null);
        o.setUsuarioResponsavelId(p.getUsuarioResponsavel() != null ? p.getUsuarioResponsavel().getId() : null);
        o.setMonitoringHitId(p.getMonitoringHit() != null ? p.getMonitoringHit().getId() : null);
        o.setDataDisponibilizacao(p.getDataDisponibilizacao());
        o.setDataPublicacao(p.getDataPublicacao());
        o.setFonte(p.getFonte());
        o.setDiario(p.getDiario());
        o.setEdicao(p.getEdicao());
        o.setCaderno(p.getCaderno());
        o.setPagina(p.getPagina());
        o.setTitulo(p.getTitulo());
        o.setTipoPublicacao(p.getTipoPublicacao());
        o.setResumo(p.getResumo());
        o.setTeor(p.getTeor());
        o.setStatusValidacaoCnj(p.getStatusValidacaoCnj());
        o.setScoreConfianca(p.getScoreConfianca());
        o.setHashTeor(p.getHashTeor());
        o.setHashConteudo(p.getHashConteudo());
        o.setOrigemImportacao(p.getOrigemImportacao());
        o.setArquivoOrigemNome(p.getArquivoOrigemNome());
        o.setArquivoOrigemHash(p.getArquivoOrigemHash());
        o.setJsonReferencia(p.getJsonReferencia());
        o.setStatusTratamento(p.getStatusTratamento());
        o.setLida(p.getLida());
        o.setLidaEm(p.getLidaEm());
        o.setTratadaEm(p.getTratadaEm());
        o.setIgnoradaEm(p.getIgnoradaEm());
        o.setObservacao(p.getObservacao());
        o.setCreatedAt(p.getCreatedAt());
        o.setUpdatedAt(p.getUpdatedAt());
        return o;
    }

    private String gerarHashConteudo(String numeroProcesso, LocalDate dataPublicacao, String hashTeor, String teor) {
        String payload = String.join("|",
                safe(numeroProcesso),
                dataPublicacao != null ? dataPublicacao.toString() : "",
                safe(hashTeor),
                safe(teor).substring(0, Math.min(safe(teor).length(), 500))
        ).toLowerCase(Locale.ROOT);
        return sha256(payload);
    }

    private static String safe(String s) {
        return s == null ? "" : s.trim();
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (Exception e) {
            throw new RegraNegocioException("Falha ao calcular hash técnico da publicação.");
        }
    }
}
