package br.com.vilareal.demanda.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.demanda.api.dto.*;
import br.com.vilareal.demanda.domain.DemandaDominio;
import br.com.vilareal.demanda.infrastructure.persistence.entity.DemandaEntity;
import br.com.vilareal.demanda.infrastructure.persistence.entity.DemandaHistoricoEntity;
import br.com.vilareal.demanda.infrastructure.persistence.repository.DemandaHistoricoRepository;
import br.com.vilareal.demanda.infrastructure.persistence.repository.DemandaRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.api.dto.PagamentoWriteRequest;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.domain.PagamentoRecorrenciaDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class DemandaApplicationService {

    private final DemandaRepository demandaRepository;
    private final DemandaHistoricoRepository demandaHistoricoRepository;
    private final ImovelRepository imovelRepository;
    private final ClienteRepository clienteRepository;
    private final PagamentoRepository pagamentoRepository;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public DemandaApplicationService(
            DemandaRepository demandaRepository,
            DemandaHistoricoRepository demandaHistoricoRepository,
            ImovelRepository imovelRepository,
            ClienteRepository clienteRepository,
            PagamentoRepository pagamentoRepository,
            PagamentoApplicationService pagamentoApplicationService,
            UsuarioRepository usuarioRepository,
            Clock clock) {
        this.demandaRepository = demandaRepository;
        this.demandaHistoricoRepository = demandaHistoricoRepository;
        this.imovelRepository = imovelRepository;
        this.clienteRepository = clienteRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<DemandaResponse> listar(
            Long imovelId, Long clienteId, String status, String categoria, Boolean vencidas, String busca) {
        List<DemandaEntity> lista = demandaRepository.findAllComRelacionamentos();
        LocalDate hoje = LocalDate.now(clock);
        String buscaNorm = busca != null ? busca.trim().toLowerCase(Locale.ROOT) : "";

        return lista.stream()
                .filter(d -> imovelId == null || d.getImovel().getId().equals(imovelId))
                .filter(d -> clienteId == null || d.getCliente().getId().equals(clienteId))
                .filter(d -> !StringUtils.hasText(status) || status.equalsIgnoreCase(d.getStatus()))
                .filter(d -> !StringUtils.hasText(categoria) || categoria.equalsIgnoreCase(d.getCategoria()))
                .filter(d -> !Boolean.TRUE.equals(vencidas)
                        || (d.getPrazoFinalizacao() != null
                                && d.getPrazoFinalizacao().isBefore(hoje)
                                && DemandaDominio.STATUS_ATIVOS.contains(d.getStatus())))
                .filter(d -> !StringUtils.hasText(buscaNorm) || matchesBusca(d, buscaNorm))
                .sorted(Comparator.comparing(DemandaEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(d -> toResponse(d, false))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DemandaResponse buscar(Long id) {
        DemandaEntity e = requireComRelacionamentos(id);
        List<DemandaHistoricoEntity> hist =
                demandaHistoricoRepository.findByDemandaIdOrderByCreatedAtDesc(id);
        return toResponse(e, true, hist);
    }

    @Transactional
    public DemandaResponse criar(DemandaWriteRequest req) {
        UsuarioEntity u = usuarioAtual();
        DemandaEntity e = new DemandaEntity();
        aplicarCampos(e, req);
        e.setCriadoPor(u);
        if (!StringUtils.hasText(e.getStatus())) {
            e.setStatus(DemandaDominio.STATUS_ABERTO);
        }
        e = demandaRepository.save(e);
        registrarHistorico(e, null, e.getStatus(), "Demanda criada", u);
        return buscar(e.getId());
    }

    @Transactional
    public DemandaResponse atualizar(Long id, DemandaWriteRequest req) {
        DemandaEntity e = require(id);
        String statusAnt = e.getStatus();
        aplicarCampos(e, req);
        e = demandaRepository.save(e);
        if (!statusAnt.equals(e.getStatus())) {
            registrarHistorico(e, statusAnt, e.getStatus(), "Demanda editada (status alterado)", usuarioAtual());
        } else {
            registrarHistorico(e, statusAnt, e.getStatus(), "Demanda editada", usuarioAtual());
        }
        return buscar(e.getId());
    }

    @Transactional
    public DemandaResponse excluir(Long id) {
        return alterarStatus(id, DemandaDominio.STATUS_CANCELADO, "Demanda cancelada");
    }

    @Transactional
    public DemandaResponse alterarStatus(Long id, String novoStatus, String descricaoAcao) {
        if (!DemandaDominio.STATUS_VALIDOS.contains(novoStatus)) {
            throw new BusinessRuleException("Status inválido: " + novoStatus);
        }
        DemandaEntity e = require(id);
        String ant = e.getStatus();
        if (ant.equals(novoStatus)) {
            return buscar(id);
        }
        UsuarioEntity u = usuarioAtual();
        e.setStatus(novoStatus);
        e = demandaRepository.save(e);
        registrarHistorico(e, ant, novoStatus, descricaoAcao != null ? descricaoAcao : "Status alterado", u);
        return buscar(e.getId());
    }

    @Transactional
    public DemandaResponse vincularPagamento(Long demandaId, DemandaVincularPagamentoRequest req) {
        if (req.pagamentoId() == null) {
            throw new BusinessRuleException("Informe o pagamentoId.");
        }
        DemandaEntity e = require(demandaId);
        PagamentoEntity pag = pagamentoRepository
                .findById(req.pagamentoId())
                .orElseThrow(() -> new ResourceNotFoundException("Pagamento não encontrado."));
        if (pag.getImovel() != null && !pag.getImovel().getId().equals(e.getImovel().getId())) {
            throw new BusinessRuleException("Pagamento pertence a outro imóvel.");
        }
        e.setPagamento(pag);
        e = demandaRepository.save(e);
        registrarHistorico(e, e.getStatus(), e.getStatus(), "Pagamento #" + pag.getId() + " vinculado", usuarioAtual());
        return buscar(e.getId());
    }

    @Transactional
    public DemandaResponse criarPagamento(Long demandaId, DemandaCriarPagamentoRequest req) {
        DemandaEntity e = require(demandaId);
        if (e.getPagamento() != null) {
            throw new BusinessRuleException("Demanda já possui pagamento vinculado.");
        }
        if (!Boolean.TRUE.equals(e.getGeraValorContabil())) {
            throw new BusinessRuleException("Demanda não gera valor contábil.");
        }
        BigDecimal valor = req.valorOriginal() != null ? req.valorOriginal() : e.getValorEstimado();
        if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleException("Informe o valor do pagamento.");
        }
        LocalDate venc = req.dataVencimento() != null ? req.dataVencimento() : e.getPrazoFinalizacao();
        if (venc == null) {
            venc = LocalDate.now(clock).plusDays(7);
        }
        String catPag = StringUtils.hasText(req.categoria())
                ? mapearCategoriaPagamento(req.categoria())
                : mapearCategoriaPagamento(e.getCategoria());

        PagamentoWriteRequest pagReq = new PagamentoWriteRequest();
        pagReq.setImovelId(e.getImovel().getId());
        pagReq.setClienteId(e.getCliente().getId());
        pagReq.setDescricao(e.getDescricao());
        pagReq.setCategoria(catPag);
        pagReq.setValor(valor);
        pagReq.setDataVencimento(venc);
        pagReq.setFormaPagamento("OUTRO");
        pagReq.setFornecedorTexto(e.getFornecedorTexto());
        pagReq.setStatus(PagamentoDominio.ST_PENDENTE);
        pagReq.setOrigem("DEMANDA:" + demandaId);
        if (StringUtils.hasText(req.codigoBarras())) {
            pagReq.setCodigoBarras(req.codigoBarras());
        }
        if (StringUtils.hasText(req.observacao())) {
            pagReq.setObservacoes(req.observacao());
        }

        var pagResp = pagamentoApplicationService.criar(pagReq);
        PagamentoEntity pag = pagamentoRepository
                .findById(pagResp.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Pagamento não encontrado."));
        e.setPagamento(pag);
        e = demandaRepository.save(e);
        registrarHistorico(
                e,
                e.getStatus(),
                e.getStatus(),
                "Pagamento #" + pag.getId() + " criado automaticamente",
                usuarioAtual());
        return buscar(e.getId());
    }

    @Transactional
    public DemandaResponse desvincularPagamento(Long demandaId) {
        DemandaEntity e = require(demandaId);
        if (e.getPagamento() == null) {
            throw new BusinessRuleException("Demanda não possui pagamento vinculado.");
        }
        Long pagId = e.getPagamento().getId();
        e.setPagamento(null);
        e = demandaRepository.save(e);
        registrarHistorico(e, e.getStatus(), e.getStatus(), "Pagamento #" + pagId + " desvinculado", usuarioAtual());
        return buscar(e.getId());
    }

    @Transactional(readOnly = true)
    public DemandaMetricasResponse metricas(Long imovelId, Long clienteId) {
        List<DemandaEntity> lista = demandaRepository.findAllComRelacionamentos();
        LocalDate hoje = LocalDate.now(clock);

        long ativos = lista.stream()
                .filter(d -> filtroEscopo(d, imovelId, clienteId))
                .filter(d -> DemandaDominio.STATUS_ATIVOS.contains(d.getStatus()))
                .count();

        BigDecimal totalValores = lista.stream()
                .filter(d -> filtroEscopo(d, imovelId, clienteId))
                .filter(d -> Boolean.TRUE.equals(d.getGeraValorContabil()))
                .map(d -> d.getValorEstimado() != null ? d.getValorEstimado() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal reembolsoPendente = lista.stream()
                .filter(d -> filtroEscopo(d, imovelId, clienteId))
                .filter(d -> Boolean.TRUE.equals(d.getReembolsavelCliente()))
                .filter(d -> !estaReembolsado(d))
                .map(d -> d.getValorEstimado() != null ? d.getValorEstimado() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long vencidos = lista.stream()
                .filter(d -> filtroEscopo(d, imovelId, clienteId))
                .filter(d -> d.getPrazoFinalizacao() != null && d.getPrazoFinalizacao().isBefore(hoje))
                .filter(d -> DemandaDominio.STATUS_ATIVOS.contains(d.getStatus()))
                .count();

        return new DemandaMetricasResponse(ativos, totalValores, reembolsoPendente, vencidos);
    }

    @Transactional(readOnly = true)
    public DemandaResumoAcertoResponse resumoAcertoImovel(Long imovelId) {
        ImovelEntity imovel = imovelRepository
                .findById(imovelId)
                .orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado."));
        List<DemandaEntity> demandas = demandaRepository.findByImovelIdOrderByCreatedAtDesc(imovelId).stream()
                .filter(d -> Boolean.TRUE.equals(d.getGeraValorContabil()))
                .collect(Collectors.toList());

        BigDecimal despesas = demandas.stream()
                .filter(d -> Boolean.TRUE.equals(d.getPagoPeloEscritorio()))
                .map(d -> d.getValorEstimado() != null ? d.getValorEstimado() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal reembolsados = demandas.stream()
                .filter(this::estaReembolsado)
                .map(d -> d.getValorEstimado() != null ? d.getValorEstimado() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal saldo = despesas.subtract(reembolsados);

        ClienteEntity cliente = imovel.getCliente();
        String clienteNome = cliente != null ? nomeCliente(cliente) : null;
        Long clienteId = cliente != null ? cliente.getId() : null;

        List<DemandaResponse> itens = demandas.stream()
                .map(d -> demandaRepository.findByIdComRelacionamentos(d.getId()).orElse(d))
                .map(d -> toResponse(d, false))
                .collect(Collectors.toList());

        return new DemandaResumoAcertoResponse(
                imovel.getId(),
                imovel.getTitulo(),
                clienteId,
                clienteNome,
                despesas,
                reembolsados,
                saldo,
                itens);
    }

    @Transactional(readOnly = true)
    public List<DemandaHistoricoResponse> listarHistorico(Long demandaId) {
        require(demandaId);
        return demandaHistoricoRepository.findByDemandaIdOrderByCreatedAtDesc(demandaId).stream()
                .map(this::toHistoricoResponse)
                .collect(Collectors.toList());
    }

    private boolean estaReembolsado(DemandaEntity d) {
        PagamentoEntity p = d.getPagamento();
        return p != null && PagamentoDominio.ST_ACERTADO.equals(p.getStatus());
    }

    private boolean filtroEscopo(DemandaEntity d, Long imovelId, Long clienteId) {
        if (imovelId != null && !d.getImovel().getId().equals(imovelId)) {
            return false;
        }
        return clienteId == null || d.getCliente().getId().equals(clienteId);
    }

    private boolean matchesBusca(DemandaEntity d, String buscaNorm) {
        return contains(d.getDescricao(), buscaNorm)
                || contains(d.getFornecedorTexto(), buscaNorm)
                || contains(d.getCategoria(), buscaNorm)
                || contains(d.getImovel().getTitulo(), buscaNorm);
    }

    private static boolean contains(String s, String busca) {
        return s != null && s.toLowerCase(Locale.ROOT).contains(busca);
    }

    private void aplicarCampos(DemandaEntity e, DemandaWriteRequest req) {
        ImovelEntity imovel = imovelRepository
                .findById(req.imovelId())
                .orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado."));
        ClienteEntity cliente = clienteRepository
                .findById(req.clienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado."));
        if (imovel.getCliente() != null && !imovel.getCliente().getId().equals(cliente.getId())) {
            throw new BusinessRuleException("Cliente informado não corresponde ao imóvel.");
        }
        if (!DemandaDominio.CATEGORIAS_VALIDAS.contains(req.categoria())) {
            throw new BusinessRuleException("Categoria inválida: " + req.categoria());
        }
        if (StringUtils.hasText(req.status()) && !DemandaDominio.STATUS_VALIDOS.contains(req.status())) {
            throw new BusinessRuleException("Status inválido: " + req.status());
        }
        if (Boolean.TRUE.equals(req.geraValorContabil())
                && req.valorEstimado() != null
                && req.valorEstimado().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleException("Valor estimado deve ser positivo.");
        }

        e.setImovel(imovel);
        e.setCliente(cliente);
        e.setDescricao(req.descricao().trim());
        e.setCategoria(req.categoria());
        e.setFornecedorTexto(req.fornecedorTexto());
        if (StringUtils.hasText(req.status())) {
            e.setStatus(req.status());
        }
        e.setGeraValorContabil(req.geraValorContabil());
        e.setValorEstimado(req.valorEstimado());
        e.setPagoPeloEscritorio(req.pagoPeloEscritorio());
        e.setReembolsavelCliente(req.reembolsavelCliente());
        e.setPrazoCumprimento(req.prazoCumprimento());
        e.setPrazoFinalizacao(req.prazoFinalizacao());
        e.setObservacoes(req.observacoes());
    }

    private String mapearCategoriaPagamento(String categoriaDemanda) {
        if (DemandaDominio.CAT_CONDOMINIO.equals(categoriaDemanda)) {
            return PagamentoRecorrenciaDominio.CATEGORIAS_VALIDAS.contains("CONDOMINIO") ? "CONDOMINIO" : "OUTROS";
        }
        if (DemandaDominio.CAT_IMPOSTO_TAXA.equals(categoriaDemanda)) {
            return "IMPOSTO";
        }
        if (DemandaDominio.CAT_REFORMA.equals(categoriaDemanda) || DemandaDominio.CAT_MANUTENCAO.equals(categoriaDemanda)) {
            return "OBRA_REFORMA";
        }
        return "OUTROS";
    }

    private DemandaEntity require(Long id) {
        return demandaRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Demanda não encontrada."));
    }

    private DemandaEntity requireComRelacionamentos(Long id) {
        return demandaRepository
                .findByIdComRelacionamentos(id)
                .orElseThrow(() -> new ResourceNotFoundException("Demanda não encontrada."));
    }

    private void registrarHistorico(
            DemandaEntity demanda, String statusAnterior, String statusNovo, String descricao, UsuarioEntity u) {
        DemandaHistoricoEntity h = new DemandaHistoricoEntity();
        h.setDemanda(demanda);
        h.setStatusAnterior(statusAnterior);
        h.setStatusNovo(statusNovo);
        h.setDescricaoAcao(descricao);
        h.setUsuarioId(u != null ? u.getId() : null);
        demandaHistoricoRepository.save(h);
    }

    private DemandaResponse toResponse(DemandaEntity e, boolean comHistorico) {
        List<DemandaHistoricoEntity> hist = comHistorico
                ? demandaHistoricoRepository.findByDemandaIdOrderByCreatedAtDesc(e.getId())
                : List.of();
        return toResponse(e, comHistorico, hist);
    }

    private DemandaResponse toResponse(DemandaEntity e, boolean comHistorico, List<DemandaHistoricoEntity> hist) {
        ImovelEntity im = e.getImovel();
        ClienteEntity cl = e.getCliente();
        PagamentoEntity pag = e.getPagamento();
        LancamentoFinanceiroEntity fl = pag != null ? pag.getFinanceiroLancamento() : null;

        List<DemandaHistoricoResponse> historicoResp = comHistorico
                ? hist.stream().map(this::toHistoricoResponse).collect(Collectors.toList())
                : null;

        return new DemandaResponse(
                e.getId(),
                im != null ? im.getId() : null,
                im != null ? im.getTitulo() : null,
                im != null ? im.getEnderecoCompleto() : null,
                cl != null ? cl.getId() : null,
                cl != null ? nomeCliente(cl) : null,
                cl != null ? cl.getCodigoCliente() : null,
                pag != null ? pag.getId() : null,
                pag != null ? pag.getStatus() : null,
                pag != null ? pag.getValor() : null,
                fl != null ? fl.getId() : null,
                e.getDescricao(),
                e.getCategoria(),
                e.getFornecedorTexto(),
                e.getStatus(),
                e.getGeraValorContabil(),
                e.getValorEstimado(),
                e.getPagoPeloEscritorio(),
                e.getReembolsavelCliente(),
                e.getPrazoCumprimento(),
                e.getPrazoFinalizacao(),
                e.getObservacoes(),
                e.getCriadoPor() != null ? e.getCriadoPor().getId() : null,
                e.getCreatedAt(),
                e.getUpdatedAt(),
                historicoResp);
    }

    private DemandaHistoricoResponse toHistoricoResponse(DemandaHistoricoEntity h) {
        return new DemandaHistoricoResponse(
                h.getId(),
                h.getStatusAnterior(),
                h.getStatusNovo(),
                h.getDescricaoAcao(),
                h.getUsuarioId(),
                h.getCreatedAt());
    }

    private String nomeCliente(ClienteEntity c) {
        if (StringUtils.hasText(c.getNomeReferencia())) {
            return c.getNomeReferencia();
        }
        PessoaEntity p = c.getPessoa();
        return p != null ? p.getNome() : null;
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
}
