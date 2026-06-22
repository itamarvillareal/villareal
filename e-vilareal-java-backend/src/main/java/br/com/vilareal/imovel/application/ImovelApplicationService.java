package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.api.dto.*;
import br.com.vilareal.imovel.infrastructure.persistence.entity.*;
import br.com.vilareal.imovel.application.event.ContratoLocacaoAlteradoEvent;
import br.com.vilareal.imovel.infrastructure.persistence.repository.*;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoCanonicalLookup;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ImovelApplicationService {

    private final ImovelRepository imovelRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final PessoaRepository pessoaRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final ObjectMapper objectMapper;
    private final ClienteResolverService clienteResolverService;
    private final ImovelProcessoLinkService imovelProcessoLinkService;
    private final ImovelProcessoRepository imovelProcessoRepository;

    public ImovelApplicationService(
            ImovelRepository imovelRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            PessoaRepository pessoaRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ApplicationEventPublisher applicationEventPublisher,
            ObjectMapper objectMapper,
            ClienteResolverService clienteResolverService,
            ImovelProcessoLinkService imovelProcessoLinkService,
            ImovelProcessoRepository imovelProcessoRepository) {
        this.imovelRepository = imovelRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.pessoaRepository = pessoaRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.applicationEventPublisher = applicationEventPublisher;
        this.objectMapper = objectMapper;
        this.clienteResolverService = clienteResolverService;
        this.imovelProcessoLinkService = imovelProcessoLinkService;
        this.imovelProcessoRepository = imovelProcessoRepository;
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
    public ImovelResponse buscarImovelPorNumeroPlanilha(int numeroPlanilha, Long clienteId, String codigoCliente) {
        ImovelEntity e = resolverImovelPorNumeroPlanilha(numeroPlanilha, clienteId, codigoCliente);
        return toImovelResponse(e);
    }

    @Transactional(readOnly = true)
    public List<ImovelProcessoResponse> listarProcessosDoImovel(Long imovelId) {
        return imovelProcessoLinkService.listarPorImovel(imovelId);
    }

    @Transactional
    public ImovelProcessoResponse vincularProcesso(Long imovelId, ImovelProcessoWriteRequest req) {
        return imovelProcessoLinkService.vincular(imovelId, req);
    }

    @Transactional
    public ImovelProcessoResponse desativarVinculoProcesso(
            Long imovelId, Long processoId, ImovelProcessoPatchRequest req) {
        return imovelProcessoLinkService.desativar(imovelId, processoId, req);
    }

    /**
     * Resolve o número da planilha (col. A) a partir do código de cliente (8 dígitos) e do número interno do processo.
     */
    private static final Pattern LEGADO_PLANILHA_OBS =
            Pattern.compile("planilha\\s+legado\\s+(\\d+)", Pattern.CASE_INSENSITIVE);

    /**
     * Lista todos os pares (código cliente, proc.) cujo imóvel no cadastro aponta para o mesmo nº da planilha
     * (registos com {@code numero_planilha} ou importados via Proc/0.89.1 nas observações).
     */
    @Transactional(readOnly = true)
    public ImovelVinculosProcessoResponse listarVinculosProcessoPorNumeroPlanilha(int numeroPlanilha) {
        if (numeroPlanilha < 1) {
            throw new BusinessRuleException("numeroPlanilha inválido");
        }
        ImovelVinculosProcessoResponse out = new ImovelVinculosProcessoResponse();
        out.setNumeroPlanilha(numeroPlanilha);
        out.setVinculos(coletarVinculosProcesso(numeroPlanilha, null));
        return out;
    }

    @Transactional(readOnly = true)
    public ImovelVinculosProcessoResponse listarVinculosProcessoPorImovelId(Long imovelId) {
        ImovelEntity ref = requireImovel(imovelId);
        int numero = ref.getNumeroPlanilha() != null
                ? ref.getNumeroPlanilha()
                : extrairNumeroPlanilhaLegadoObservacoes(ref.getObservacoes());
        if (numero < 1) {
            throw new BusinessRuleException(
                    "Imóvel sem número da planilha nem referência «planilha legado» nas observações.");
        }
        ImovelVinculosProcessoResponse out = new ImovelVinculosProcessoResponse();
        out.setNumeroPlanilha(numero);
        out.setVinculos(coletarVinculosProcesso(numero, imovelId));
        return out;
    }

    private List<ImovelVinculoProcessoItemResponse> coletarVinculosProcesso(int numeroPlanilha, Long imovelIdCadastroAtual) {
        List<ImovelEntity> candidatos = imovelRepository.findAllPorNumeroPlanilhaLegado(numeroPlanilha);
        List<ImovelVinculoProcessoItemResponse> itens = new ArrayList<>();

        for (ImovelEntity im : candidatos) {
            ImovelVinculoProcessoItemResponse item = montarVinculoProcessoDeImovel(im, numeroPlanilha, imovelIdCadastroAtual);
            if (item != null) {
                itens.add(item);
            }
        }

        if (!itens.isEmpty()) {
            itens.get(itens.size() - 1).setPrincipal(true);
        }
        return itens;
    }

    private ImovelVinculoProcessoItemResponse montarVinculoProcessoDeImovel(
            ImovelEntity im, int numeroPlanilha, Long imovelIdCadastroAtual) {
        ProcessoEntity proc = resolverProcessoParaLeituraVinculo(im);
        String cod8 = null;
        Integer numeroInterno = null;
        Long processoId = null;

        if (proc != null) {
            numeroInterno = proc.getNumeroInterno();
            processoId = proc.getId();
            cod8 = resolverCodigoClienteImovelProcesso(im, proc);
        } else {
            CodProcExtras extras = extrairCodProcExtras(im.getCamposExtrasJson());
            if (extras == null || extras.procNum() == null) {
                return null;
            }
            cod8 = extras.codigo();
            numeroInterno = extras.procNum();
            processoId = buscarProcessoPorCodigoProc(cod8, numeroInterno).map(ProcessoEntity::getId).orElse(null);
        }

        if (!StringUtils.hasText(cod8) || numeroInterno == null || numeroInterno < 1) {
            return null;
        }

        ImovelVinculoProcessoItemResponse item = new ImovelVinculoProcessoItemResponse();
        item.setCodigoCliente(cod8);
        item.setNumeroInterno(numeroInterno);
        item.setProcessoId(processoId);
        item.setImovelId(im.getId());
        item.setNumeroPlanilhaImovel(im.getNumeroPlanilha() != null ? im.getNumeroPlanilha() : numeroPlanilha);
        item.setCadastroAtual(imovelIdCadastroAtual != null && imovelIdCadastroAtual.equals(im.getId()));
        return item;
    }

    /**
     * Leitura de vínculo para "Abrir Proc." e resolvers associados: N:N ativo → escalar → extras (fallback).
     * Somente leitura; alinhado à fonte canônica da reconciliação/API.
     */
    private ProcessoEntity resolverProcessoParaLeituraVinculo(ImovelEntity im) {
        if (im.getId() != null) {
            Optional<ProcessoEntity> fromNn = imovelProcessoRepository
                    .findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(im.getId())
                    .map(ImovelProcessoEntity::getProcesso)
                    .filter(p -> p.getNumeroInterno() != null);
            if (fromNn.isPresent()) {
                return fromNn.get();
            }
        }
        ProcessoEntity escalar = im.getProcesso();
        if (escalar != null && escalar.getNumeroInterno() != null) {
            return escalar;
        }
        return null;
    }

    private String resolverCodigoClienteImovelProcesso(ImovelEntity im, ProcessoEntity proc) {
        if (im.getPessoa() != null) {
            String cod = resolverCodigoClienteDaPessoa(im.getPessoa().getId());
            if (StringUtils.hasText(cod)) {
                return cod;
            }
        }
        if (proc.getPessoa() != null) {
            String cod = resolverCodigoClienteDaPessoa(proc.getPessoa().getId());
            if (StringUtils.hasText(cod)) {
                return cod;
            }
            return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(
                    String.format("%08d", proc.getPessoa().getId()));
        }
        return null;
    }

    private String resolverCodigoClienteDaPessoa(Long pessoaId) {
        if (pessoaId == null) {
            return null;
        }
        List<ClienteEntity> clientes = clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId);
        if (clientes.isEmpty()) {
            return null;
        }
        return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clientes.get(0).getCodigoCliente());
    }

    private Optional<ProcessoEntity> buscarProcessoPorCodigoProc(String codigoCliente, int numeroInterno) {
        String codNorm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
        if (!StringUtils.hasText(codNorm)) {
            return Optional.empty();
        }
        return clienteRepository
                .findByCodigoCliente(codNorm)
                .flatMap(c -> processoRepository.findByPessoa_IdAndNumeroInterno(c.getPessoa().getId(), numeroInterno));
    }

    private CodProcExtras extrairCodProcExtras(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(json);
            if (!root.has("codigo") || !root.has("proc")) {
                return null;
            }
            String cod = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(root.get("codigo").asText());
            if (!StringUtils.hasText(cod)) {
                return null;
            }
            String procRaw = root.get("proc").asText().replaceAll("\\D", "");
            if (!StringUtils.hasText(procRaw)) {
                return null;
            }
            int procNum = Integer.parseInt(procRaw);
            if (procNum < 1) {
                return null;
            }
            return new CodProcExtras(cod, procNum);
        } catch (Exception e) {
            return null;
        }
    }

    private record CodProcExtras(String codigo, Integer procNum) {}

    private static int extrairNumeroPlanilhaLegadoObservacoes(String observacoes) {
        if (!StringUtils.hasText(observacoes)) {
            return -1;
        }
        Matcher m = LEGADO_PLANILHA_OBS.matcher(observacoes);
        if (!m.find()) {
            return -1;
        }
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

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
        ProcessoEntity processo = ProcessoCanonicalLookup.escolher(
                        processoRepository.findAllByCliente_IdAndNumeroInternoOrderByIdDesc(
                                cliente.getId(), numeroInternoProcesso),
                        pessoaId)
                .or(() -> processoRepository.findByPessoa_IdAndNumeroInterno(pessoaId, numeroInternoProcesso))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Processo não encontrado para cliente " + codNorm + " e proc " + numeroInternoProcesso));
        ImovelEntity imovel = imovelProcessoRepository
                .findFirstByProcesso_IdAndAtivoTrueOrderByIdDesc(processo.getId())
                .map(ip -> ip.getImovel())
                .or(() -> imovelRepository.findFirstByProcesso_IdOrderByIdAsc(processo.getId()))
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
        Long processoId = req.getProcessoId();
        aplicarImovel(e, req, false);
        e = imovelRepository.save(e);
        if (processoId != null) {
            imovelProcessoLinkService.vincularSeProcessoInformado(e, processoId);
        }
        return toImovelResponse(requireImovel(e.getId()));
    }

    @Transactional
    public ImovelResponse atualizarImovel(Long id, ImovelWriteRequest req) {
        ImovelEntity e = requireImovel(id);
        Long processoId = req.getProcessoId();
        aplicarImovel(e, req, processoId != null);
        imovelRepository.save(e);
        if (processoId != null) {
            imovelProcessoLinkService.vincularSeProcessoInformado(e, processoId);
        } else {
            // Sem processo no payload: desativa o N:N ativo p/ não ficar "escalar NULL + N:N ativo".
            imovelProcessoLinkService.desativarTodosVinculos(e);
        }
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

    // CRUD de repasse/despesa LEGADO (locacao_repasse/locacao_despesa) removido — C9/A8.
    // O resultado/reconciliação usam apenas locacao_repasse_lancamento (LocacaoReconciliacaoService).

    private ImovelEntity requireImovel(Long id) {
        return imovelRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado: " + id));
    }

    private ContratoLocacaoEntity requireContrato(Long id) {
        return contratoLocacaoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contrato de locação não encontrado: " + id));
    }

    private ImovelEntity resolverImovelPorNumeroPlanilha(int numeroPlanilha, Long clienteId, String codigoCliente) {
        if (clienteId != null) {
            return imovelRepository
                    .findByCliente_IdAndNumeroPlanilha(clienteId, numeroPlanilha)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Imóvel não encontrado para cliente " + clienteId + " e planilha " + numeroPlanilha));
        }
        if (StringUtils.hasText(codigoCliente)) {
            String codNorm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
            ClienteEntity cliente = clienteRepository
                    .findByCodigoCliente(codNorm)
                    .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + codNorm));
            return imovelRepository
                    .findByCliente_IdAndNumeroPlanilha(cliente.getId(), numeroPlanilha)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Imóvel não encontrado para cliente " + codNorm + " e planilha " + numeroPlanilha));
        }
        List<ImovelEntity> todos = imovelRepository.findAllByOrderByIdAsc().stream()
                .filter(i -> numeroPlanilha == i.getNumeroPlanilha())
                .toList();
        if (todos.isEmpty()) {
            throw new ResourceNotFoundException("Imóvel não encontrado para número da planilha: " + numeroPlanilha);
        }
        if (todos.size() > 1) {
            throw new BusinessRuleException(
                    "Mais de um imóvel com planilha "
                            + numeroPlanilha
                            + "; informe clienteId ou codigoCliente.");
        }
        return todos.get(0);
    }

    private void aplicarImovel(ImovelEntity e, ImovelWriteRequest req, boolean vincularProcessoViaLink) {
        if (req.getClienteId() != null) {
            var cliente = clienteResolverService.buscarPorId(req.getClienteId());
            e.setCliente(cliente);
            e.setPessoa(cliente.getPessoa());
        } else {
            e.setPessoa(null);
            e.setCliente(null);
        }
        if (!vincularProcessoViaLink) {
            if (req.getProcessoId() != null) {
                ProcessoEntity proc = processoRepository
                        .findById(req.getProcessoId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Processo não encontrado: " + req.getProcessoId()));
                e.setProcesso(proc);
            } else {
                e.setProcesso(null);
            }
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
            if (e.getCliente() != null) {
                imovelRepository
                        .findByCliente_IdAndNumeroPlanilha(e.getCliente().getId(), req.getNumeroPlanilha())
                        .ifPresent(other -> {
                            if (e.getId() == null || !other.getId().equals(e.getId())) {
                                throw new BusinessRuleException(
                                        "Número da planilha já vinculado a outro imóvel deste cliente.");
                            }
                        });
            } else {
                imovelRepository.findByNumeroPlanilha(req.getNumeroPlanilha()).ifPresent(other -> {
                    if (e.getId() == null || !other.getId().equals(e.getId())) {
                        throw new BusinessRuleException("Número da planilha já vinculado a outro imóvel.");
                    }
                });
            }
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
        if (req.getTaxaAdministracaoPercent() != null) {
            c.setTaxaAdministracaoPercent(req.getTaxaAdministracaoPercent());
        } else if (c.getId() == null) {
            c.setTaxaAdministracaoPercent(new java.math.BigDecimal("10.00"));
        }
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

    private ImovelResponse toImovelResponse(ImovelEntity e) {
        ImovelResponse r = new ImovelResponse();
        r.setId(e.getId());
        if (e.getCliente() != null) {
            r.setClienteId(e.getCliente().getId());
            r.setCodigoCliente(e.getCliente().getCodigoCliente());
        } else {
            r.setClienteId(null);
            r.setCodigoCliente(null);
        }
        if (e.getPessoa() != null) {
            r.setPessoaRefId(e.getPessoa().getId());
        }
        // Fonte única (Fase 3, item 4): processo vem da linha ATIVA de imovel_processo; o escalar
        // imovel.processo_id é só espelho (sai na FASE C). Após o backfill V118 dão o mesmo resultado.
        ProcessoEntity procAtivo = e.getId() != null
                ? imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(e.getId())
                        .map(ip -> ip.getProcesso())
                        .orElse(null)
                : null;
        if (procAtivo != null) {
            r.setProcessoId(procAtivo.getId());
            r.setNumeroInternoProcesso(procAtivo.getNumeroInterno());
        } else {
            r.setProcessoId(null);
            r.setNumeroInternoProcesso(null);
        }
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
        r.setTaxaAdministracaoPercent(c.getTaxaAdministracaoPercent());
        r.setGarantiaTipo(c.getGarantiaTipo());
        r.setValorGarantia(c.getValorGarantia());
        r.setDadosBancariosRepasseJson(c.getDadosBancariosRepasseJson());
        r.setStatus(c.getStatus());
        r.setObservacoes(c.getObservacoes());
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
