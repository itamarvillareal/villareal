package br.com.vilareal.pagamento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.api.dto.recorrencia.*;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.domain.PagamentoRecorrenciaDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoRecorrenciaConfigEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRecorrenciaConfigRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.usuario.application.UsuarioDestinatarioGuard;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class PagamentoRecorrenciaService {

    private static final Pattern MES_ANO = Pattern.compile("^(0[1-9]|1[0-2])/\\d{4}$");
    private static final DateTimeFormatter FMT_MES_ANO = DateTimeFormatter.ofPattern("MM/yyyy", Locale.ROOT);

    private final PagamentoRecorrenciaConfigRepository configRepository;
    private final PagamentoRepository pagamentoRepository;
    private final ImovelRepository imovelRepository;
    private final ClienteRepository clienteRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final UsuarioRepository usuarioRepository;
    private final UsuarioDestinatarioGuard usuarioDestinatarioGuard;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final Clock clock;

    public PagamentoRecorrenciaService(
            PagamentoRecorrenciaConfigRepository configRepository,
            PagamentoRepository pagamentoRepository,
            ImovelRepository imovelRepository,
            ClienteRepository clienteRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            UsuarioRepository usuarioRepository,
            UsuarioDestinatarioGuard usuarioDestinatarioGuard,
            PagamentoApplicationService pagamentoApplicationService,
            Clock clock) {
        this.configRepository = configRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.imovelRepository = imovelRepository;
        this.clienteRepository = clienteRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.usuarioRepository = usuarioRepository;
        this.usuarioDestinatarioGuard = usuarioDestinatarioGuard;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PagamentoRecorrenciaConfigResponse> listar(Long imovelId, String categoria, Boolean ativo) {
        String cat = StringUtils.hasText(categoria) ? categoria.trim().toUpperCase(Locale.ROOT) : null;
        return configRepository.listarComFiltros(imovelId, cat, ativo).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PagamentoRecorrenciaConfigResponse buscar(Long id) {
        return toResponse(requireConfig(id));
    }

    @Transactional
    public PagamentoRecorrenciaConfigResponse criar(PagamentoRecorrenciaConfigWriteRequest req) {
        UsuarioEntity u = usuarioAtual();
        PagamentoRecorrenciaConfigEntity e = new PagamentoRecorrenciaConfigEntity();
        e.setCriadoPorUsuario(u);
        e.setAtivo(true);
        aplicarCampos(e, req);
        return toResponse(configRepository.save(e));
    }

    @Transactional
    public PagamentoRecorrenciaConfigResponse atualizar(Long id, PagamentoRecorrenciaConfigWriteRequest req) {
        PagamentoRecorrenciaConfigEntity e = requireConfig(id);
        aplicarCampos(e, req);
        return toResponse(configRepository.save(e));
    }

    @Transactional
    public void desativar(Long id) {
        PagamentoRecorrenciaConfigEntity e = requireConfig(id);
        if (!Boolean.TRUE.equals(e.getAtivo())) {
            throw new BusinessRuleException("Recorrência já está inativa.");
        }
        e.setAtivo(false);
        configRepository.save(e);
    }

    @Transactional
    public PagamentoRecorrenciaConfigResponse ativar(Long id) {
        PagamentoRecorrenciaConfigEntity e = requireConfig(id);
        if (Boolean.TRUE.equals(e.getAtivo())) {
            throw new BusinessRuleException("Recorrência já está ativa.");
        }
        e.setAtivo(true);
        return toResponse(configRepository.save(e));
    }

    @Transactional(readOnly = true)
    public PagamentoRecorrenciaGeradosPageResponse pagamentosGerados(Long configId, int page, int size) {
        requireConfig(configId);
        int sz = size > 0 ? Math.min(size, 100) : 12;
        Pageable pageable = PageRequest.of(Math.max(page, 0), sz);
        Page<PagamentoEntity> pg =
                pagamentoRepository.findByRecorrenciaConfig_IdOrderByMesReferenciaDescIdDesc(configId, pageable);
        PagamentoRecorrenciaGeradosPageResponse resp = new PagamentoRecorrenciaGeradosPageResponse();
        resp.setPage(pg.getNumber());
        resp.setSize(pg.getSize());
        resp.setTotalElements(pg.getTotalElements());
        resp.setTotalPages(pg.getTotalPages());
        resp.setContent(pg.getContent().stream().map(this::toGeradoItem).toList());
        return resp;
    }

    @Transactional
    public PagamentoRecorrenciaGerarMesResponse gerarMes(String mesAnoParam) {
        String mesAno = resolverMesAno(mesAnoParam);
        YearMonth ym = parseMesAno(mesAno);
        UsuarioEntity u = usuarioAtual();
        List<PagamentoRecorrenciaConfigEntity> configs = configRepository.findByAtivoTrueOrderByIdAsc();

        PagamentoRecorrenciaGerarMesResponse resp = new PagamentoRecorrenciaGerarMesResponse();
        resp.setMesAno(mesAno);
        resp.setTotalConfigs(configs.size());

        int gerados = 0;
        int jaExistiam = 0;
        int erros = 0;

        for (PagamentoRecorrenciaConfigEntity config : configs) {
            PagamentoRecorrenciaGerarMesResponse.Detalhe d = new PagamentoRecorrenciaGerarMesResponse.Detalhe();
            d.setConfigId(config.getId());
            d.setDescricao(config.getDescricaoPadrao());
            if (config.getImovel() != null && config.getImovel().getNumeroPlanilha() != null) {
                d.setImovelNumeroPlanilha(String.valueOf(config.getImovel().getNumeroPlanilha()));
            }
            try {
                Optional<PagamentoEntity> existente =
                        pagamentoRepository.findFirstByRecorrenciaConfig_IdAndMesReferencia(config.getId(), mesAno);
                if (existente.isPresent()) {
                    d.setResultado("JA_EXISTIA");
                    d.setPagamentoId(existente.get().getId());
                    jaExistiam++;
                } else {
                    LocalDate venc = calcularDataVencimento(config.getDiaVencimento(), ym);
                    PagamentoEntity criado =
                            pagamentoApplicationService.criarPagamentoRecorrente(config, mesAno, venc, u);
                    d.setResultado("GERADO");
                    d.setPagamentoId(criado.getId());
                    gerados++;
                }
            } catch (Exception ex) {
                d.setResultado("ERRO");
                d.setMensagemErro(ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
                erros++;
            }
            resp.getDetalhes().add(d);
        }

        resp.setGerados(gerados);
        resp.setJaExistiam(jaExistiam);
        resp.setErros(erros);
        return resp;
    }

    static LocalDate calcularDataVencimento(int diaVencimento, YearMonth ym) {
        int dia = Math.min(Math.max(diaVencimento, 1), 31);
        int ultimo = ym.lengthOfMonth();
        int diaEfetivo = Math.min(dia, ultimo);
        return ym.atDay(diaEfetivo);
    }

    static String resolverMesAno(String mesAnoParam) {
        if (!StringUtils.hasText(mesAnoParam)) {
            return LocalDate.now().format(FMT_MES_ANO);
        }
        return mesAnoParam.trim();
    }

    static YearMonth parseMesAno(String mesAno) {
        if (!MES_ANO.matcher(mesAno).matches()) {
            throw new BusinessRuleException("Formato de mês/ano inválido. Use MM/YYYY.");
        }
        try {
            YearMonth ym = YearMonth.parse(mesAno, FMT_MES_ANO);
            int ano = ym.getYear();
            if (ano < 2000 || ano > 2100) {
                throw new BusinessRuleException("Ano fora do intervalo permitido.");
            }
            return ym;
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException("Formato de mês/ano inválido. Use MM/YYYY.");
        }
    }

    private void aplicarCampos(PagamentoRecorrenciaConfigEntity e, PagamentoRecorrenciaConfigWriteRequest req) {
        validarWrite(req);
        ImovelEntity imovel = imovelRepository
                .findById(req.getImovelId())
                .orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado."));
        e.setImovel(imovel);

        Long clienteId = req.getClienteId();
        if (clienteId == null && imovel.getCliente() != null) {
            clienteId = imovel.getCliente().getId();
        }
        e.setCliente(clienteId != null ? resolveCliente(clienteId) : null);

        if (req.getContratoLocacaoId() != null) {
            e.setContratoLocacao(resolveContrato(req.getContratoLocacaoId()));
        } else {
            e.setContratoLocacao(null);
        }

        e.setCategoria(req.getCategoria().trim().toUpperCase(Locale.ROOT));
        e.setDescricaoPadrao(req.getDescricaoPadrao().trim());
        e.setContaReferencia(
                StringUtils.hasText(req.getContaReferencia()) ? req.getContaReferencia().trim() : null);
        e.setDiaVencimento(req.getDiaVencimento());
        e.setValorEstimado(req.getValorEstimado());
        e.setFormaPagamento(req.getFormaPagamento().trim().toUpperCase(Locale.ROOT));
        e.setResponsavelUsuario(
                req.getResponsavelUsuarioId() != null ? resolveUsuario(req.getResponsavelUsuarioId()) : null);
        e.setPrioridade(
                StringUtils.hasText(req.getPrioridade())
                        ? req.getPrioridade().trim().toUpperCase(Locale.ROOT)
                        : "NORMAL");
    }

    private void validarWrite(PagamentoRecorrenciaConfigWriteRequest req) {
        String cat = req.getCategoria() != null ? req.getCategoria().trim().toUpperCase(Locale.ROOT) : "";
        if (!PagamentoRecorrenciaDominio.CATEGORIAS_VALIDAS.contains(cat)) {
            throw new BusinessRuleException("Categoria inválida.");
        }
        String fp = req.getFormaPagamento() != null ? req.getFormaPagamento().trim().toUpperCase(Locale.ROOT) : "";
        if (!PagamentoRecorrenciaDominio.FORMAS_PAGAMENTO_VALIDAS.contains(fp)) {
            throw new BusinessRuleException("Forma de pagamento inválida.");
        }
        if (req.getDiaVencimento() == null || req.getDiaVencimento() < 1 || req.getDiaVencimento() > 31) {
            throw new BusinessRuleException("Dia de vencimento deve estar entre 1 e 31.");
        }
        String pri = req.getPrioridade() != null ? req.getPrioridade().trim().toUpperCase(Locale.ROOT) : "NORMAL";
        if (!PagamentoRecorrenciaDominio.PRIORIDADES_VALIDAS.contains(pri)) {
            throw new BusinessRuleException("Prioridade inválida.");
        }
    }

    private PagamentoRecorrenciaConfigEntity requireConfig(Long id) {
        return configRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recorrência não encontrada."));
    }

    private ClienteEntity resolveCliente(Long id) {
        return clienteRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado."));
    }

    private ContratoLocacaoEntity resolveContrato(Long id) {
        return contratoLocacaoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contrato não encontrado."));
    }

    private UsuarioEntity resolveUsuario(Long id) {
        return usuarioDestinatarioGuard.carregarHumanoDestinatario(id);
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

    private PagamentoRecorrenciaConfigResponse toResponse(PagamentoRecorrenciaConfigEntity e) {
        PagamentoRecorrenciaConfigResponse r = new PagamentoRecorrenciaConfigResponse();
        r.setId(e.getId());
        if (e.getImovel() != null) {
            r.setImovelId(e.getImovel().getId());
            r.setImovelNumeroPlanilha(e.getImovel().getNumeroPlanilha());
            r.setImovelEndereco(e.getImovel().getEnderecoCompleto());
            if (r.getImovelEndereco() == null || r.getImovelEndereco().isBlank()) {
                r.setImovelEndereco(e.getImovel().getCondominio());
            }
        }
        if (e.getCliente() != null) {
            r.setClienteId(e.getCliente().getId());
        }
        if (e.getContratoLocacao() != null) {
            r.setContratoLocacaoId(e.getContratoLocacao().getId());
        }
        r.setCategoria(e.getCategoria());
        r.setDescricaoPadrao(e.getDescricaoPadrao());
        r.setContaReferencia(e.getContaReferencia());
        r.setDiaVencimento(e.getDiaVencimento());
        r.setValorEstimado(e.getValorEstimado());
        r.setFormaPagamento(e.getFormaPagamento());
        if (e.getResponsavelUsuario() != null) {
            r.setResponsavelUsuarioId(e.getResponsavelUsuario().getId());
        }
        r.setPrioridade(e.getPrioridade());
        r.setAtivo(Boolean.TRUE.equals(e.getAtivo()));
        if (e.getCriadoPorUsuario() != null) {
            r.setCriadoPorUsuarioId(e.getCriadoPorUsuario().getId());
        }
        r.setCriadoEm(e.getCriadoEm());
        r.setAtualizadoEm(e.getAtualizadoEm());
        return r;
    }

    private PagamentoRecorrenciaGeradoItemResponse toGeradoItem(PagamentoEntity p) {
        PagamentoRecorrenciaGeradoItemResponse r = new PagamentoRecorrenciaGeradoItemResponse();
        r.setId(p.getId());
        r.setDescricao(p.getDescricao());
        r.setMesReferencia(p.getMesReferencia());
        r.setDataVencimento(p.getDataVencimento());
        r.setValor(p.getValor());
        r.setValorPagoBanco(p.getValorPagoBanco());
        r.setStatus(p.getStatus());
        r.setAutoGerado(Boolean.TRUE.equals(p.getAutoGerado()));
        return r;
    }
}
