package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.FormaPagamentoAluguelLocacao;
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
import java.util.Comparator;
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
    private final ImovelVinculoProcessoPrincipalRepository imovelVinculoProcessoPrincipalRepository;
    private final ImovelVinculoLocatarioService imovelVinculoLocatarioService;

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
            ImovelProcessoRepository imovelProcessoRepository,
            ImovelVinculoProcessoPrincipalRepository imovelVinculoProcessoPrincipalRepository,
            ImovelVinculoLocatarioService imovelVinculoLocatarioService) {
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
        this.imovelVinculoProcessoPrincipalRepository = imovelVinculoProcessoPrincipalRepository;
        this.imovelVinculoLocatarioService = imovelVinculoLocatarioService;
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

    /**
     * Define manualmente o par Cod.+Proc. principal (vínculo atual) do imóvel na planilha.
     * Usado na conta corrente e no relatório financeiro.
     */
    @Transactional
    public ImovelVinculosProcessoResponse definirVinculoProcessoPrincipal(
            int numeroPlanilha, ImovelVinculoPrincipalWriteRequest req) {
        if (numeroPlanilha < 1) {
            throw new BusinessRuleException("numeroPlanilha inválido");
        }
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(req.getCodigoCliente());
        Integer proc = req.getNumeroInterno();
        if (!StringUtils.hasText(cod8) || proc == null || proc < 1) {
            throw new BusinessRuleException("Informe código de cliente e proc. válidos.");
        }

        List<ImovelVinculoProcessoItemResponse> vinculos = coletarVinculosProcessoSemPrincipal(numeroPlanilha, null);
        boolean existe = vinculos.stream()
                .anyMatch(v -> cod8.equals(v.getCodigoCliente()) && proc.equals(v.getNumeroInterno()));
        if (!existe) {
            throw new BusinessRuleException(
                    "Par Cliente " + cod8 + " · Proc. " + proc + " não pertence aos vínculos deste imóvel.");
        }

        ImovelVinculoProcessoPrincipalEntity row = imovelVinculoProcessoPrincipalRepository
                .findById(numeroPlanilha)
                .orElseGet(() -> {
                    ImovelVinculoProcessoPrincipalEntity novo = new ImovelVinculoProcessoPrincipalEntity();
                    novo.setNumeroPlanilha(numeroPlanilha);
                    return novo;
                });
        row.setCodigoCliente(cod8);
        row.setNumeroInterno(proc);
        imovelVinculoProcessoPrincipalRepository.save(row);

        aplicarPrincipalPersistido(numeroPlanilha, vinculos);
        ImovelVinculosProcessoResponse out = new ImovelVinculosProcessoResponse();
        out.setNumeroPlanilha(numeroPlanilha);
        out.setVinculos(vinculos);
        return out;
    }

    @Transactional
    public ImovelVinculosProcessoResponse definirVinculoProcessoPrincipalPorImovelId(
            Long imovelId, ImovelVinculoPrincipalWriteRequest req) {
        ImovelEntity ref = requireImovel(imovelId);
        int numero = ref.getNumeroPlanilha() != null
                ? ref.getNumeroPlanilha()
                : extrairNumeroPlanilhaLegadoObservacoes(ref.getObservacoes());
        if (numero < 1) {
            throw new BusinessRuleException(
                    "Imóvel sem número da planilha nem referência «planilha legado» nas observações.");
        }
        return definirVinculoProcessoPrincipal(numero, req);
    }

    private List<ImovelVinculoProcessoItemResponse> coletarVinculosProcesso(int numeroPlanilha, Long imovelIdCadastroAtual) {
        List<ImovelVinculoProcessoItemResponse> itens = coletarVinculosProcessoSemPrincipal(numeroPlanilha, imovelIdCadastroAtual);
        aplicarPrincipalPersistido(numeroPlanilha, itens);
        return itens;
    }

    private List<ImovelVinculoProcessoItemResponse> coletarVinculosProcessoSemPrincipal(
            int numeroPlanilha, Long imovelIdCadastroAtual) {
        List<ImovelEntity> candidatos = imovelRepository.findAllPorNumeroPlanilhaLegado(numeroPlanilha);
        List<ImovelVinculoProcessoItemResponse> itens = new ArrayList<>();

        for (ImovelEntity im : candidatos) {
            ImovelVinculoProcessoItemResponse item = montarVinculoProcessoDeImovel(im, numeroPlanilha, imovelIdCadastroAtual);
            if (item != null) {
                itens.add(item);
            }
        }

        return itens;
    }

    private void aplicarPrincipalPersistido(int numeroPlanilha, List<ImovelVinculoProcessoItemResponse> itens) {
        if (itens == null || itens.isEmpty()) {
            return;
        }
        itens.forEach(i -> i.setPrincipal(false));

        Optional<ImovelVinculoProcessoPrincipalEntity> pref =
                imovelVinculoProcessoPrincipalRepository.findById(numeroPlanilha);
        if (pref.isPresent()) {
            String cod = pref.get().getCodigoCliente();
            Integer proc = pref.get().getNumeroInterno();
            for (ImovelVinculoProcessoItemResponse item : itens) {
                if (cod.equals(item.getCodigoCliente()) && proc.equals(item.getNumeroInterno())) {
                    item.setPrincipal(true);
                    return;
                }
            }
        }

        itens.get(itens.size() - 1).setPrincipal(true);
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
        String codProc = resolverCodigoClienteDoProcesso(proc);
        if (StringUtils.hasText(codProc)) {
            return codProc;
        }
        if (im.getPessoa() != null) {
            String cod = resolverCodigoClienteDaPessoa(im.getPessoa().getId());
            if (StringUtils.hasText(cod)) {
                return cod;
            }
        }
        return null;
    }

    /** Código de 8 dígitos do processo vinculado (cliente contratante), não da pessoa do imóvel. */
    private String resolverCodigoClienteDoProcesso(ProcessoEntity proc) {
        if (proc == null) {
            return null;
        }
        if (proc.getCliente() != null && StringUtils.hasText(proc.getCliente().getCodigoCliente())) {
            return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(proc.getCliente().getCodigoCliente());
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
    public List<ContratoLocacaoResponse> listarContratos(Long imovelId, Long processoId) {
        requireImovel(imovelId);
        List<ContratoLocacaoEntity> contratos;
        if (processoId != null) {
            contratos =
                    contratoLocacaoRepository.findByImovel_IdAndProcesso_IdOrderByDataInicioDescIdDesc(
                            imovelId, processoId);
        } else {
            contratos = contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(imovelId);
        }
        return contratos.stream().map(this::toContratoResponse).collect(Collectors.toList());
    }

    @Transactional
    public ImovelVinculoLocatarioResponse buscarVinculoLocatario(
            int numeroPlanilha, String codigoCliente, int numeroInterno) {
        return imovelVinculoLocatarioService.buscarOuMigrarLegadoPorVinculo(
                numeroPlanilha, codigoCliente, numeroInterno);
    }

    @Transactional
    public ImovelVinculoLocatarioResponse salvarVinculoLocatario(
            int numeroPlanilha, ImovelVinculoLocatarioWriteRequest req) {
        return imovelVinculoLocatarioService.salvarPorVinculo(numeroPlanilha, req);
    }

    /**
     * Publica {@link ContratoLocacaoAlteradoEvent} após commit para recálculo de IPTU (ver
     * {@link br.com.vilareal.iptu.application.IptuContratoRecalculoListener}).
     */
    @Transactional
    public ContratoLocacaoResponse criarContrato(ContratoLocacaoWriteRequest req) {
        if (req.getDataInicio() == null || req.getValorAluguel() == null) {
            throw new BusinessRuleException("Data de início e valor do aluguel são obrigatórios ao criar contrato.");
        }
        ImovelEntity im = requireImovel(req.getImovelId());
        ContratoLocacaoEntity c = new ContratoLocacaoEntity();
        c.setImovel(im);
        aplicarContrato(c, req, true);
        c = contratoLocacaoRepository.save(c);
        sincronizarPrazoVinculoProcessoComContrato(c);
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
        aplicarContrato(c, req, false);
        contratoLocacaoRepository.save(c);
        sincronizarPrazoVinculoProcessoComContrato(c);
        applicationEventPublisher.publishEvent(new ContratoLocacaoAlteradoEvent(id));
        return toContratoResponse(requireContrato(id));
    }

    private void sincronizarPrazoVinculoProcessoComContrato(ContratoLocacaoEntity contrato) {
        if (contrato.getImovel() == null || contrato.getImovel().getId() == null) {
            return;
        }
        imovelProcessoLinkService.sincronizarPrazoLocacaoComContrato(
                contrato.getImovel().getId(), contrato.getDataInicio(), contrato.getDataFim());
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
            return escolherMelhorImovelPorNumeroPlanilha(todos);
        }
        return todos.get(0);
    }

    /** Preferir registro com mais dados de cadastro (import-real vs. fantasma vazio). */
    static int scoreImovelCadastroPlanilha(ImovelEntity i) {
        int s = 0;
        if (StringUtils.hasText(i.getUnidade())) s += 4;
        if (StringUtils.hasText(i.getCondominio())) s += 2;
        if (StringUtils.hasText(i.getEnderecoCompleto())) s += 2;
        if (i.getProcesso() != null) s += 1;
        if (i.getCliente() != null) s += 1;
        if ("OCUPADO".equalsIgnoreCase(i.getSituacao())) s += 1;
        return s;
    }

    private ImovelEntity escolherMelhorImovelPorNumeroPlanilha(List<ImovelEntity> candidatos) {
        return candidatos.stream()
                .max(Comparator.comparingInt(ImovelApplicationService::scoreImovelCadastroPlanilha)
                        .thenComparing(ImovelEntity::getId, Comparator.reverseOrder()))
                .orElseThrow();
    }

    private void aplicarImovel(ImovelEntity e, ImovelWriteRequest req, boolean vincularProcessoViaLink) {
        if (req.getClienteId() != null) {
            var cliente = clienteResolverService.buscarPorId(req.getClienteId());
            e.setCliente(cliente);
            e.setPessoa(cliente.getPessoa());
        } else if (e.getId() == null) {
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
            } else if (e.getId() == null) {
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
        Integer numeroPlanilhaEfetivo;
        if (req.getNumeroPlanilha() != null) {
            e.setNumeroPlanilha(req.getNumeroPlanilha());
            numeroPlanilhaEfetivo = req.getNumeroPlanilha();
        } else if (e.getId() == null) {
            e.setNumeroPlanilha(null);
            numeroPlanilhaEfetivo = null;
        } else {
            numeroPlanilhaEfetivo = e.getNumeroPlanilha();
        }
        validarUnicidadeClienteNumeroPlanilha(e, numeroPlanilhaEfetivo);
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

    private void validarUnicidadeClienteNumeroPlanilha(ImovelEntity e, Integer numeroPlanilha) {
        if (numeroPlanilha == null) {
            return;
        }
        if (e.getCliente() != null) {
            imovelRepository
                    .findByCliente_IdAndNumeroPlanilha(e.getCliente().getId(), numeroPlanilha)
                    .ifPresent(other -> {
                        if (e.getId() == null || !other.getId().equals(e.getId())) {
                            throw new BusinessRuleException(
                                    "Número da planilha " + numeroPlanilha + " já vinculado a outro imóvel deste cliente"
                                            + " (id " + other.getId() + ").");
                        }
                    });
            return;
        }
        imovelRepository.findByNumeroPlanilha(numeroPlanilha).ifPresent(other -> {
            if (e.getId() == null || !other.getId().equals(e.getId())) {
                throw new BusinessRuleException(
                        "Número da planilha " + numeroPlanilha + " já vinculado a outro imóvel (id " + other.getId()
                                + ").");
            }
        });
    }

    private void aplicarContrato(ContratoLocacaoEntity c, ContratoLocacaoWriteRequest req, boolean novo) {
        if (novo) {
            c.setDataInicio(req.getDataInicio());
            c.setValorAluguel(req.getValorAluguel());
        } else {
            if (req.getDataInicio() != null) {
                c.setDataInicio(req.getDataInicio());
            }
            if (req.getValorAluguel() != null) {
                c.setValorAluguel(req.getValorAluguel());
            }
        }
        c.setDataFim(req.getDataFim());
        c.setValorRepassePactuado(req.getValorRepassePactuado());
        c.setDiaVencimentoAluguel(req.getDiaVencimentoAluguel());
        c.setFormaPagamentoAluguel(
                StringUtils.hasText(req.getFormaPagamentoAluguel())
                        ? FormaPagamentoAluguelLocacao.normalizar(req.getFormaPagamentoAluguel())
                        : null);
        c.setDiaRepasse(req.getDiaRepasse());
        if (req.getTaxaAdministracaoPercent() != null) {
            c.setTaxaAdministracaoPercent(req.getTaxaAdministracaoPercent());
        } else if (novo) {
            c.setTaxaAdministracaoPercent(new java.math.BigDecimal("10.00"));
        }
        c.setGarantiaTipo(trimToNull(req.getGarantiaTipo()));
        c.setValorGarantia(req.getValorGarantia());
        c.setDadosBancariosRepasseJson(trimToNull(req.getDadosBancariosRepasseJson()));
        c.setObservacoes(trimToNull(req.getObservacoes()));
        if (StringUtils.hasText(req.getStatus())) {
            c.setStatus(req.getStatus().trim());
        } else if (novo) {
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
        if (req.getInquilinosPessoaIds() != null) {
            if (req.getInquilinosPessoaIds().isEmpty()) {
                c.setInquilinosJson(null);
                c.setInquilinoPessoa(null);
            } else {
                ContratoLocacaoFiadorSupport.resolverFiadoresParaGravacao(req.getInquilinosPessoaIds(), pessoaRepository);
                c.setInquilinosJson(ContratoLocacaoFiadorSupport.serializarPessoaIds(req.getInquilinosPessoaIds()));
                Long primeiroInquilino = req.getInquilinosPessoaIds().get(0);
                PessoaEntity inq = pessoaRepository
                        .findById(primeiroInquilino)
                        .orElseThrow(() -> new ResourceNotFoundException("Inquilino não encontrado: " + primeiroInquilino));
                c.setInquilinoPessoa(inq);
            }
        } else if (req.getInquilinoPessoaId() != null) {
            PessoaEntity inq = pessoaRepository
                    .findById(req.getInquilinoPessoaId())
                    .orElseThrow(
                            () -> new ResourceNotFoundException("Inquilino não encontrado: " + req.getInquilinoPessoaId()));
            c.setInquilinoPessoa(inq);
            c.setInquilinosJson(
                    ContratoLocacaoFiadorSupport.serializarPessoaIds(List.of(req.getInquilinoPessoaId())));
        } else if (novo && req.getInquilinosPessoaIds() == null) {
            c.setInquilinoPessoa(null);
        }
        if (req.getFiadoresPessoaIds() != null) {
            if (req.getFiadoresPessoaIds().isEmpty()) {
                c.setFiadoresJson(null);
            } else {
                ContratoLocacaoFiadorSupport.resolverFiadoresParaGravacao(req.getFiadoresPessoaIds(), pessoaRepository);
                c.setFiadoresJson(ContratoLocacaoFiadorSupport.serializarPessoaIds(req.getFiadoresPessoaIds()));
            }
        }
        if (req.getProcessoId() != null) {
            ProcessoEntity proc = processoRepository
                    .findById(req.getProcessoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
            c.setProcesso(proc);
        } else if (novo) {
            c.setProcesso(null);
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
            String codEspelho = resolverCodigoClienteDoProcesso(procAtivo);
            if (StringUtils.hasText(codEspelho)) {
                r.setCodigoCliente(codEspelho);
            }
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
        r.setProcessoId(c.getProcesso() != null ? c.getProcesso().getId() : null);
        r.setLocadorPessoaId(c.getLocadorPessoa() != null ? c.getLocadorPessoa().getId() : null);
        r.setInquilinoPessoaId(c.getInquilinoPessoa() != null ? c.getInquilinoPessoa().getId() : null);
        r.setDataInicio(c.getDataInicio());
        r.setDataFim(c.getDataFim());
        r.setValorAluguel(c.getValorAluguel());
        r.setValorRepassePactuado(c.getValorRepassePactuado());
        r.setDiaVencimentoAluguel(c.getDiaVencimentoAluguel());
        r.setFormaPagamentoAluguel(c.getFormaPagamentoAluguel());
        r.setDiaRepasse(c.getDiaRepasse());
        r.setTaxaAdministracaoPercent(c.getTaxaAdministracaoPercent());
        r.setGarantiaTipo(c.getGarantiaTipo());
        r.setValorGarantia(c.getValorGarantia());
        r.setDadosBancariosRepasseJson(c.getDadosBancariosRepasseJson());
        r.setStatus(c.getStatus());
        r.setObservacoes(c.getObservacoes());
        r.setFiadoresPessoaIds(ContratoLocacaoFiadorSupport.extrairPessoaIds(c.getFiadoresJson()));
        r.setInquilinosPessoaIds(ContratoLocacaoFiadorSupport.extrairPessoaIds(c.getInquilinosJson()));
        if ((r.getInquilinosPessoaIds() == null || r.getInquilinosPessoaIds().isEmpty())
                && r.getInquilinoPessoaId() != null) {
            r.setInquilinosPessoaIds(List.of(r.getInquilinoPessoaId()));
        }
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
