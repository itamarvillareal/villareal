package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.api.dto.*;
import br.com.vilareal.imovel.infrastructure.persistence.entity.*;
import br.com.vilareal.imovel.application.event.ContratoLocacaoAlteradoEvent;
import br.com.vilareal.imovel.infrastructure.persistence.repository.*;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ImovelApplicationService {

    private final ImovelRepository imovelRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoRepasseRepository locacaoRepasseRepository;
    private final LocacaoDespesaRepository locacaoDespesaRepository;
    private final PessoaRepository pessoaRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ApplicationEventPublisher applicationEventPublisher;

    public ImovelApplicationService(
            ImovelRepository imovelRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoRepasseRepository locacaoRepasseRepository,
            LocacaoDespesaRepository locacaoDespesaRepository,
            PessoaRepository pessoaRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ApplicationEventPublisher applicationEventPublisher) {
        this.imovelRepository = imovelRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.locacaoRepasseRepository = locacaoRepasseRepository;
        this.locacaoDespesaRepository = locacaoDespesaRepository;
        this.pessoaRepository = pessoaRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Transactional(readOnly = true)
    public List<ImovelResponse> listarImoveis() {
        return imovelRepository.findAllByOrderByIdAsc().stream()
                .map(this::toImovelResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ImovelResponse buscarImovel(Long id) {
        return toImovelResponse(requireImovel(id));
    }

    @Transactional(readOnly = true)
    public ImovelResponse buscarImovelPorNumeroPlanilha(int numeroPlanilha) {
        ImovelEntity e = imovelRepository
                .findByNumeroPlanilha(numeroPlanilha)
                .orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado para número da planilha: " + numeroPlanilha));
        return toImovelResponse(e);
    }

    /**
     * Resolve o número da planilha (col. A) a partir do código de cliente (8 dígitos) e do número interno do processo.
     */
    @Transactional(readOnly = true)
    public ImovelNumeroPlanilhaResponse resolverNumeroPlanilhaPorVinculo(String codigoCliente, int numeroInternoProcesso) {
        String codNorm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
        if (codNorm == null || codNorm.isEmpty()) {
            throw new BusinessRuleException("codigoCliente é obrigatório");
        }
        ClienteEntity cliente = clienteRepository
                .findByCodigoCliente(codNorm)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado para código: " + codNorm));
        Long pessoaId = cliente.getPessoa().getId();
        ProcessoEntity processo = processoRepository
                .findByPessoa_IdAndNumeroInterno(pessoaId, numeroInternoProcesso)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Processo não encontrado para cliente " + codNorm + " e proc " + numeroInternoProcesso));
        ImovelEntity imovel = imovelRepository
                .findFirstByProcesso_IdOrderByIdAsc(processo.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Nenhum imóvel vinculado ao processo " + numeroInternoProcesso + " do cliente " + codNorm));
        if (imovel.getNumeroPlanilha() == null) {
            throw new ResourceNotFoundException("Imóvel sem número de planilha cadastrado.");
        }
        ImovelNumeroPlanilhaResponse r = new ImovelNumeroPlanilhaResponse();
        r.setNumeroPlanilha(imovel.getNumeroPlanilha());
        return r;
    }

    @Transactional
    public ImovelResponse criarImovel(ImovelWriteRequest req) {
        ImovelEntity e = new ImovelEntity();
        aplicarImovel(e, req);
        e = imovelRepository.save(e);
        return toImovelResponse(requireImovel(e.getId()));
    }

    @Transactional
    public ImovelResponse atualizarImovel(Long id, ImovelWriteRequest req) {
        ImovelEntity e = requireImovel(id);
        aplicarImovel(e, req);
        imovelRepository.save(e);
        return toImovelResponse(requireImovel(id));
    }

    @Transactional(readOnly = true)
    public List<ContratoLocacaoResponse> listarContratos(Long imovelId) {
        requireImovel(imovelId);
        return contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(imovelId).stream()
                .map(this::toContratoResponse)
                .collect(Collectors.toList());
    }

    /**
     * Publica {@link ContratoLocacaoAlteradoEvent} após commit para recálculo de IPTU (ver
     * {@link br.com.vilareal.iptu.application.IptuContratoRecalculoListener}).
     */
    @Transactional
    public ContratoLocacaoResponse criarContrato(ContratoLocacaoWriteRequest req) {
        ImovelEntity im = requireImovel(req.getImovelId());
        ContratoLocacaoEntity c = new ContratoLocacaoEntity();
        c.setImovel(im);
        aplicarContrato(c, req);
        c = contratoLocacaoRepository.save(c);
        applicationEventPublisher.publishEvent(new ContratoLocacaoAlteradoEvent(c.getId()));
        return toContratoResponse(requireContrato(c.getId()));
    }

    /** @see #criarContrato(ContratoLocacaoWriteRequest) */
    @Transactional
    public ContratoLocacaoResponse atualizarContrato(Long id, ContratoLocacaoWriteRequest req) {
        ContratoLocacaoEntity c = requireContrato(id);
        if (!c.getImovel().getId().equals(req.getImovelId())) {
            throw new BusinessRuleException("Contrato não pertence ao imóvel informado.");
        }
        aplicarContrato(c, req);
        contratoLocacaoRepository.save(c);
        applicationEventPublisher.publishEvent(new ContratoLocacaoAlteradoEvent(id));
        return toContratoResponse(requireContrato(id));
    }

    @Transactional(readOnly = true)
    public List<LocacaoRepasseResponse> listarRepasses(Long contratoId) {
        requireContrato(contratoId);
        return locacaoRepasseRepository.findByContratoLocacao_IdOrderByCompetenciaMesDescIdDesc(contratoId).stream()
                .map(this::toRepasseResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public LocacaoRepasseResponse criarRepasse(LocacaoRepasseWriteRequest req) {
        ContratoLocacaoEntity c = requireContrato(req.getContratoId());
        LocacaoRepasseEntity r = new LocacaoRepasseEntity();
        r.setContratoLocacao(c);
        aplicarRepasse(r, req);
        r = locacaoRepasseRepository.save(r);
        return toRepasseResponse(requireRepasse(r.getId()));
    }

    @Transactional
    public LocacaoRepasseResponse atualizarRepasse(Long id, LocacaoRepasseWriteRequest req) {
        LocacaoRepasseEntity r = requireRepasse(id);
        if (!r.getContratoLocacao().getId().equals(req.getContratoId())) {
            throw new BusinessRuleException("Repasse não pertence ao contrato informado.");
        }
        aplicarRepasse(r, req);
        locacaoRepasseRepository.save(r);
        return toRepasseResponse(requireRepasse(id));
    }

    @Transactional(readOnly = true)
    public List<LocacaoDespesaResponse> listarDespesas(Long contratoId) {
        requireContrato(contratoId);
        return locacaoDespesaRepository.findByContratoLocacao_IdOrderByCompetenciaMesDescIdDesc(contratoId).stream()
                .map(this::toDespesaResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public LocacaoDespesaResponse criarDespesa(LocacaoDespesaWriteRequest req) {
        ContratoLocacaoEntity c = requireContrato(req.getContratoId());
        LocacaoDespesaEntity d = new LocacaoDespesaEntity();
        d.setContratoLocacao(c);
        aplicarDespesa(d, req);
        d = locacaoDespesaRepository.save(d);
        return toDespesaResponse(requireDespesa(d.getId()));
    }

    @Transactional
    public LocacaoDespesaResponse atualizarDespesa(Long id, LocacaoDespesaWriteRequest req) {
        LocacaoDespesaEntity d = requireDespesa(id);
        if (!d.getContratoLocacao().getId().equals(req.getContratoId())) {
            throw new BusinessRuleException("Despesa não pertence ao contrato informado.");
        }
        aplicarDespesa(d, req);
        locacaoDespesaRepository.save(d);
        return toDespesaResponse(requireDespesa(id));
    }

    private ImovelEntity requireImovel(Long id) {
        return imovelRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado: " + id));
    }

    private ContratoLocacaoEntity requireContrato(Long id) {
        return contratoLocacaoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contrato de locação não encontrado: " + id));
    }

    private LocacaoRepasseEntity requireRepasse(Long id) {
        return locacaoRepasseRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Repasse não encontrado: " + id));
    }

    private LocacaoDespesaEntity requireDespesa(Long id) {
        return locacaoDespesaRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Despesa não encontrada: " + id));
    }

    private void aplicarImovel(ImovelEntity e, ImovelWriteRequest req) {
        if (req.getClienteId() != null) {
            PessoaEntity pessoa = pessoaRepository
                    .findById(req.getClienteId())
                    .orElseThrow(() -> new ResourceNotFoundException("Pessoa (cliente) não encontrada: " + req.getClienteId()));
            e.setPessoa(pessoa);
        } else {
            e.setPessoa(null);
        }
        if (req.getProcessoId() != null) {
            ProcessoEntity proc = processoRepository
                    .findById(req.getProcessoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
            e.setProcesso(proc);
        } else {
            e.setProcesso(null);
        }
        e.setTitulo(trimToNull(req.getTitulo()));
        e.setEnderecoCompleto(trimToNull(req.getEnderecoCompleto()));
        e.setCondominio(trimToNull(req.getCondominio()));
        e.setUnidade(trimToNull(req.getUnidade()));
        e.setTipoImovel(trimToNull(req.getTipoImovel()));
        if (StringUtils.hasText(req.getSituacao())) {
            e.setSituacao(req.getSituacao().trim());
        } else {
            e.setSituacao("DESOCUPADO");
        }
        e.setGaragens(trimToNull(req.getGaragens()));
        e.setInscricaoImobiliaria(trimToNull(req.getInscricaoImobiliaria()));
        e.setObservacoes(trimToNull(req.getObservacoes()));
        e.setCamposExtrasJson(trimToNull(req.getCamposExtrasJson()));
        if (req.getNumeroPlanilha() != null) {
            imovelRepository.findByNumeroPlanilha(req.getNumeroPlanilha()).ifPresent(other -> {
                if (e.getId() == null || !other.getId().equals(e.getId())) {
                    throw new BusinessRuleException("Número da planilha já vinculado a outro imóvel.");
                }
            });
            e.setNumeroPlanilha(req.getNumeroPlanilha());
        } else if (e.getId() == null) {
            e.setNumeroPlanilha(null);
        }
        if (req.getResponsavelPessoaId() != null) {
            PessoaEntity resp = pessoaRepository
                    .findById(req.getResponsavelPessoaId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Pessoa (responsável) não encontrada: " + req.getResponsavelPessoaId()));
            e.setResponsavelPessoa(resp);
        } else if (e.getId() == null) {
            e.setResponsavelPessoa(null);
        }
        if (req.getAtivo() != null) {
            e.setAtivo(req.getAtivo());
        } else if (e.getId() == null) {
            e.setAtivo(true);
        }
    }

    private void aplicarContrato(ContratoLocacaoEntity c, ContratoLocacaoWriteRequest req) {
        c.setDataInicio(req.getDataInicio());
        c.setDataFim(req.getDataFim());
        c.setValorAluguel(req.getValorAluguel());
        c.setValorRepassePactuado(req.getValorRepassePactuado());
        c.setDiaVencimentoAluguel(req.getDiaVencimentoAluguel());
        c.setDiaRepasse(req.getDiaRepasse());
        c.setGarantiaTipo(trimToNull(req.getGarantiaTipo()));
        c.setValorGarantia(req.getValorGarantia());
        c.setDadosBancariosRepasseJson(trimToNull(req.getDadosBancariosRepasseJson()));
        c.setObservacoes(trimToNull(req.getObservacoes()));
        if (StringUtils.hasText(req.getStatus())) {
            c.setStatus(req.getStatus().trim());
        } else if (c.getId() == null) {
            c.setStatus("VIGENTE");
        }
        if (req.getLocadorPessoaId() != null) {
            PessoaEntity loc = pessoaRepository
                    .findById(req.getLocadorPessoaId())
                    .orElseThrow(
                            () -> new ResourceNotFoundException("Locador não encontrado: " + req.getLocadorPessoaId()));
            c.setLocadorPessoa(loc);
        } else {
            c.setLocadorPessoa(null);
        }
        if (req.getInquilinoPessoaId() != null) {
            PessoaEntity inq = pessoaRepository
                    .findById(req.getInquilinoPessoaId())
                    .orElseThrow(
                            () -> new ResourceNotFoundException("Inquilino não encontrado: " + req.getInquilinoPessoaId()));
            c.setInquilinoPessoa(inq);
        } else {
            c.setInquilinoPessoa(null);
        }
    }

    private void aplicarRepasse(LocacaoRepasseEntity r, LocacaoRepasseWriteRequest req) {
        r.setCompetenciaMes(trimToNull(req.getCompetenciaMes()));
        r.setValorRecebidoInquilino(req.getValorRecebidoInquilino());
        r.setValorRepassadoLocador(req.getValorRepassadoLocador());
        r.setValorDespesasRepassar(req.getValorDespesasRepassar());
        r.setRemuneracaoEscritorio(req.getRemuneracaoEscritorio());
        if (StringUtils.hasText(req.getStatus())) {
            r.setStatus(req.getStatus().trim());
        } else if (r.getId() == null) {
            r.setStatus("PENDENTE");
        }
        r.setDataRepasseEfetiva(req.getDataRepasseEfetiva());
        r.setObservacao(trimToNull(req.getObservacao()));
        r.setLancamentoFinanceiroVinculoId(req.getLancamentoFinanceiroVinculoId());
    }

    private void aplicarDespesa(LocacaoDespesaEntity d, LocacaoDespesaWriteRequest req) {
        d.setCompetenciaMes(trimToNull(req.getCompetenciaMes()));
        d.setDescricao(req.getDescricao().trim());
        d.setValor(req.getValor());
        d.setCategoria(StringUtils.hasText(req.getCategoria()) ? req.getCategoria().trim() : "OUTROS");
        d.setObservacao(trimToNull(req.getObservacao()));
        d.setLancamentoFinanceiroId(req.getLancamentoFinanceiroId());
    }

    private ImovelResponse toImovelResponse(ImovelEntity e) {
        ImovelResponse r = new ImovelResponse();
        r.setId(e.getId());
        if (e.getPessoa() != null) {
            r.setClienteId(e.getPessoa().getId());
        } else {
            r.setClienteId(null);
        }
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        r.setNumeroPlanilha(e.getNumeroPlanilha());
        if (e.getResponsavelPessoa() != null) {
            e.getResponsavelPessoa().getId();
            r.setResponsavelPessoaId(e.getResponsavelPessoa().getId());
        } else {
            r.setResponsavelPessoaId(null);
        }
        r.setTitulo(e.getTitulo());
        r.setEnderecoCompleto(e.getEnderecoCompleto());
        r.setCondominio(e.getCondominio());
        r.setUnidade(e.getUnidade());
        r.setTipoImovel(e.getTipoImovel());
        r.setSituacao(e.getSituacao());
        r.setGaragens(e.getGaragens());
        r.setInscricaoImobiliaria(e.getInscricaoImobiliaria());
        r.setObservacoes(e.getObservacoes());
        r.setCamposExtrasJson(e.getCamposExtrasJson());
        r.setAtivo(e.getAtivo());
        return r;
    }

    private ContratoLocacaoResponse toContratoResponse(ContratoLocacaoEntity c) {
        c.getImovel().getId();
        ContratoLocacaoResponse r = new ContratoLocacaoResponse();
        r.setId(c.getId());
        r.setImovelId(c.getImovel().getId());
        r.setLocadorPessoaId(c.getLocadorPessoa() != null ? c.getLocadorPessoa().getId() : null);
        r.setInquilinoPessoaId(c.getInquilinoPessoa() != null ? c.getInquilinoPessoa().getId() : null);
        r.setDataInicio(c.getDataInicio());
        r.setDataFim(c.getDataFim());
        r.setValorAluguel(c.getValorAluguel());
        r.setValorRepassePactuado(c.getValorRepassePactuado());
        r.setDiaVencimentoAluguel(c.getDiaVencimentoAluguel());
        r.setDiaRepasse(c.getDiaRepasse());
        r.setGarantiaTipo(c.getGarantiaTipo());
        r.setValorGarantia(c.getValorGarantia());
        r.setDadosBancariosRepasseJson(c.getDadosBancariosRepasseJson());
        r.setStatus(c.getStatus());
        r.setObservacoes(c.getObservacoes());
        return r;
    }

    private LocacaoRepasseResponse toRepasseResponse(LocacaoRepasseEntity x) {
        x.getContratoLocacao().getId();
        LocacaoRepasseResponse r = new LocacaoRepasseResponse();
        r.setId(x.getId());
        r.setContratoId(x.getContratoLocacao().getId());
        r.setCompetenciaMes(x.getCompetenciaMes());
        r.setValorRecebidoInquilino(x.getValorRecebidoInquilino());
        r.setValorRepassadoLocador(x.getValorRepassadoLocador());
        r.setValorDespesasRepassar(x.getValorDespesasRepassar());
        r.setRemuneracaoEscritorio(x.getRemuneracaoEscritorio());
        r.setStatus(x.getStatus());
        r.setDataRepasseEfetiva(x.getDataRepasseEfetiva());
        r.setObservacao(x.getObservacao());
        r.setLancamentoFinanceiroVinculoId(x.getLancamentoFinanceiroVinculoId());
        return r;
    }

    private LocacaoDespesaResponse toDespesaResponse(LocacaoDespesaEntity x) {
        x.getContratoLocacao().getId();
        LocacaoDespesaResponse r = new LocacaoDespesaResponse();
        r.setId(x.getId());
        r.setContratoId(x.getContratoLocacao().getId());
        r.setCompetenciaMes(x.getCompetenciaMes());
        r.setDescricao(x.getDescricao());
        r.setValor(x.getValor());
        r.setCategoria(x.getCategoria());
        r.setObservacao(x.getObservacao());
        r.setLancamentoFinanceiroId(x.getLancamentoFinanceiroId());
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
