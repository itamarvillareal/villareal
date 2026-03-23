package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ClienteRequest;
import br.com.vilareal.api.dto.ClienteResponse;
import br.com.vilareal.api.entity.CadastroPessoa;
import br.com.vilareal.api.entity.Cliente;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.CadastroPessoasRepository;
import br.com.vilareal.api.repository.ClienteRepository;
import br.com.vilareal.api.service.ClienteService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ClienteServiceImpl implements ClienteService {
    private final ClienteRepository clienteRepository;
    private final CadastroPessoasRepository cadastroPessoasRepository;

    public ClienteServiceImpl(ClienteRepository clienteRepository, CadastroPessoasRepository cadastroPessoasRepository) {
        this.clienteRepository = clienteRepository;
        this.cadastroPessoasRepository = cadastroPessoasRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClienteResponse> listar() {
        return clienteRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ClienteResponse criar(ClienteRequest request) {
        String codigo = normalizarCodigo(request.getCodigoCliente());
        if (clienteRepository.existsByCodigoCliente(codigo)) {
            throw new RegraNegocioException("Já existe cliente com este código.");
        }
        Cliente c = new Cliente();
        apply(c, request, null);
        c.setCodigoCliente(codigo);
        return toResponse(clienteRepository.save(c));
    }

    @Override
    @Transactional
    public ClienteResponse atualizar(Long id, ClienteRequest request) {
        Cliente c = clienteRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Cliente não encontrado: " + id));
        String codigo = normalizarCodigo(request.getCodigoCliente());
        if (clienteRepository.existsByCodigoClienteAndIdNot(codigo, id)) {
            throw new RegraNegocioException("Já existe cliente com este código.");
        }
        apply(c, request, id);
        c.setCodigoCliente(codigo);
        return toResponse(clienteRepository.save(c));
    }

    @Override
    @Transactional(readOnly = true)
    public ClienteResponse buscarPorId(Long id) {
        return toResponse(clienteRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Cliente não encontrado: " + id)));
    }

    private void apply(Cliente c, ClienteRequest request, Long id) {
        c.setNomeReferencia(trim(request.getNomeReferencia()));
        c.setDocumentoReferencia(trimOrNull(request.getDocumentoReferencia()));
        c.setObservacao(trimOrNull(request.getObservacao()));
        c.setInativo(request.getInativo() == null ? (id == null ? Boolean.FALSE : c.getInativo()) : request.getInativo());
        if (request.getPessoaId() != null) {
            CadastroPessoa pessoa = cadastroPessoasRepository.findById(request.getPessoaId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Pessoa não encontrada: " + request.getPessoaId()));
            c.setPessoa(pessoa);
        } else {
            c.setPessoa(null);
        }
    }

    private ClienteResponse toResponse(Cliente c) {
        ClienteResponse r = new ClienteResponse();
        r.setId(c.getId());
        r.setCodigoCliente(c.getCodigoCliente());
        r.setPessoaId(c.getPessoa() != null ? c.getPessoa().getId() : null);
        r.setNomeReferencia(c.getNomeReferencia());
        r.setDocumentoReferencia(c.getDocumentoReferencia());
        r.setObservacao(c.getObservacao());
        r.setInativo(c.getInativo());
        r.setCreatedAt(c.getCreatedAt());
        r.setUpdatedAt(c.getUpdatedAt());
        return r;
    }

    private static String normalizarCodigo(String s) {
        String d = String.valueOf(s == null ? "" : s).replaceAll("\\D", "");
        if (d.isBlank()) d = "1";
        long n = Long.parseLong(d);
        if (n <= 0) n = 1;
        return String.valueOf(n).trim().length() > 8 ? String.valueOf(n).substring(0, 8) : String.valueOf(n).formatted("%8s").replace(' ', '0');
    }

    private static String trim(String s) { return String.valueOf(s == null ? "" : s).trim(); }
    private static String trimOrNull(String s) {
        String t = trim(s);
        return t.isBlank() ? null : t;
    }
}
