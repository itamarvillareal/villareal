package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ContratoLocacaoRequest;
import br.com.vilareal.api.dto.ContratoLocacaoResponse;
import br.com.vilareal.api.entity.CadastroPessoa;
import br.com.vilareal.api.entity.ContratoLocacao;
import br.com.vilareal.api.entity.Imovel;
import br.com.vilareal.api.entity.enums.ContratoLocacaoStatus;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.CadastroPessoasRepository;
import br.com.vilareal.api.repository.ContratoLocacaoRepository;
import br.com.vilareal.api.repository.ImovelRepository;
import br.com.vilareal.api.service.ContratoLocacaoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ContratoLocacaoServiceImpl implements ContratoLocacaoService {
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final ImovelRepository imovelRepository;
    private final CadastroPessoasRepository cadastroPessoasRepository;

    public ContratoLocacaoServiceImpl(
            ContratoLocacaoRepository contratoLocacaoRepository,
            ImovelRepository imovelRepository,
            CadastroPessoasRepository cadastroPessoasRepository
    ) {
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.imovelRepository = imovelRepository;
        this.cadastroPessoasRepository = cadastroPessoasRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContratoLocacaoResponse> listar(Long imovelId, Long clienteId) {
        List<ContratoLocacao> list;
        if (imovelId != null) {
            list = contratoLocacaoRepository.findByImovelIdOrderByDataInicioDesc(imovelId);
        } else if (clienteId != null) {
            list = contratoLocacaoRepository.findByImovelClienteId(clienteId);
        } else {
            list = contratoLocacaoRepository.findAll();
        }
        return list.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ContratoLocacaoResponse buscar(Long id) {
        return toResponse(getOrFail(id));
    }

    @Override
    @Transactional
    public ContratoLocacaoResponse criar(ContratoLocacaoRequest request) {
        ContratoLocacao e = new ContratoLocacao();
        apply(e, request);
        return toResponse(contratoLocacaoRepository.save(e));
    }

    @Override
    @Transactional
    public ContratoLocacaoResponse atualizar(Long id, ContratoLocacaoRequest request) {
        ContratoLocacao e = getOrFail(id);
        apply(e, request);
        return toResponse(contratoLocacaoRepository.save(e));
    }

    private ContratoLocacao getOrFail(Long id) {
        return contratoLocacaoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Contrato de locação não encontrado: " + id));
    }

    private void apply(ContratoLocacao e, ContratoLocacaoRequest r) {
        Imovel imovel = imovelRepository.findById(r.getImovelId())
                .orElseThrow(() -> new RegraNegocioException("Imóvel não encontrado."));
        e.setImovel(imovel);
        e.setLocadorPessoa(resolvePessoa(r.getLocadorPessoaId()));
        e.setInquilinoPessoa(resolvePessoa(r.getInquilinoPessoaId()));
        e.setDataInicio(r.getDataInicio());
        e.setDataFim(r.getDataFim());
        e.setValorAluguel(r.getValorAluguel());
        e.setValorRepassePactuado(r.getValorRepassePactuado());
        e.setDiaVencimentoAluguel(r.getDiaVencimentoAluguel());
        e.setDiaRepasse(r.getDiaRepasse());
        e.setGarantiaTipo(r.getGarantiaTipo());
        e.setValorGarantia(r.getValorGarantia());
        e.setDadosBancariosRepasseJson(r.getDadosBancariosRepasseJson());
        if (r.getStatus() != null) {
            e.setStatus(r.getStatus());
        } else if (e.getStatus() == null) {
            e.setStatus(ContratoLocacaoStatus.VIGENTE);
        }
        e.setObservacoes(r.getObservacoes());
    }

    private CadastroPessoa resolvePessoa(Long id) {
        if (id == null) return null;
        return cadastroPessoasRepository.findById(id)
                .orElseThrow(() -> new RegraNegocioException("Pessoa (cadastro) não encontrada: " + id));
    }

    private ContratoLocacaoResponse toResponse(ContratoLocacao e) {
        ContratoLocacaoResponse o = new ContratoLocacaoResponse();
        o.setId(e.getId());
        o.setImovelId(e.getImovel() != null ? e.getImovel().getId() : null);
        o.setLocadorPessoaId(e.getLocadorPessoa() != null ? e.getLocadorPessoa().getId() : null);
        o.setInquilinoPessoaId(e.getInquilinoPessoa() != null ? e.getInquilinoPessoa().getId() : null);
        o.setDataInicio(e.getDataInicio());
        o.setDataFim(e.getDataFim());
        o.setValorAluguel(e.getValorAluguel());
        o.setValorRepassePactuado(e.getValorRepassePactuado());
        o.setDiaVencimentoAluguel(e.getDiaVencimentoAluguel());
        o.setDiaRepasse(e.getDiaRepasse());
        o.setGarantiaTipo(e.getGarantiaTipo());
        o.setValorGarantia(e.getValorGarantia());
        o.setDadosBancariosRepasseJson(e.getDadosBancariosRepasseJson());
        o.setStatus(e.getStatus());
        o.setObservacoes(e.getObservacoes());
        o.setCreatedAt(e.getCreatedAt());
        o.setUpdatedAt(e.getUpdatedAt());
        return o;
    }
}
