package br.com.vilareal.citacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.repository.MovimentacaoMonitoradaRepository;
import br.com.vilareal.citacao.api.dto.*;
import br.com.vilareal.citacao.domain.CitacaoStatus;
import br.com.vilareal.citacao.infrastructure.persistence.entity.CitacaoTentativaEntity;
import br.com.vilareal.citacao.infrastructure.persistence.repository.CitacaoTentativaRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.documento.QualificacaoPessoaUtil;
import br.com.vilareal.pessoa.api.dto.PessoaEnderecoItemResponse;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaEnderecoRepository;
import br.com.vilareal.processo.api.dto.ProcessoAndamentoResponse;
import br.com.vilareal.processo.api.dto.ProcessoAndamentoWriteRequest;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CitacaoApplicationService {

    private static final String ORIGEM_ANDAMENTO_CITACAO = "CITACAO";

    private final CitacaoTentativaRepository tentativaRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final PessoaEnderecoRepository pessoaEnderecoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final ProcessoAndamentoRepository andamentoRepository;
    private final MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository;
    private final PessoaApplicationService pessoaApplicationService;
    private final UsuarioRepository usuarioRepository;

    public CitacaoApplicationService(
            CitacaoTentativaRepository tentativaRepository,
            ProcessoParteRepository processoParteRepository,
            PessoaEnderecoRepository pessoaEnderecoRepository,
            ProcessoApplicationService processoApplicationService,
            ProcessoAndamentoRepository andamentoRepository,
            MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository,
            PessoaApplicationService pessoaApplicationService,
            UsuarioRepository usuarioRepository) {
        this.tentativaRepository = tentativaRepository;
        this.processoParteRepository = processoParteRepository;
        this.pessoaEnderecoRepository = pessoaEnderecoRepository;
        this.processoApplicationService = processoApplicationService;
        this.andamentoRepository = andamentoRepository;
        this.movimentacaoMonitoradaRepository = movimentacaoMonitoradaRepository;
        this.pessoaApplicationService = pessoaApplicationService;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public CitacaoReuPainelResponse painelReu(Long processoId, Long processoParteId) {
        ProcessoParteEntity parte = requireParteReu(processoId, processoParteId);
        if (parte.getPessoa() == null) {
            throw new BusinessRuleException("Parte ré sem pessoa cadastrada — não há endereços para citação.");
        }
        Long pessoaId = parte.getPessoa().getId();

        List<CitacaoTentativaEntity> tentativas =
                tentativaRepository.findByProcessoParteIdComEndereco(processoParteId);
        Set<Long> enderecoIdsTentados = tentativas.stream()
                .map(t -> t.getPessoaEndereco().getId())
                .collect(Collectors.toCollection(HashSet::new));

        List<PessoaEnderecoEntity> todosEnderecos =
                pessoaEnderecoRepository.findByPessoa_IdOrderByNumeroOrdemAsc(pessoaId);

        CitacaoReuPainelResponse resp = new CitacaoReuPainelResponse();
        resp.setProcessoParteId(processoParteId);
        resp.setPessoaId(pessoaId);
        resp.setNomeParte(Utf8MojibakeUtil.corrigir(parte.getPessoa().getNome()));
        resp.setTentados(tentativas.stream().map(this::toTentativaResponse).collect(Collectors.toList()));
        resp.setProximos(todosEnderecos.stream()
                .filter(e -> !enderecoIdsTentados.contains(e.getId()))
                .map(this::toProximoResponse)
                .collect(Collectors.toList()));
        return resp;
    }

    @Transactional
    public CitacaoTentativaResponse solicitar(Long processoId, CitacaoSolicitarRequest req) {
        ProcessoParteEntity parte = requireParteReu(processoId, req.getProcessoParteId());
        if (parte.getPessoa() == null) {
            throw new BusinessRuleException("Parte ré sem pessoa cadastrada.");
        }

        PessoaEnderecoEntity endereco = pessoaEnderecoRepository
                .findByIdWithPessoa(req.getPessoaEnderecoId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Endereço não encontrado: " + req.getPessoaEnderecoId()));
        if (!endereco.getPessoa().getId().equals(parte.getPessoa().getId())) {
            throw new BusinessRuleException("O endereço não pertence à pessoa desta parte ré.");
        }

        if (tentativaRepository
                .findByProcessoParte_IdAndPessoaEndereco_Id(req.getProcessoParteId(), req.getPessoaEnderecoId())
                .isPresent()) {
            throw new IllegalStateException(
                    "Já existe tentativa de citação para este endereço nesta parte do processo.");
        }

        UsuarioEntity usuario = usuarioAtual();

        CitacaoTentativaEntity t = new CitacaoTentativaEntity();
        t.setProcessoParte(parte);
        t.setPessoaEndereco(endereco);
        t.setStatus(CitacaoStatus.SOLICITADO);
        t.setDataSolicitacao(req.getDataSolicitacao());
        t.setMovProjudiSolicitacao(trimToNull(req.getMovProjudiSolicitacao()));
        t.setObservacao(trimToNull(req.getObservacao()));
        t.setUsuario(usuario);

        if (req.getAndamentoSolicitacaoId() != null) {
            ProcessoAndamentoEntity andamento = requireAndamento(processoId, req.getAndamentoSolicitacaoId());
            t.setAndamentoSolicitacao(andamento);
        } else {
            PessoaEnderecoItemResponse enderecoDto = pessoaApplicationService.mapEndereco(endereco);
            String formatado = QualificacaoPessoaUtil.formatarEnderecoParaPeca(enderecoDto);
            ProcessoAndamentoWriteRequest andamentoReq = new ProcessoAndamentoWriteRequest();
            andamentoReq.setMovimentoEm(instantMeioDiaUtc(req.getDataSolicitacao()));
            andamentoReq.setTitulo("Solicitada citação — endereço " + endereco.getNumeroOrdem());
            andamentoReq.setDetalhe(formatado);
            andamentoReq.setOrigem(ORIGEM_ANDAMENTO_CITACAO);
            andamentoReq.setUsuarioId(usuario.getId());
            ProcessoAndamentoResponse criado = processoApplicationService.criarAndamento(processoId, andamentoReq);
            t.setAndamentoSolicitacao(andamentoRepository.getReferenceById(criado.getId()));
        }

        t = tentativaRepository.save(t);
        return toTentativaResponse(
                tentativaRepository.findByIdDetalhado(t.getId()).orElseThrow());
    }

    @Transactional
    public CitacaoTentativaResponse registrarRetorno(Long processoId, CitacaoRegistrarRetornoRequest req) {
        CitacaoTentativaEntity t = requireTentativa(processoId, req.getTentativaId());
        aplicarRetornoNegativoEmEntidade(
                t,
                processoId,
                req.getDataRetorno(),
                Utf8MojibakeUtil.corrigir(req.getMotivoRetorno()),
                trimToNull(req.getMovProjudiRetorno()),
                null,
                req.getAndamentoRetornoId(),
                false);
        tentativaRepository.save(t);
        return toTentativaResponse(
                tentativaRepository.findByIdDetalhado(t.getId()).orElseThrow());
    }

    /**
     * Transição automática (PROJUDI): preenche motivo só se ainda vazio; vincula movimentação monitorada.
     */
    @Transactional
    public void aplicarRetornoNegativoAutomatico(
            Long processoId,
            Long tentativaId,
            LocalDate dataRetorno,
            String motivoRetorno,
            String movProjudiRetorno,
            Long movMonitoradaRetornoId,
            Long andamentoRetornoId) {
        CitacaoTentativaEntity t = requireTentativa(processoId, tentativaId);
        if (movMonitoradaRetornoId != null
                && tentativaRepository.existsByMovMonitoradaRetorno_Id(movMonitoradaRetornoId)) {
            return;
        }
        aplicarRetornoNegativoEmEntidade(
                t,
                processoId,
                dataRetorno,
                Utf8MojibakeUtil.corrigir(motivoRetorno),
                trimToNull(movProjudiRetorno),
                movMonitoradaRetornoId,
                andamentoRetornoId,
                true);
        tentativaRepository.save(t);
    }

    private void aplicarRetornoNegativoEmEntidade(
            CitacaoTentativaEntity t,
            Long processoId,
            LocalDate dataRetorno,
            String motivoRetorno,
            String movProjudiRetorno,
            Long movMonitoradaRetornoId,
            Long andamentoRetornoId,
            boolean motivoSomenteSeVazio) {
        if (!CitacaoStatus.SOLICITADO.equals(t.getStatus())) {
            throw new BusinessRuleException("Só é possível registrar retorno de tentativa com status SOLICITADO.");
        }
        t.setStatus(CitacaoStatus.NEGATIVO);
        t.setDataRetorno(dataRetorno);
        if (motivoSomenteSeVazio) {
            if (!StringUtils.hasText(t.getMotivoRetorno()) && StringUtils.hasText(motivoRetorno)) {
                t.setMotivoRetorno(motivoRetorno);
            }
        } else {
            t.setMotivoRetorno(motivoRetorno);
        }
        if (StringUtils.hasText(movProjudiRetorno)) {
            t.setMovProjudiRetorno(movProjudiRetorno);
        }
        if (movMonitoradaRetornoId != null) {
            t.setMovMonitoradaRetorno(movimentacaoMonitoradaRepository.getReferenceById(movMonitoradaRetornoId));
        }
        if (andamentoRetornoId != null) {
            t.setAndamentoRetorno(requireAndamento(processoId, andamentoRetornoId));
        }
    }

    @Transactional
    public CitacaoTentativaResponse registrarPositivo(Long processoId, CitacaoRegistrarPositivoRequest req) {
        CitacaoTentativaEntity t = requireTentativa(processoId, req.getTentativaId());
        if (!CitacaoStatus.SOLICITADO.equals(t.getStatus())) {
            throw new BusinessRuleException("Só é possível marcar como citado uma tentativa SOLICITADO.");
        }
        t.setStatus(CitacaoStatus.POSITIVO);
        t.setDataRetorno(req.getDataRetorno() != null ? req.getDataRetorno() : LocalDate.now());
        tentativaRepository.save(t);
        return toTentativaResponse(
                tentativaRepository.findByIdDetalhado(t.getId()).orElseThrow());
    }

    @Transactional
    public void excluirTentativa(Long processoId, Long tentativaId) {
        CitacaoTentativaEntity t = requireTentativa(processoId, tentativaId);
        ProcessoAndamentoEntity andamentoAuto = t.getAndamentoSolicitacao();
        Long andamentoAutoId = andamentoAuto != null ? andamentoAuto.getId() : null;
        String origemAndamento =
                andamentoAuto != null && andamentoAuto.getOrigem() != null
                        ? andamentoAuto.getOrigem().trim()
                        : null;

        tentativaRepository.delete(t);

        if (andamentoAutoId != null && ORIGEM_ANDAMENTO_CITACAO.equals(origemAndamento)) {
            processoApplicationService.excluirAndamento(processoId, andamentoAutoId);
        }
    }

    private ProcessoParteEntity requireParteReu(Long processoId, Long processoParteId) {
        ProcessoParteEntity parte = processoParteRepository
                .findById(processoParteId)
                .orElseThrow(() -> new ResourceNotFoundException("Parte não encontrada: " + processoParteId));
        if (!parte.getProcesso().getId().equals(processoId)) {
            throw new BusinessRuleException("A parte não pertence a este processo.");
        }
        String polo = parte.getPolo() != null ? parte.getPolo().trim().toUpperCase() : "";
        if (!polo.equals("REU")) {
            throw new BusinessRuleException("A parte informada não está no polo RÉU.");
        }
        return parte;
    }

    private CitacaoTentativaEntity requireTentativa(Long processoId, Long tentativaId) {
        CitacaoTentativaEntity t = tentativaRepository
                .findByIdDetalhado(tentativaId)
                .orElseThrow(() -> new ResourceNotFoundException("Tentativa não encontrada: " + tentativaId));
        if (!t.getProcessoParte().getProcesso().getId().equals(processoId)) {
            throw new BusinessRuleException("A tentativa não pertence a este processo.");
        }
        return t;
    }

    private ProcessoAndamentoEntity requireAndamento(Long processoId, Long andamentoId) {
        ProcessoAndamentoEntity a = andamentoRepository
                .findById(andamentoId)
                .orElseThrow(() -> new ResourceNotFoundException("Andamento não encontrado: " + andamentoId));
        if (!a.getProcesso().getId().equals(processoId)) {
            throw new BusinessRuleException("O andamento não pertence a este processo.");
        }
        return a;
    }

    private UsuarioEntity usuarioAtual() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated()) {
            throw new BusinessRuleException("Usuário não autenticado.");
        }
        return usuarioRepository
                .findWithPerfilByLoginIgnoreCase(a.getName())
                .orElseThrow(() -> new BusinessRuleException("Usuário não encontrado."));
    }

    private static Instant instantMeioDiaUtc(LocalDate data) {
        LocalDate d = data != null ? data : LocalDate.now();
        return d.atTime(12, 0).toInstant(ZoneOffset.UTC);
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        return s.trim();
    }

    private CitacaoTentativaResponse toTentativaResponse(CitacaoTentativaEntity t) {
        CitacaoTentativaResponse r = new CitacaoTentativaResponse();
        r.setId(t.getId());
        r.setProcessoParteId(t.getProcessoParte().getId());
        r.setPessoaEnderecoId(t.getPessoaEndereco().getId());
        r.setStatus(t.getStatus());
        r.setDataSolicitacao(t.getDataSolicitacao());
        if (t.getAndamentoSolicitacao() != null) {
            r.setAndamentoSolicitacaoId(t.getAndamentoSolicitacao().getId());
        }
        r.setMovProjudiSolicitacao(t.getMovProjudiSolicitacao());
        if (t.getMovMonitoradaSolicitacao() != null) {
            r.setMovMonitoradaSolicitacaoId(t.getMovMonitoradaSolicitacao().getId());
        }
        r.setDataRetorno(t.getDataRetorno());
        if (t.getAndamentoRetorno() != null) {
            r.setAndamentoRetornoId(t.getAndamentoRetorno().getId());
        }
        r.setMovProjudiRetorno(t.getMovProjudiRetorno());
        if (t.getMovMonitoradaRetorno() != null) {
            r.setMovMonitoradaRetornoId(t.getMovMonitoradaRetorno().getId());
        }
        r.setMotivoRetorno(Utf8MojibakeUtil.corrigir(t.getMotivoRetorno()));
        r.setObservacao(Utf8MojibakeUtil.corrigir(t.getObservacao()));
        if (t.getUsuario() != null) {
            r.setUsuarioId(t.getUsuario().getId());
        }
        PessoaEnderecoItemResponse endereco = pessoaApplicationService.mapEndereco(t.getPessoaEndereco());
        r.setEndereco(endereco);
        return r;
    }

    private CitacaoEnderecoProximoResponse toProximoResponse(PessoaEnderecoEntity e) {
        PessoaEnderecoItemResponse dto = pessoaApplicationService.mapEndereco(e);
        CitacaoEnderecoProximoResponse r = new CitacaoEnderecoProximoResponse();
        r.setPessoaEnderecoId(e.getId());
        r.setNumeroOrdem(e.getNumeroOrdem());
        r.setEndereco(dto);
        r.setEnderecoFormatado(QualificacaoPessoaUtil.formatarEnderecoParaPeca(dto));
        return r;
    }
}
