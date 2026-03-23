package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ProcessoRequest;
import br.com.vilareal.api.dto.ProcessoResponse;
import br.com.vilareal.api.entity.Cliente;
import br.com.vilareal.api.entity.Processo;
import br.com.vilareal.api.entity.Usuario;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.ClienteRepository;
import br.com.vilareal.api.repository.ProcessoRepository;
import br.com.vilareal.api.repository.UsuarioRepository;
import br.com.vilareal.api.service.ProcessoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProcessoServiceImpl implements ProcessoService {
    private final ProcessoRepository processoRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioRepository usuarioRepository;

    public ProcessoServiceImpl(ProcessoRepository processoRepository,
                                 ClienteRepository clienteRepository,
                                 UsuarioRepository usuarioRepository) {
        this.processoRepository = processoRepository;
        this.clienteRepository = clienteRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProcessoResponse> listar(Long clienteId, String codigoCliente, Boolean ativo) {
        Long cid = clienteId;
        if (codigoCliente != null && !codigoCliente.isBlank()) {
            String norm = normalizarCodigoCliente(codigoCliente);
            cid = clienteRepository.findByCodigoCliente(norm)
                    .map(Cliente::getId)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Cliente não encontrado para código: " + norm));
        }
        return processoRepository.findAllFiltered(cid, ativo).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ProcessoResponse buscar(Long id) {
        return toResponse(processoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + id)));
    }

    @Override
    @Transactional
    public ProcessoResponse criar(ProcessoRequest request) {
        Cliente cliente = clienteRepository.findById(request.getClienteId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Cliente não encontrado: " + request.getClienteId()));
        if (processoRepository.existsByClienteIdAndNumeroInterno(cliente.getId(), request.getNumeroInterno())) {
            throw new RegraNegocioException("Já existe processo com este número interno para este cliente.");
        }
        Processo p = new Processo();
        p.setCliente(cliente);
        apply(p, request, true);
        return toResponse(processoRepository.save(p));
    }

    @Override
    @Transactional
    public ProcessoResponse atualizar(Long id, ProcessoRequest request) {
        Processo p = processoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + id));
        Cliente cliente = clienteRepository.findById(request.getClienteId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Cliente não encontrado: " + request.getClienteId()));
        if (processoRepository.existsByClienteIdAndNumeroInternoAndIdNot(
                cliente.getId(), request.getNumeroInterno(), id)) {
            throw new RegraNegocioException("Já existe processo com este número interno para este cliente.");
        }
        p.setCliente(cliente);
        apply(p, request, false);
        return toResponse(processoRepository.save(p));
    }

    @Override
    @Transactional
    public ProcessoResponse alterarAtivo(Long id, boolean ativo) {
        Processo p = processoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + id));
        p.setAtivo(ativo);
        return toResponse(processoRepository.save(p));
    }

    private void apply(Processo p, ProcessoRequest r, boolean isCreate) {
        p.setNumeroInterno(r.getNumeroInterno());
        p.setNumeroCnj(trimOrNull(r.getNumeroCnj()));
        p.setNumeroProcessoAntigo(trimOrNull(r.getNumeroProcessoAntigo()));
        p.setDescricaoAcao(trimOrNull(r.getDescricaoAcao()));
        p.setNaturezaAcao(trimOrNull(r.getNaturezaAcao()));
        p.setCompetencia(trimOrNull(r.getCompetencia()));
        p.setFase(trimOrNull(r.getFase()));
        p.setStatus(trimOrNull(r.getStatus()));
        p.setTramitacao(trimOrNull(r.getTramitacao()));
        p.setDataProtocolo(r.getDataProtocolo());
        p.setPrazoFatal(r.getPrazoFatal());
        p.setProximaConsulta(r.getProximaConsulta());
        p.setObservacao(trimOrNull(r.getObservacao()));
        p.setValorCausa(r.getValorCausa());
        p.setUf(trimUf(r.getUf()));
        p.setCidade(trimOrNull(r.getCidade()));
        p.setComarca(trimOrNull(r.getComarca()));
        p.setVara(trimOrNull(r.getVara()));
        p.setTribunal(trimOrNull(r.getTribunal()));
        p.setConsultaAutomatica(r.getConsultaAutomatica() != null ? r.getConsultaAutomatica() : false);
        if (r.getAtivo() != null) {
            p.setAtivo(r.getAtivo());
        } else if (isCreate) {
            p.setAtivo(true);
        }
        if (r.getUsuarioResponsavelId() != null) {
            Usuario u = usuarioRepository.findById(r.getUsuarioResponsavelId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + r.getUsuarioResponsavelId()));
            p.setUsuarioResponsavel(u);
        } else {
            p.setUsuarioResponsavel(null);
        }
        p.setConsultor(trimOrNull(r.getConsultor()));
    }

    private ProcessoResponse toResponse(Processo p) {
        ProcessoResponse o = new ProcessoResponse();
        o.setId(p.getId());
        o.setClienteId(p.getCliente().getId());
        o.setCodigoCliente(p.getCliente().getCodigoCliente());
        o.setNumeroInterno(p.getNumeroInterno());
        o.setNumeroCnj(p.getNumeroCnj());
        o.setNumeroProcessoAntigo(p.getNumeroProcessoAntigo());
        o.setDescricaoAcao(p.getDescricaoAcao());
        o.setNaturezaAcao(p.getNaturezaAcao());
        o.setCompetencia(p.getCompetencia());
        o.setFase(p.getFase());
        o.setStatus(p.getStatus());
        o.setTramitacao(p.getTramitacao());
        o.setDataProtocolo(p.getDataProtocolo());
        o.setPrazoFatal(p.getPrazoFatal());
        o.setProximaConsulta(p.getProximaConsulta());
        o.setObservacao(p.getObservacao());
        o.setValorCausa(p.getValorCausa());
        o.setUf(p.getUf());
        o.setCidade(p.getCidade());
        o.setComarca(p.getComarca());
        o.setVara(p.getVara());
        o.setTribunal(p.getTribunal());
        o.setConsultaAutomatica(p.getConsultaAutomatica());
        o.setAtivo(p.getAtivo());
        o.setUsuarioResponsavelId(p.getUsuarioResponsavel() != null ? p.getUsuarioResponsavel().getId() : null);
        o.setConsultor(p.getConsultor());
        o.setCreatedAt(p.getCreatedAt());
        o.setUpdatedAt(p.getUpdatedAt());
        return o;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String trimUf(String s) {
        String t = trimOrNull(s);
        if (t == null) return null;
        return t.length() > 2 ? t.substring(0, 2).toUpperCase() : t.toUpperCase();
    }

    private static String normalizarCodigoCliente(String s) {
        String d = String.valueOf(s == null ? "" : s).replaceAll("\\D", "");
        if (d.isBlank()) d = "1";
        long n = Long.parseLong(d);
        if (n <= 0) n = 1;
        return String.format("%08d", n);
    }
}
