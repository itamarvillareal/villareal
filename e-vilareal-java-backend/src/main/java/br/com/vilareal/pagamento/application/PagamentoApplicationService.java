package br.com.vilareal.pagamento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.api.dto.*;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoHistoricoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoHistoricoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PagamentoApplicationService {

    private static final ZoneId TZ_BR = ZoneId.of("America/Sao_Paulo");

    private final PagamentoRepository pagamentoRepository;
    private final PagamentoHistoricoRepository historicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ImovelRepository imovelRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final Clock clock;
    private final Path storageRoot;

    public PagamentoApplicationService(
            PagamentoRepository pagamentoRepository,
            PagamentoHistoricoRepository historicoRepository,
            UsuarioRepository usuarioRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ImovelRepository imovelRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            @Value("${vilareal.pagamentos.storage-dir:${java.io.tmpdir}/vilareal-pagamentos}") String storageDir,
            Clock clock) {
        this.pagamentoRepository = pagamentoRepository;
        this.historicoRepository = historicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.imovelRepository = imovelRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.clock = clock;
        this.storageRoot = Path.of(storageDir).toAbsolutePath().normalize();
    }

    @Transactional(readOnly = true)
    public List<PagamentoResponse> listar(PagamentoSpecifications.FiltroLista filtro) {
        LocalDate hoje = LocalDate.now(clock);
        Specification<PagamentoEntity> spec =
                filtro.temAlgum() ? PagamentoSpecifications.comFiltros(filtro, hoje) : Specification.where(null);
        return pagamentoRepository.findAll(spec).stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PagamentoResponse buscar(Long id) {
        return toResponse(requirePagamento(id));
    }

    @Transactional
    public PagamentoResponse criar(PagamentoWriteRequest req) {
        validarDominio(req);
        UsuarioEntity u = usuarioAtual();
        PagamentoEntity e = new PagamentoEntity();
        e.setDataCadastro(req.getDataCadastro() != null ? req.getDataCadastro() : LocalDate.now(clock));
        e.setCriadoPorUsuario(u);
        aplicarCampos(e, req, u, true);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "CRIACAO", null, e.getStatus(), null, null);
        return toResponse(e);
    }

    @Transactional
    public PagamentoResponse atualizar(Long id, PagamentoWriteRequest req) {
        validarDominio(req);
        UsuarioEntity u = usuarioAtual();
        PagamentoEntity e = requirePagamento(id);
        String stAnt = e.getStatus();
        aplicarCampos(e, req, u, false);
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "EDICAO", stAnt, e.getStatus(), null, null);
        return toResponse(e);
    }

    @Transactional
    public void excluir(Long id) {
        PagamentoEntity e = requirePagamento(id);
        UsuarioEntity u = usuarioAtual();
        if (PagamentoDominio.STATUS_FINAIS_PAGO.contains(e.getStatus()) && !ehAdmin(u)) {
            throw new BusinessRuleException("Only administrator can delete a paid payment.");
        }
        registrarHistorico(e, u, "EXCLUSAO", e.getStatus(), null, null, null);
        pagamentoRepository.delete(e);
    }

    @Transactional
    public PagamentoResponse cancelar(Long id, PagamentoCancelarRequest req) {
        PagamentoEntity e = requirePagamento(id);
        if (PagamentoDominio.STATUS_FINAIS_PAGO.contains(e.getStatus())) {
            throw new BusinessRuleException("Cannot cancel an already paid payment.");
        }
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();
        e.setStatus(PagamentoDominio.ST_CANCELADO);
        e.setCanceladoEm(Instant.now(clock));
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "CANCELAMENTO", ant, e.getStatus(), null, req != null ? req.getObservacao() : null);
        return toResponse(e);
    }

    @Transactional
    public PagamentoResponse marcarAgendado(Long id) {
        PagamentoEntity e = requirePagamento(id);
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();
        e.setStatus(PagamentoDominio.ST_AGENDADO);
        if (e.getDataAgendamento() == null) {
            e.setDataAgendamento(LocalDate.now(clock));
        }
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "AGENDADO", ant, e.getStatus(), null, null);
        return toResponse(e);
    }

    @Transactional
    public PagamentoResponse marcarPago(Long id, PagamentoMarcarPagoRequest req) {
        if (req.getDataPagamentoEfetivo() == null) {
            throw new BusinessRuleException("Provide the effective payment date.");
        }
        PagamentoEntity e = requirePagamento(id);
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();
        e.setDataPagamentoEfetivo(req.getDataPagamentoEfetivo());
        boolean temComp = e.getComprovanteArquivoPath() != null && !e.getComprovanteArquivoPath().isBlank();
        if (req.isSemComprovante() && !temComp) {
            e.setStatus(PagamentoDominio.ST_PAGO_SEM_COMPROVANTE);
        } else {
            e.setStatus(PagamentoDominio.ST_PAGO_CONFIRMADO);
        }
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "PAGO", ant, e.getStatus(), null, null);
        return toResponse(e);
    }

    @Transactional
    public PagamentoResponse substituir(Long id, Long novoPagamentoId) {
        PagamentoEntity e = requirePagamento(id);
        PagamentoEntity novo = requirePagamento(novoPagamentoId);
        UsuarioEntity u = usuarioAtual();
        String ant = e.getStatus();
        e.setStatus(PagamentoDominio.ST_SUBSTITUIDO);
        e.setSubstituidoPorPagamento(novo);
        e.setAtualizadoPorUsuario(u);
        e = pagamentoRepository.save(e);
        registrarHistorico(e, u, "SUBSTITUIDO", ant, e.getStatus(), "{\"novoId\":" + novoPagamentoId + "}", null);
        return toResponse(e);
    }

    @Transactional(readOnly = true)
    public List<PagamentoHistoricoResponse> listarHistorico(Long pagamentoId) {
        requirePagamento(pagamentoId);
        return historicoRepository.findByPagamento_IdOrderByCriadoEmDesc(pagamentoId).stream()
                .map(this::toHistoricoResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PagamentoDashboardResponse dashboard(Integer ano, Integer mes) {
        LocalDate hoje = LocalDate.now(clock);
        int a = ano != null ? ano : hoje.getYear();
        int m = mes != null ? mes : hoje.getMonthValue();
        LocalDate ini = LocalDate.of(a, m, 1);
        LocalDate fim = ini.plusMonths(1).minusDays(1);

        List<PagamentoEntity> todos = pagamentoRepository.findAll();
        PagamentoDashboardResponse d = new PagamentoDashboardResponse();

        BigDecimal apagar = BigDecimal.ZERO;
        BigDecimal pago = BigDecimal.ZERO;
        BigDecimal pend = BigDecimal.ZERO;
        BigDecimal ag = BigDecimal.ZERO;
        BigDecimal venc = BigDecimal.ZERO;
        BigDecimal conf = BigDecimal.ZERO;
        BigDecimal semComp = BigDecimal.ZERO;

        Map<String, BigDecimal> porCat = new LinkedHashMap<>();
        Map<String, BigDecimal> porResp = new LinkedHashMap<>();

        for (PagamentoEntity p : todos) {
            if (entreVencimento(p, ini, fim)) {
                String st = p.getStatus();
                if (List.of(
                                PagamentoDominio.ST_PENDENTE,
                                PagamentoDominio.ST_AGENDADO,
                                PagamentoDominio.ST_CONFERENCIA_PENDENTE,
                                PagamentoDominio.ST_VENCIDO)
                        .contains(st)) {
                    apagar = apagar.add(p.getValor());
                }
                if (PagamentoDominio.ST_PAGO_CONFIRMADO.equals(st)
                        || PagamentoDominio.ST_PAGO_SEM_COMPROVANTE.equals(st)) {
                    if (p.getDataPagamentoEfetivo() != null
                            && !p.getDataPagamentoEfetivo().isBefore(ini)
                            && !p.getDataPagamentoEfetivo().isAfter(fim)) {
                        pago = pago.add(p.getValor());
                    }
                }
            }
            switch (p.getStatus()) {
                case PagamentoDominio.ST_PENDENTE -> pend = pend.add(p.getValor());
                case PagamentoDominio.ST_AGENDADO -> ag = ag.add(p.getValor());
                case PagamentoDominio.ST_VENCIDO -> venc = venc.add(p.getValor());
                case PagamentoDominio.ST_CONFERENCIA_PENDENTE -> conf = conf.add(p.getValor());
                case PagamentoDominio.ST_PAGO_SEM_COMPROVANTE -> semComp = semComp.add(p.getValor());
                default -> {
                }
            }
            porCat.merge(p.getCategoria(), p.getValor(), BigDecimal::add);
            String respNome =
                    p.getResponsavelUsuario() != null ? p.getResponsavelUsuario().getNome() : "(sem responsável)";
            porResp.merge(respNome, p.getValor(), BigDecimal::add);
        }

        d.setTotalAPagarMes(apagar.setScale(2, RoundingMode.HALF_UP));
        d.setTotalPagoMes(pago.setScale(2, RoundingMode.HALF_UP));
        d.setTotalPendente(pend.setScale(2, RoundingMode.HALF_UP));
        d.setTotalAgendado(ag.setScale(2, RoundingMode.HALF_UP));
        d.setTotalVencido(venc.setScale(2, RoundingMode.HALF_UP));
        d.setTotalConferenciaPendente(conf.setScale(2, RoundingMode.HALF_UP));
        d.setTotalPagoSemComprovante(semComp.setScale(2, RoundingMode.HALF_UP));
        d.setPorCategoria(porCat);
        d.setPorResponsavel(porResp);
        return d;
    }

    private static boolean entreVencimento(PagamentoEntity p, LocalDate ini, LocalDate fim) {
        LocalDate v = p.getDataVencimento();
        return !v.isBefore(ini) && !v.isAfter(fim);
    }

    /** Job diário: atualiza status conforme calendário. */
    @Transactional
    public int aplicarTransicoesAutomaticasPorData() {
        LocalDate hoje = LocalDate.now(clock);
        int n = 0;
        for (PagamentoEntity p : pagamentoRepository.findAll()) {
            String st = p.getStatus();
            if (PagamentoDominio.ST_CANCELADO.equals(st)
                    || PagamentoDominio.ST_SUBSTITUIDO.equals(st)
                    || PagamentoDominio.ST_PAGO_CONFIRMADO.equals(st)
                    || PagamentoDominio.ST_PAGO_SEM_COMPROVANTE.equals(st)) {
                continue;
            }
            String novo = null;
            if (PagamentoDominio.ST_PENDENTE.equals(st) && hoje.isAfter(p.getDataVencimento())) {
                novo = PagamentoDominio.ST_VENCIDO;
            } else if (PagamentoDominio.ST_AGENDADO.equals(st) && hoje.isAfter(p.getDataVencimento())) {
                novo = PagamentoDominio.ST_CONFERENCIA_PENDENTE;
            }
            if (novo != null) {
                UsuarioEntity sistema = usuarioRepository
                        .findById(1L)
                        .orElseThrow(() -> new IllegalStateException("Usuário id=1 necessário para auditoria da rotina."));
                String ant = p.getStatus();
                p.setStatus(novo);
                p.setAtualizadoPorUsuario(sistema);
                pagamentoRepository.save(p);
                registrarHistorico(p, sistema, "ROTINA_DIARIA", ant, novo, null, null);
                n++;
            }
        }
        return n;
    }

    @Transactional
    public PagamentoResponse anexarBoleto(Long id, MultipartFile file) throws Exception {
        PagamentoEntity e = salvarAnexo(id, file, true);
        return toResponse(e);
    }

    @Transactional
    public PagamentoResponse anexarComprovante(Long id, MultipartFile file) throws Exception {
        PagamentoEntity e = salvarAnexo(id, file, false);
        if (PagamentoDominio.ST_PAGO_SEM_COMPROVANTE.equals(e.getStatus())) {
            e.setStatus(PagamentoDominio.ST_PAGO_CONFIRMADO);
            e.setAtualizadoPorUsuario(usuarioAtual());
            pagamentoRepository.save(e);
        }
        return toResponse(requirePagamento(id));
    }

    private PagamentoEntity salvarAnexo(Long id, MultipartFile file, boolean boleto) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new BusinessRuleException("Arquivo vazio.");
        }
        PagamentoEntity e = requirePagamento(id);
        UsuarioEntity u = usuarioAtual();
        Path dir = storageRoot.resolve(String.valueOf(id)).normalize();
        if (!dir.startsWith(storageRoot)) {
            throw new BusinessRuleException("Caminho inválido.");
        }
        Files.createDirectories(dir);
        String orig = file.getOriginalFilename() != null ? file.getOriginalFilename() : "arquivo";
        String ext = orig.contains(".") ? orig.substring(orig.lastIndexOf('.')) : "";
        String nome = (boleto ? "boleto-" : "comprovante-") + UUID.randomUUID() + ext;
        Path dest = dir.resolve(nome).normalize();
        if (!dest.startsWith(dir)) {
            throw new BusinessRuleException("Nome de arquivo inválido.");
        }
        Files.copy(file.getInputStream(), dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        String rel = id + "/" + nome;
        if (boleto) {
            e.setBoletoArquivoPath(rel);
            registrarHistorico(e, u, "ANEXO_BOLETO", e.getStatus(), e.getStatus(), "{\"path\":\"" + rel + "\"}", null);
        } else {
            e.setComprovanteArquivoPath(rel);
            registrarHistorico(e, u, "ANEXO_COMPROVANTE", e.getStatus(), e.getStatus(), "{\"path\":\"" + rel + "\"}", null);
        }
        e.setAtualizadoPorUsuario(u);
        return pagamentoRepository.save(e);
    }

    @Transactional(readOnly = true)
    public Resource recursoAnexo(Long pagamentoId, boolean boleto) throws MalformedURLException {
        PagamentoEntity e = requirePagamento(pagamentoId);
        String rel = boleto ? e.getBoletoArquivoPath() : e.getComprovanteArquivoPath();
        if (rel == null || rel.isBlank()) {
            throw new ResourceNotFoundException("Anexo não encontrado.");
        }
        Path p = storageRoot.resolve(rel).normalize();
        if (!p.startsWith(storageRoot) || !Files.isReadable(p)) {
            throw new ResourceNotFoundException("Ficheiro não encontrado em disco.");
        }
        return new UrlResource(p.toUri());
    }

    private void validarDominio(PagamentoWriteRequest req) {
        if (!PagamentoDominio.STATUS_VALIDOS.contains(req.getStatus())) {
            throw new BusinessRuleException("Status inválido.");
        }
        if (req.getDataAgendamento() != null
                && req.getDataAgendamento().isAfter(req.getDataVencimento())) {
            throw new BusinessRuleException("Data de agendamento posterior ao vencimento — verifique as datas.");
        }
    }

    private void aplicarCampos(PagamentoEntity e, PagamentoWriteRequest req, UsuarioEntity u, boolean criacao) {
        e.setDataAgendamento(req.getDataAgendamento());
        e.setDataVencimento(req.getDataVencimento());
        e.setCodigoBarras(req.getCodigoBarras());
        e.setValor(req.getValor());
        e.setDescricao(req.getDescricao().trim());
        e.setCategoria(req.getCategoria().trim());
        e.setFormaPagamento(req.getFormaPagamento().trim());
        e.setStatus(req.getStatus());
        e.setPrioridade(req.getPrioridade() != null ? req.getPrioridade() : "NORMAL");
        e.setOrigem(req.getOrigem());
        e.setDataPagamentoEfetivo(req.getDataPagamentoEfetivo());
        e.setObservacoes(req.getObservacoes());
        e.setRecorrente(Boolean.TRUE.equals(req.getRecorrente()));
        e.setRecorrenciaTipo(req.getRecorrenciaTipo());
        e.setRecorrenciaQuantidadeParcelas(req.getRecorrenciaQuantidadeParcelas());
        e.setRecorrenciaParcelaAtual(req.getRecorrenciaParcelaAtual());
        e.setRecorrenciaValorFixo(req.getRecorrenciaValorFixo());
        e.setRecorrenciaDescricaoPadrao(req.getRecorrenciaDescricaoPadrao());
        e.setCondominioTexto(req.getCondominioTexto());
        e.setFornecedorTexto(req.getFornecedorTexto());

        e.setCliente(resolveCliente(req.getClienteId()));
        e.setProcesso(resolveProcesso(req.getProcessoId()));
        e.setImovel(resolveImovel(req.getImovelId()));
        e.setContratoLocacao(resolveContrato(req.getContratoLocacaoId()));
        e.setResponsavelUsuario(resolveUsuario(req.getResponsavelUsuarioId()));
        if (req.getRecorrenciaPagamentoOrigemId() != null) {
            e.setRecorrenciaPagamentoOrigem(requirePagamento(req.getRecorrenciaPagamentoOrigemId()));
        }

        if (criacao && PagamentoDominio.ST_PAGO_CONFIRMADO.equals(req.getStatus())
                && req.getDataPagamentoEfetivo() == null) {
            throw new BusinessRuleException("Informe a data do pagamento para status Pago confirmado.");
        }
    }

    private ClienteEntity resolveCliente(Long id) {
        if (id == null) return null;
        return clienteRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado."));
    }

    private ProcessoEntity resolveProcesso(Long id) {
        if (id == null) return null;
        return processoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado."));
    }

    private ImovelEntity resolveImovel(Long id) {
        if (id == null) return null;
        return imovelRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado."));
    }

    private ContratoLocacaoEntity resolveContrato(Long id) {
        if (id == null) return null;
        return contratoLocacaoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Contrato não encontrado."));
    }

    private UsuarioEntity resolveUsuario(Long id) {
        if (id == null) return null;
        return usuarioRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado."));
    }

    private PagamentoEntity requirePagamento(Long id) {
        return pagamentoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Pagamento não encontrado."));
    }

    private PagamentoResponse toResponse(PagamentoEntity e) {
        PagamentoResponse r = new PagamentoResponse();
        r.setId(e.getId());
        r.setDataCadastro(e.getDataCadastro());
        r.setDataAgendamento(e.getDataAgendamento());
        r.setDataVencimento(e.getDataVencimento());
        r.setCodigoBarras(e.getCodigoBarras());
        r.setValor(e.getValor());
        r.setDescricao(e.getDescricao());
        r.setCategoria(e.getCategoria());
        r.setFormaPagamento(e.getFormaPagamento());
        if (e.getResponsavelUsuario() != null) {
            r.setResponsavelUsuarioId(e.getResponsavelUsuario().getId());
            r.setResponsavelNome(e.getResponsavelUsuario().getNome());
        }
        r.setStatus(e.getStatus());
        r.setPrioridade(e.getPrioridade());
        r.setOrigem(e.getOrigem());
        r.setDataPagamentoEfetivo(e.getDataPagamentoEfetivo());
        r.setObservacoes(e.getObservacoes());
        r.setTemBoletoAnexo(e.getBoletoArquivoPath() != null && !e.getBoletoArquivoPath().isBlank());
        r.setTemComprovanteAnexo(e.getComprovanteArquivoPath() != null && !e.getComprovanteArquivoPath().isBlank());
        if (e.getCliente() != null) {
            r.setClienteId(e.getCliente().getId());
            r.setClienteCodigo(e.getCliente().getCodigoCliente());
        }
        if (e.getProcesso() != null) {
            r.setProcessoId(e.getProcesso().getId());
            r.setProcessoNumeroInterno(e.getProcesso().getNumeroInterno());
        }
        if (e.getImovel() != null) {
            r.setImovelId(e.getImovel().getId());
            r.setImovelNumeroPlanilha(e.getImovel().getNumeroPlanilha());
        }
        r.setCondominioTexto(e.getCondominioTexto());
        if (e.getContratoLocacao() != null) {
            r.setContratoLocacaoId(e.getContratoLocacao().getId());
        }
        r.setFornecedorTexto(e.getFornecedorTexto());
        r.setRecorrente(Boolean.TRUE.equals(e.getRecorrente()));
        r.setRecorrenciaTipo(e.getRecorrenciaTipo());
        r.setRecorrenciaQuantidadeParcelas(e.getRecorrenciaQuantidadeParcelas());
        r.setRecorrenciaParcelaAtual(e.getRecorrenciaParcelaAtual());
        r.setRecorrenciaValorFixo(e.getRecorrenciaValorFixo());
        r.setRecorrenciaDescricaoPadrao(e.getRecorrenciaDescricaoPadrao());
        if (e.getRecorrenciaPagamentoOrigem() != null) {
            r.setRecorrenciaPagamentoOrigemId(e.getRecorrenciaPagamentoOrigem().getId());
        }
        if (e.getSubstituidoPorPagamento() != null) {
            r.setSubstituidoPorPagamentoId(e.getSubstituidoPorPagamento().getId());
        }
        r.setCanceladoEm(e.getCanceladoEm());
        if (e.getCriadoPorUsuario() != null) {
            r.setCriadoPorUsuarioId(e.getCriadoPorUsuario().getId());
        }
        if (e.getAtualizadoPorUsuario() != null) {
            r.setAtualizadoPorUsuarioId(e.getAtualizadoPorUsuario().getId());
        }
        r.setCriadoEm(e.getCriadoEm());
        r.setAtualizadoEm(e.getAtualizadoEm());
        return r;
    }

    private PagamentoHistoricoResponse toHistoricoResponse(PagamentoHistoricoEntity h) {
        PagamentoHistoricoResponse r = new PagamentoHistoricoResponse();
        r.setId(h.getId());
        r.setUsuarioId(h.getUsuario().getId());
        r.setUsuarioNome(h.getUsuario().getNome());
        r.setAcao(h.getAcao());
        r.setStatusAnterior(h.getStatusAnterior());
        r.setStatusNovo(h.getStatusNovo());
        r.setDadosAlteradosJson(h.getDadosAlteradosJson());
        r.setObservacao(h.getObservacao());
        r.setCriadoEm(h.getCriadoEm());
        return r;
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
        String login = a.getName();
        return usuarioRepository
                .findWithPerfilByLoginIgnoreCase(login)
                .orElseThrow(() -> new BusinessRuleException("Usuário não encontrado."));
    }

    private boolean ehAdmin(UsuarioEntity u) {
        return u.getPerfil() != null && "ADMIN".equalsIgnoreCase(u.getPerfil().getCodigo());
    }

    /** Expõe contagens para painel de alertas (frontend pode refinar mensagens). */
    @Transactional(readOnly = true)
    public Map<String, Long> contagemAlertas() {
        LocalDate hoje = LocalDate.now(clock);
        Map<String, Long> m = new LinkedHashMap<>();
        List<PagamentoEntity> todos = pagamentoRepository.findAll();
        m.put(
                "vencidos",
                todos.stream()
                        .filter(p -> hoje.isAfter(p.getDataVencimento()))
                        .filter(p -> !List.of(
                                        PagamentoDominio.ST_PAGO_CONFIRMADO,
                                        PagamentoDominio.ST_CANCELADO,
                                        PagamentoDominio.ST_SUBSTITUIDO)
                                .contains(p.getStatus()))
                        .count());
        m.put("vencendoHoje", todos.stream().filter(p -> hoje.equals(p.getDataVencimento())).count());
        m.put(
                "proximos3Dias",
                todos.stream()
                        .filter(p -> !p.getDataVencimento().isBefore(hoje)
                                && !p.getDataVencimento().isAfter(hoje.plusDays(3)))
                        .count());
        m.put(
                "proximos7Dias",
                todos.stream()
                        .filter(p -> !p.getDataVencimento().isBefore(hoje)
                                && !p.getDataVencimento().isAfter(hoje.plusDays(7)))
                        .count());
        m.put(
                "agendadosAguardandoConfirmacao",
                todos.stream().filter(p -> PagamentoDominio.ST_AGENDADO.equals(p.getStatus())).count());
        m.put(
                "conferenciaPendente",
                todos.stream()
                        .filter(p -> PagamentoDominio.ST_CONFERENCIA_PENDENTE.equals(p.getStatus()))
                        .count());
        m.put(
                "pagoSemComprovante",
                todos.stream()
                        .filter(p -> PagamentoDominio.ST_PAGO_SEM_COMPROVANTE.equals(p.getStatus()))
                        .count());
        m.put(
                "altoValor",
                todos.stream().filter(p -> p.getValor().compareTo(new BigDecimal("10000")) >= 0).count());
        m.put(
                "urgentes",
                todos.stream().filter(p -> "URGENTE".equalsIgnoreCase(p.getPrioridade())).count());
        return m;
    }
}
