package br.com.vilareal.pagamento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.pagamento.api.dto.prestacao.*;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.domain.PrestacaoContasStatus;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoHistoricoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PrestacaoContasEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PrestacaoContasPagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoHistoricoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PrestacaoContasPagamentoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PrestacaoContasRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.MalformedURLException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PrestacaoContasApplicationService {

    private final PrestacaoContasRepository prestacaoContasRepository;
    private final PrestacaoContasPagamentoRepository prestacaoContasPagamentoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final PagamentoHistoricoRepository historicoRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioRepository usuarioRepository;
    private final PrestacaoContasPdfService pdfService;
    private final Clock clock;

    public PrestacaoContasApplicationService(
            PrestacaoContasRepository prestacaoContasRepository,
            PrestacaoContasPagamentoRepository prestacaoContasPagamentoRepository,
            PagamentoRepository pagamentoRepository,
            PagamentoHistoricoRepository historicoRepository,
            ClienteRepository clienteRepository,
            UsuarioRepository usuarioRepository,
            PrestacaoContasPdfService pdfService,
            Clock clock) {
        this.prestacaoContasRepository = prestacaoContasRepository;
        this.prestacaoContasPagamentoRepository = prestacaoContasPagamentoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.historicoRepository = historicoRepository;
        this.clienteRepository = clienteRepository;
        this.usuarioRepository = usuarioRepository;
        this.pdfService = pdfService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PrestacaoContasPendenteGrupoResponse> pagamentosPendentes(
            Long clienteId, LocalDate periodoInicio, LocalDate periodoFim) {
        requireCliente(clienteId);
        List<PagamentoEntity> lista = pagamentoRepository.findPendentesPrestacaoContas(
                PagamentoDominio.ST_CONFERIDO, clienteId, periodoInicio, periodoFim);
        Map<Long, List<PagamentoEntity>> porImovel = new LinkedHashMap<>();
        List<PagamentoEntity> semImovel = new ArrayList<>();
        for (PagamentoEntity p : lista) {
            if (p.getImovel() == null || p.getImovel().getId() == null) {
                semImovel.add(p);
            } else {
                porImovel.computeIfAbsent(p.getImovel().getId(), k -> new ArrayList<>()).add(p);
            }
        }
        List<PrestacaoContasPendenteGrupoResponse> out = new ArrayList<>();
        for (Map.Entry<Long, List<PagamentoEntity>> e : porImovel.entrySet()) {
            out.add(grupoPendente(e.getValue().get(0).getImovel(), e.getValue()));
        }
        if (!semImovel.isEmpty()) {
            out.add(grupoPendente(null, semImovel));
        }
        return out;
    }

    @Transactional
    public PrestacaoContasDetailResponse criar(PrestacaoContasCreateRequest req) {
        ClienteEntity cliente = requireCliente(req.getClienteId());
        List<PagamentoEntity> pagamentos = carregarEValidarPagamentos(req.getPagamentoIds(), req.getClienteId());
        UsuarioEntity usuario = usuarioAtual();
        TotaisPrestacao totais = calcularTotais(pagamentos, req.getTaxaAdministracaoPercentual());

        PrestacaoContasEntity pc = new PrestacaoContasEntity();
        pc.setCliente(cliente);
        pc.setPeriodoInicio(req.getPeriodoInicio());
        pc.setPeriodoFim(req.getPeriodoFim());
        pc.setValorTotalPagamentos(totais.valorTotal());
        pc.setTaxaAdministracaoPercentual(req.getTaxaAdministracaoPercentual());
        pc.setTaxaAdministracaoValor(totais.taxaValor());
        pc.setValorLiquido(totais.valorLiquido());
        pc.setStatus(PrestacaoContasStatus.RASCUNHO);
        pc.setObservacoes(req.getObservacoes());
        pc.setGeradoPorUsuario(usuario);
        pc = prestacaoContasRepository.save(pc);

        vincularPagamentos(pc, pagamentos);
        return buscarDetalhe(pc.getId());
    }

    @Transactional(readOnly = true)
    public Page<PrestacaoContasListItemResponse> listar(
            Long clienteId,
            PrestacaoContasStatus status,
            LocalDate periodoInicio,
            LocalDate periodoFim,
            Pageable pageable) {
        Specification<PrestacaoContasEntity> spec =
                PrestacaoContasSpecifications.comFiltros(clienteId, status, periodoInicio, periodoFim);
        return prestacaoContasRepository.findAll(spec, pageable).map(this::toListItem);
    }

    @Transactional(readOnly = true)
    public PrestacaoContasDetailResponse buscarDetalhe(Long id) {
        PrestacaoContasEntity pc = requirePrestacao(id);
        List<PrestacaoContasPagamentoEntity> vinculos =
                prestacaoContasPagamentoRepository.findByPrestacaoContas_IdOrderByIdAsc(id);
        List<PagamentoEntity> pagamentos =
                vinculos.stream().map(PrestacaoContasPagamentoEntity::getPagamento).toList();
        return toDetail(pc, pagamentos);
    }

    @Transactional
    public PrestacaoContasDetailResponse atualizar(Long id, PrestacaoContasUpdateRequest req) {
        PrestacaoContasEntity pc = requirePrestacao(id);
        exigirRascunho(pc);
        List<PagamentoEntity> atuais =
                prestacaoContasPagamentoRepository.findByPrestacaoContas_IdOrderByIdAsc(id).stream()
                        .map(PrestacaoContasPagamentoEntity::getPagamento)
                        .toList();
        Set<Long> idsAtuais =
                atuais.stream().map(PagamentoEntity::getId).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> idsNovos = new LinkedHashSet<>(req.getPagamentoIds());

        for (Long removido : idsAtuais) {
            if (!idsNovos.contains(removido)) {
                desvincularPagamento(pc, removido);
            }
        }
        List<Long> adicionar =
                idsNovos.stream().filter(pid -> !idsAtuais.contains(pid)).toList();
        List<PagamentoEntity> novosPagamentos = carregarEValidarPagamentos(adicionar, pc.getCliente().getId());
        vincularPagamentos(pc, novosPagamentos);

        List<PagamentoEntity> todos = prestacaoContasPagamentoRepository
                .findByPrestacaoContas_IdOrderByIdAsc(id)
                .stream()
                .map(PrestacaoContasPagamentoEntity::getPagamento)
                .toList();
        TotaisPrestacao totais = calcularTotais(todos, req.getTaxaAdministracaoPercentual());
        pc.setPeriodoInicio(req.getPeriodoInicio());
        pc.setPeriodoFim(req.getPeriodoFim());
        pc.setValorTotalPagamentos(totais.valorTotal());
        pc.setTaxaAdministracaoPercentual(req.getTaxaAdministracaoPercentual());
        pc.setTaxaAdministracaoValor(totais.taxaValor());
        pc.setValorLiquido(totais.valorLiquido());
        pc.setObservacoes(req.getObservacoes());
        prestacaoContasRepository.save(pc);
        return buscarDetalhe(id);
    }

    @Transactional
    public void excluir(Long id) {
        PrestacaoContasEntity pc = requirePrestacao(id);
        exigirRascunho(pc);
        List<PrestacaoContasPagamentoEntity> vinculos =
                prestacaoContasPagamentoRepository.findByPrestacaoContas_IdOrderByIdAsc(id);
        for (PrestacaoContasPagamentoEntity v : vinculos) {
            PagamentoEntity p = v.getPagamento();
            p.setPrestacaoContas(null);
            pagamentoRepository.save(p);
        }
        prestacaoContasPagamentoRepository.deleteByPrestacaoContas_Id(id);
        prestacaoContasRepository.delete(pc);
    }

    @Transactional
    public PrestacaoContasDetailResponse enviar(Long id) throws Exception {
        PrestacaoContasEntity pc = requirePrestacao(id);
        exigirRascunho(pc);
        UsuarioEntity usuario = usuarioAtual();
        List<PagamentoEntity> pagamentos = prestacaoContasPagamentoRepository
                .findByPrestacaoContas_IdOrderByIdAsc(id)
                .stream()
                .map(PrestacaoContasPagamentoEntity::getPagamento)
                .toList();
        for (PagamentoEntity p : pagamentos) {
            aplicarAcertoViaPrestacao(p, pc, usuario);
        }
        pc.setStatus(PrestacaoContasStatus.ENVIADO);
        PrestacaoContasDetailResponse detalhe = toDetail(pc, pagamentos);
        String path = pdfService.gerarESalvar(pc, detalhe.getGruposPorImovel(), usuario.getNome());
        pc.setArquivoPdfPath(path);
        prestacaoContasRepository.save(pc);
        return buscarDetalhe(id);
    }

    @Transactional
    public PrestacaoContasDetailResponse aprovar(Long id) {
        PrestacaoContasEntity pc = requirePrestacao(id);
        if (pc.getStatus() != PrestacaoContasStatus.ENVIADO) {
            throw new BusinessRuleException("Somente prestações ENVIADAS podem ser aprovadas.");
        }
        pc.setStatus(PrestacaoContasStatus.APROVADO);
        prestacaoContasRepository.save(pc);
        return buscarDetalhe(id);
    }

    @Transactional(readOnly = true)
    public Resource recursoPdf(Long id) throws MalformedURLException {
        PrestacaoContasEntity pc = requirePrestacao(id);
        var path = pdfService.resolverArquivo(pc.getArquivoPdfPath());
        if (path == null) {
            throw new ResourceNotFoundException("PDF da prestação não encontrado.");
        }
        return new UrlResource(path.toUri());
    }

    private void aplicarAcertoViaPrestacao(PagamentoEntity p, PrestacaoContasEntity pc, UsuarioEntity u) {
        String ant = p.getStatus();
        p.setDataAcerto(LocalDate.now(clock));
        p.setStatus(PagamentoDominio.ST_ACERTADO);
        p.setAtualizadoPorUsuario(u);
        pagamentoRepository.save(p);
        registrarHistorico(
                p,
                u,
                "ACERTADO",
                ant,
                p.getStatus(),
                null,
                "Via prestação de contas #" + pc.getId());
    }

    private void vincularPagamentos(PrestacaoContasEntity pc, List<PagamentoEntity> pagamentos) {
        for (PagamentoEntity p : pagamentos) {
            PrestacaoContasPagamentoEntity link = new PrestacaoContasPagamentoEntity();
            link.setPrestacaoContas(pc);
            link.setPagamento(p);
            prestacaoContasPagamentoRepository.save(link);
            p.setPrestacaoContas(pc);
            pagamentoRepository.save(p);
        }
    }

    private void desvincularPagamento(PrestacaoContasEntity pc, Long pagamentoId) {
        prestacaoContasPagamentoRepository
                .findByPagamento_Id(pagamentoId)
                .ifPresent(link -> {
                    if (!link.getPrestacaoContas().getId().equals(pc.getId())) {
                        throw new BusinessRuleException("Pagamento não pertence a esta prestação.");
                    }
                    PagamentoEntity p = link.getPagamento();
                    p.setPrestacaoContas(null);
                    pagamentoRepository.save(p);
                    prestacaoContasPagamentoRepository.delete(link);
                });
    }

    private List<PagamentoEntity> carregarEValidarPagamentos(List<Long> ids, Long clienteId) {
        if (ids == null || ids.isEmpty()) {
            throw new BusinessRuleException("Informe ao menos um pagamento.");
        }
        List<PagamentoEntity> pagamentos = pagamentoRepository.findAllById(ids);
        if (pagamentos.size() != ids.size()) {
            throw new BusinessRuleException("Um ou mais pagamentos não foram encontrados.");
        }
        for (PagamentoEntity p : pagamentos) {
            if (!PagamentoDominio.ST_CONFERIDO.equals(p.getStatus())) {
                throw new BusinessRuleException(
                        "Pagamento #" + p.getId() + " não está com status CONFERIDO.");
            }
            if (p.getPrestacaoContas() != null) {
                throw new BusinessRuleException(
                        "Pagamento #"
                                + p.getId()
                                + " já está vinculado à prestação #"
                                + p.getPrestacaoContas().getId());
            }
            if (!pertenceCliente(p, clienteId)) {
                throw new BusinessRuleException(
                        "Pagamento #" + p.getId() + " não pertence ao cliente informado.");
            }
        }
        return pagamentos;
    }

    private static boolean pertenceCliente(PagamentoEntity p, Long clienteId) {
        if (p.getCliente() != null && clienteId.equals(p.getCliente().getId())) {
            return true;
        }
        ImovelEntity im = p.getImovel();
        return im != null && im.getCliente() != null && clienteId.equals(im.getCliente().getId());
    }

    private TotaisPrestacao calcularTotais(List<PagamentoEntity> pagamentos, BigDecimal taxaPct) {
        BigDecimal total = BigDecimal.ZERO;
        for (PagamentoEntity p : pagamentos) {
            BigDecimal v = p.getValorPagoBanco() != null ? p.getValorPagoBanco() : p.getValor();
            total = total.add(v != null ? v : BigDecimal.ZERO);
        }
        total = total.setScale(2, RoundingMode.HALF_UP);
        if (taxaPct != null) {
            if (taxaPct.compareTo(BigDecimal.ZERO) < 0 || taxaPct.compareTo(new BigDecimal("100")) > 0) {
                throw new BusinessRuleException("Taxa de administração deve estar entre 0 e 100.");
            }
            BigDecimal taxaValor =
                    total.multiply(taxaPct).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
            BigDecimal liquido = total.subtract(taxaValor).setScale(2, RoundingMode.HALF_UP);
            return new TotaisPrestacao(total, taxaValor, liquido);
        }
        return new TotaisPrestacao(total, null, total);
    }

    private PrestacaoContasPendenteGrupoResponse grupoPendente(ImovelEntity imovel, List<PagamentoEntity> pagamentos) {
        PrestacaoContasPendenteGrupoResponse g = new PrestacaoContasPendenteGrupoResponse();
        g.setImovel(toImovelDto(imovel));
        BigDecimal sub = BigDecimal.ZERO;
        List<PrestacaoContasPagamentoItemDto> itens = new ArrayList<>();
        for (PagamentoEntity p : pagamentos) {
            PrestacaoContasPagamentoItemDto dto = toPagamentoItem(p);
            itens.add(dto);
            BigDecimal v = dto.getValorPagoBanco() != null ? dto.getValorPagoBanco() : dto.getValor();
            sub = sub.add(v != null ? v : BigDecimal.ZERO);
        }
        g.setPagamentos(itens);
        g.setSubtotal(sub.setScale(2, RoundingMode.HALF_UP));
        g.setQuantidadePagamentos(itens.size());
        return g;
    }

    private PrestacaoContasListItemResponse toListItem(PrestacaoContasEntity pc) {
        PrestacaoContasListItemResponse r = new PrestacaoContasListItemResponse();
        r.setId(pc.getId());
        r.setCliente(toClienteDto(pc.getCliente()));
        r.setPeriodoInicio(pc.getPeriodoInicio());
        r.setPeriodoFim(pc.getPeriodoFim());
        r.setValorTotalPagamentos(pc.getValorTotalPagamentos());
        r.setTaxaAdministracaoPercentual(pc.getTaxaAdministracaoPercentual());
        r.setTaxaAdministracaoValor(pc.getTaxaAdministracaoValor());
        r.setValorLiquido(pc.getValorLiquido());
        r.setStatus(pc.getStatus());
        r.setCriadoEm(pc.getCriadoEm());
        int qtd = prestacaoContasPagamentoRepository.findByPrestacaoContas_IdOrderByIdAsc(pc.getId()).size();
        r.setQuantidadePagamentos(qtd);
        return r;
    }

    private PrestacaoContasDetailResponse toDetail(PrestacaoContasEntity pc, List<PagamentoEntity> pagamentos) {
        PrestacaoContasDetailResponse r = new PrestacaoContasDetailResponse();
        r.setId(pc.getId());
        r.setCliente(toClienteDto(pc.getCliente()));
        r.setPeriodoInicio(pc.getPeriodoInicio());
        r.setPeriodoFim(pc.getPeriodoFim());
        r.setValorTotalPagamentos(pc.getValorTotalPagamentos());
        r.setTaxaAdministracaoPercentual(pc.getTaxaAdministracaoPercentual());
        r.setTaxaAdministracaoValor(pc.getTaxaAdministracaoValor());
        r.setValorLiquido(pc.getValorLiquido());
        r.setStatus(pc.getStatus());
        r.setObservacoes(pc.getObservacoes());
        r.setArquivoPdfPath(pc.getArquivoPdfPath());
        r.setCriadoEm(pc.getCriadoEm());
        List<PrestacaoContasPagamentoItemDto> itens =
                pagamentos.stream().map(this::toPagamentoItem).toList();
        r.setPagamentos(itens);
        r.setGruposPorImovel(agruparPorImovel(pagamentos));
        return r;
    }

    private List<PrestacaoContasGrupoImovelDetailDto> agruparPorImovel(List<PagamentoEntity> pagamentos) {
        Map<Long, List<PagamentoEntity>> mapa = new LinkedHashMap<>();
        List<PagamentoEntity> sem = new ArrayList<>();
        for (PagamentoEntity p : pagamentos) {
            if (p.getImovel() == null || p.getImovel().getId() == null) {
                sem.add(p);
            } else {
                mapa.computeIfAbsent(p.getImovel().getId(), k -> new ArrayList<>()).add(p);
            }
        }
        List<PrestacaoContasGrupoImovelDetailDto> grupos = new ArrayList<>();
        for (List<PagamentoEntity> lista : mapa.values()) {
            grupos.add(grupoDetail(lista.get(0).getImovel(), lista));
        }
        if (!sem.isEmpty()) {
            grupos.add(grupoDetail(null, sem));
        }
        return grupos;
    }

    private PrestacaoContasGrupoImovelDetailDto grupoDetail(ImovelEntity imovel, List<PagamentoEntity> lista) {
        PrestacaoContasGrupoImovelDetailDto g = new PrestacaoContasGrupoImovelDetailDto();
        g.setImovel(toImovelDto(imovel));
        BigDecimal sub = BigDecimal.ZERO;
        List<PrestacaoContasPagamentoItemDto> itens = new ArrayList<>();
        for (PagamentoEntity p : lista) {
            PrestacaoContasPagamentoItemDto dto = toPagamentoItem(p);
            itens.add(dto);
            BigDecimal v = dto.getValorPagoBanco() != null ? dto.getValorPagoBanco() : dto.getValor();
            sub = sub.add(v != null ? v : BigDecimal.ZERO);
        }
        g.setPagamentos(itens);
        g.setSubtotal(sub.setScale(2, RoundingMode.HALF_UP));
        return g;
    }

    private PrestacaoContasPagamentoItemDto toPagamentoItem(PagamentoEntity p) {
        PrestacaoContasPagamentoItemDto dto = new PrestacaoContasPagamentoItemDto();
        dto.setId(p.getId());
        dto.setDescricao(p.getDescricao());
        dto.setCategoria(p.getCategoria());
        dto.setMesReferencia(p.getMesReferencia());
        dto.setDataVencimento(p.getDataVencimento());
        dto.setDataPagamentoEfetivo(p.getDataPagamentoEfetivo());
        dto.setValor(p.getValor());
        dto.setValorPagoBanco(p.getValorPagoBanco());
        dto.setValorDiferenca(p.getValorDiferenca());
        return dto;
    }

    private PrestacaoContasImovelDto toImovelDto(ImovelEntity im) {
        PrestacaoContasImovelDto dto = new PrestacaoContasImovelDto();
        if (im == null) {
            return dto;
        }
        dto.setId(im.getId());
        dto.setNumeroPlanilha(im.getNumeroPlanilha() != null ? "F-" + im.getNumeroPlanilha() : null);
        String end = im.getEnderecoCompleto();
        if (end == null || end.isBlank()) {
            end = im.getCondominio();
        }
        if (end == null || end.isBlank()) {
            end = im.getTitulo();
        }
        dto.setEndereco(end);
        return dto;
    }

    private PrestacaoContasClienteDto toClienteDto(ClienteEntity c) {
        PrestacaoContasClienteDto dto = new PrestacaoContasClienteDto();
        if (c == null) {
            return dto;
        }
        dto.setId(c.getId());
        dto.setCodigoCliente(c.getCodigoCliente());
        if (c.getPessoa() != null) {
            dto.setNome(c.getPessoa().getNome());
            dto.setDocumento(c.getPessoa().getCpf());
        } else {
            dto.setNome(c.getNomeReferencia());
            dto.setDocumento(c.getDocumentoReferencia());
        }
        return dto;
    }

    private ClienteEntity requireCliente(Long clienteId) {
        return clienteRepository
                .findById(clienteId)
                .orElseThrow(() -> new BusinessRuleException("Cliente não encontrado."));
    }

    private PrestacaoContasEntity requirePrestacao(Long id) {
        return prestacaoContasRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prestação de contas não encontrada."));
    }

    private static void exigirRascunho(PrestacaoContasEntity pc) {
        if (pc.getStatus() != PrestacaoContasStatus.RASCUNHO) {
            throw new BusinessRuleException(
                    "Somente prestações em RASCUNHO podem ser alteradas ou excluídas.");
        }
    }

    private void registrarHistorico(
            PagamentoEntity p,
            UsuarioEntity u,
            String acao,
            String stAnt,
            String stNov,
            String dadosJson,
            String obs) {
        PagamentoHistoricoEntity h = new PagamentoHistoricoEntity();
        h.setPagamento(p);
        h.setUsuario(u);
        h.setAcao(acao);
        h.setStatusAnterior(stAnt);
        h.setStatusNovo(stNov);
        h.setDadosAlteradosJson(dadosJson);
        h.setObservacao(obs);
        historicoRepository.save(h);
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

    private record TotaisPrestacao(BigDecimal valorTotal, BigDecimal taxaValor, BigDecimal valorLiquido) {}
}
