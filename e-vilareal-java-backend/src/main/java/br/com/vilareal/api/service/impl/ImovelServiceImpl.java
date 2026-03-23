package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ImovelRequest;
import br.com.vilareal.api.dto.ImovelResponse;
import br.com.vilareal.api.entity.Cliente;
import br.com.vilareal.api.entity.Imovel;
import br.com.vilareal.api.entity.Processo;
import br.com.vilareal.api.entity.enums.ImovelSituacao;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.ClienteRepository;
import br.com.vilareal.api.repository.ImovelRepository;
import br.com.vilareal.api.repository.ProcessoRepository;
import br.com.vilareal.api.service.ImovelService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ImovelServiceImpl implements ImovelService {
    private final ImovelRepository imovelRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;

    public ImovelServiceImpl(
            ImovelRepository imovelRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository
    ) {
        this.imovelRepository = imovelRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ImovelResponse> listar(Long clienteId) {
        List<Imovel> list = clienteId != null
                ? imovelRepository.findByClienteIdOrderByIdDesc(clienteId)
                : imovelRepository.findAll();
        return list.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ImovelResponse buscar(Long id) {
        return toResponse(getImovelOrFail(id));
    }

    @Override
    @Transactional
    public ImovelResponse criar(ImovelRequest request) {
        Imovel e = new Imovel();
        apply(e, request, null);
        return toResponse(imovelRepository.save(e));
    }

    @Override
    @Transactional
    public ImovelResponse atualizar(Long id, ImovelRequest request) {
        Imovel e = getImovelOrFail(id);
        apply(e, request, id);
        return toResponse(imovelRepository.save(e));
    }

    private Imovel getImovelOrFail(Long id) {
        return imovelRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Imóvel não encontrado: " + id));
    }

    private void apply(Imovel e, ImovelRequest r, Long excludeImovelIdWhenCheckingProcesso) {
        Cliente cliente = clienteRepository.findById(r.getClienteId())
                .orElseThrow(() -> new RegraNegocioException("Cliente não encontrado."));
        e.setCliente(cliente);

        Processo processo = null;
        if (r.getProcessoId() != null) {
            processo = processoRepository.findById(r.getProcessoId())
                    .orElseThrow(() -> new RegraNegocioException("Processo não encontrado."));
            if (!processo.getCliente().getId().equals(cliente.getId())) {
                throw new RegraNegocioException("O processo informado não pertence ao cliente do imóvel.");
            }
            imovelRepository.findByProcessoId(processo.getId()).ifPresent(other -> {
                if (excludeImovelIdWhenCheckingProcesso == null || !other.getId().equals(excludeImovelIdWhenCheckingProcesso)) {
                    throw new RegraNegocioException("Já existe imóvel vinculado a este processo.");
                }
            });
        }
        e.setProcesso(processo);

        e.setTitulo(r.getTitulo());
        e.setEnderecoCompleto(r.getEnderecoCompleto());
        e.setCondominio(r.getCondominio());
        e.setUnidade(r.getUnidade());
        e.setTipoImovel(r.getTipoImovel());
        if (r.getSituacao() != null) {
            e.setSituacao(r.getSituacao());
        }
        e.setGaragens(r.getGaragens());
        e.setInscricaoImobiliaria(r.getInscricaoImobiliaria());
        e.setObservacoes(r.getObservacoes());
        e.setCamposExtrasJson(r.getCamposExtrasJson());
        if (r.getAtivo() != null) {
            e.setAtivo(r.getAtivo());
        }
        if (e.getSituacao() == null) {
            e.setSituacao(ImovelSituacao.OCUPADO);
        }
    }

    private ImovelResponse toResponse(Imovel e) {
        ImovelResponse o = new ImovelResponse();
        o.setId(e.getId());
        o.setClienteId(e.getCliente() != null ? e.getCliente().getId() : null);
        o.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        o.setTitulo(e.getTitulo());
        o.setEnderecoCompleto(e.getEnderecoCompleto());
        o.setCondominio(e.getCondominio());
        o.setUnidade(e.getUnidade());
        o.setTipoImovel(e.getTipoImovel());
        o.setSituacao(e.getSituacao());
        o.setGaragens(e.getGaragens());
        o.setInscricaoImobiliaria(e.getInscricaoImobiliaria());
        o.setObservacoes(e.getObservacoes());
        o.setCamposExtrasJson(e.getCamposExtrasJson());
        o.setAtivo(e.getAtivo());
        o.setCreatedAt(e.getCreatedAt());
        o.setUpdatedAt(e.getUpdatedAt());
        return o;
    }
}
