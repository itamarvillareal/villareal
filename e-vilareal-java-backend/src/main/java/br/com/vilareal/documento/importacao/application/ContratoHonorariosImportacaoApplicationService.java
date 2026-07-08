package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.*;
import br.com.vilareal.documento.importacao.ContratoHonorariosImportacaoRoteamento;
import br.com.vilareal.documento.importacao.ContratoHonorariosImportacaoStatus;
import br.com.vilareal.documento.importacao.api.dto.*;
import br.com.vilareal.documento.importacao.infrastructure.persistence.entity.ContratoHonorariosImportacaoEntity;
import br.com.vilareal.documento.importacao.infrastructure.persistence.repository.ContratoHonorariosCobrancaArmadaRepository;
import br.com.vilareal.documento.importacao.infrastructure.persistence.repository.ContratoHonorariosImportacaoRepository;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.mensalista.api.dto.MensalistaWriteRequest;
import br.com.vilareal.mensalista.application.MensalistaApplicationService;
import br.com.vilareal.mensalista.infrastructure.persistence.entity.MensalistaEntity;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.ProcessoExclusaoService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class ContratoHonorariosImportacaoApplicationService {

    private final ContratoHonorariosImportacaoRepository importacaoRepository;
    private final ContratoHonorariosRepository contratoRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ContratoHonorariosExtracaoService extracaoService;
    private final ContratoHonorariosImportacaoProcessoResolverService processoResolver;
    private final ContratoHonorariosService contratoHonorariosService;
    private final ContratoHonorariosPersistenciaService persistenciaService;
    private final MensalistaApplicationService mensalistaService;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;
    private final ProcessoExclusaoService processoExclusaoService;
    private final ContratoHonorariosImportacaoReversaoService reversaoService;
    private final ContratoHonorariosCobrancaArmadaRepository armadaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final int maxItensPorLote;
    private final Path tempDir;

    public ContratoHonorariosImportacaoApplicationService(
            ContratoHonorariosImportacaoRepository importacaoRepository,
            ContratoHonorariosRepository contratoRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ContratoHonorariosExtracaoService extracaoService,
            ContratoHonorariosImportacaoProcessoResolverService processoResolver,
            ContratoHonorariosService contratoHonorariosService,
            ContratoHonorariosPersistenciaService persistenciaService,
            MensalistaApplicationService mensalistaService,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService,
            ProcessoExclusaoService processoExclusaoService,
            ContratoHonorariosImportacaoReversaoService reversaoService,
            ContratoHonorariosCobrancaArmadaRepository armadaRepository,
            UsuarioRepository usuarioRepository,
            ObjectMapper objectMapper,
            Clock clock,
            @Value("${vilareal.honorarios.importacao.max-itens-lote:200}") int maxItensPorLote,
            @Value("${vilareal.honorarios.importacao.temp-dir:}") String tempDirConfig) throws IOException {
        this.importacaoRepository = importacaoRepository;
        this.contratoRepository = contratoRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.extracaoService = extracaoService;
        this.processoResolver = processoResolver;
        this.contratoHonorariosService = contratoHonorariosService;
        this.persistenciaService = persistenciaService;
        this.mensalistaService = mensalistaService;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
        this.processoExclusaoService = processoExclusaoService;
        this.reversaoService = reversaoService;
        this.armadaRepository = armadaRepository;
        this.usuarioRepository = usuarioRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.maxItensPorLote = Math.max(1, maxItensPorLote);
        this.tempDir = StringUtils.hasText(tempDirConfig)
                ? Path.of(tempDirConfig)
                : Path.of(System.getProperty("java.io.tmpdir"), "vilareal-chi");
        Files.createDirectories(this.tempDir);
    }

    @Transactional
    public ContratoHonorariosImportarLoteResponse enfileirarLote(
            List<ArquivoPdf> arquivos, String codigoCliente, Long processoId) {
        if (arquivos == null || arquivos.isEmpty()) {
            throw new BusinessRuleException("Envie ao menos um PDF.");
        }
        String loteId = UUID.randomUUID().toString();
        Instant agora = Instant.now(clock);
        UsuarioEntity usuario = usuarioAtualOrNull();
        ClienteEntity cliente = resolverClienteOpcional(codigoCliente);
        ProcessoEntity processoCtx = processoId != null ? processoRepository.findById(processoId).orElse(null) : null;

        int enfileirados = 0;
        int limiteExcedido = 0;
        List<ContratoHonorariosImportacaoItemResponse> itens = new ArrayList<>();

        for (ArquivoPdf arq : arquivos) {
            if (enfileirados >= maxItensPorLote) {
                limiteExcedido++;
                continue;
            }
            String hash = sha256(arq.bytes());
            if (importacaoRepository.findByHashPdfAtivo(hash).isPresent()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "PDF já importado e ativo: " + arq.nome());
            }
            ContratoHonorariosImportacaoEntity item = new ContratoHonorariosImportacaoEntity();
            item.setImportacaoLoteId(loteId);
            item.setHashPdf(hash);
            item.setHashPdfAtivo(hash);
            item.setPdfNomeArquivo(arq.nome());
            item.setStatus(ContratoHonorariosImportacaoStatus.AGUARDANDO_EXTRACAO.name());
            item.setCriadoEm(agora);
            item.setCriadoPorUsuario(usuario);
            if (cliente != null) {
                item.setCliente(cliente);
                item.setCodigoCliente(cliente.getCodigoCliente());
            }
            if (processoCtx != null) {
                item.setProcesso(processoCtx);
            }
            item = importacaoRepository.save(item);
            salvarPdfTemporario(item.getId(), arq.bytes());
            enfileirados++;
            itens.add(toItemResponse(item, null, null, List.of(), null, false, null));
        }
        return new ContratoHonorariosImportarLoteResponse(loteId, enfileirados, limiteExcedido, itens);
    }

    @Transactional
    public void processarExtracaoItem(Long importacaoId) {
        ContratoHonorariosImportacaoEntity item = importacaoRepository
                .findById(importacaoId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));
        if (!ContratoHonorariosImportacaoStatus.AGUARDANDO_EXTRACAO.name().equals(item.getStatus())) {
            return;
        }
        byte[] pdf = lerPdfTemporario(importacaoId);
        if (pdf == null || pdf.length == 0) {
            item.setStatus(ContratoHonorariosImportacaoStatus.ERRO_EXTRACAO.name());
            item.setAlertasJson("[\"PDF temporário não encontrado\"]");
            importacaoRepository.save(item);
            return;
        }
        try {
            var resultado = extracaoService.extrair(pdf, item.getPdfNomeArquivo());
            item.setClausulaExtraidaTexto(resultado.clausulaExtraida());
            if (resultado.dados() != null) {
                item.setDadosExtraidosJson(objectMapper.writeValueAsString(resultado.dados()));
            }
            item.setScoreConfianca(resultado.scoreConfianca());
            item.setAlertasJson(objectMapper.writeValueAsString(resultado.alertas()));
            item.setStatus(ContratoHonorariosImportacaoStatus.EXTRAIDO.name());
            item.setAtualizadoEm(Instant.now(clock));
            importacaoRepository.save(item);
        } catch (Exception ex) {
            item.setStatus(ContratoHonorariosImportacaoStatus.ERRO_EXTRACAO.name());
            try {
                item.setAlertasJson(objectMapper.writeValueAsString(List.of(ex.getMessage())));
            } catch (Exception ignored) {
                item.setAlertasJson("[\"Erro na extração\"]");
            }
            importacaoRepository.save(item);
        }
    }

    @Transactional(readOnly = true)
    public Page<ContratoHonorariosImportacaoItemResponse> listarFila(
            String status, String codigoCliente, String loteId, Pageable pageable) {
        return importacaoRepository
                .listarFila(status, codigoCliente, loteId, pageable)
                .map(i -> toItemResponseCompleto(i));
    }

    @Transactional(readOnly = true)
    public ContratoHonorariosImportacaoItemResponse obter(Long id) {
        return toItemResponseCompleto(importacaoRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Importação não encontrada: " + id)));
    }

    @Transactional
    public ContratoHonorariosImportacaoItemResponse salvarRevisao(
            Long id, ContratoHonorariosExtracaoDados dados, String roteamento, Long processoId) {
        ContratoHonorariosImportacaoEntity item = importacaoRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Importação não encontrada: " + id));
        try {
            if (dados != null) {
                item.setDadosAprovadosJson(objectMapper.writeValueAsString(dados));
            }
        } catch (Exception ex) {
            throw new BusinessRuleException("Dados de revisão inválidos.");
        }
        if (StringUtils.hasText(roteamento)) {
            item.setRoteamentoTipo(roteamento);
        }
        if (processoId != null) {
            item.setProcesso(processoRepository.findById(processoId).orElse(null));
        }
        item.setStatus(ContratoHonorariosImportacaoStatus.EM_REVISAO.name());
        item.setAtualizadoEm(Instant.now(clock));
        return toItemResponseCompleto(importacaoRepository.save(item));
    }

    @Transactional
    public ContratoHonorariosImportacaoItemResponse aprovar(Long id, ContratoHonorariosImportarAprovarRequest req) {
        ContratoHonorariosImportacaoEntity item = importacaoRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Importação não encontrada: " + id));
        if (!Set.of(
                        ContratoHonorariosImportacaoStatus.EXTRAIDO.name(),
                        ContratoHonorariosImportacaoStatus.EM_REVISAO.name())
                .contains(item.getStatus())) {
            throw new BusinessRuleException("Item não está em estado aprovável: " + item.getStatus());
        }
        ContratoHonorariosExtracaoDados dados = req.dadosAprovados();
        if (dados == null) {
            dados = lerDadosJson(item.getDadosAprovadosJson());
        }
        if (dados == null) {
            dados = lerDadosJson(item.getDadosExtraidosJson());
        }
        if (dados == null) {
            throw new BusinessRuleException("Configure os dados de remuneração antes de aprovar.");
        }

        ContratoHonorariosImportacaoRoteamento roteamento = req.roteamentoTipo();
        if (roteamento == null) {
            roteamento = dados.temCasoVinculado()
                    ? ContratoHonorariosImportacaoRoteamento.HONORARIOS
                    : ContratoHonorariosImportacaoRoteamento.MENSALISTA;
        }

        if (roteamento == ContratoHonorariosImportacaoRoteamento.MENSALISTA) {
            aprovarMensalista(item, dados);
        } else {
            aprovarHonorarios(item, req, dados);
        }

        item.setStatus(ContratoHonorariosImportacaoStatus.APROVADO.name());
        item.setAprovadoEm(Instant.now(clock));
        item.setAtualizadoEm(Instant.now(clock));
        try {
            item.setDadosAprovadosJson(objectMapper.writeValueAsString(dados));
        } catch (Exception ignored) {
            // noop
        }
        salvarPdfNoDrive(item);
        return toItemResponseCompleto(importacaoRepository.save(item));
    }

    private void aprovarMensalista(ContratoHonorariosImportacaoEntity item, ContratoHonorariosExtracaoDados dados) {
        ClienteEntity cliente = item.getCliente();
        if (cliente == null && StringUtils.hasText(item.getCodigoCliente())) {
            cliente = clienteRepository
                    .findByCodigoClienteFetchPessoaTrim(item.getCodigoCliente().trim())
                    .orElseThrow(() -> new BusinessRuleException("Cliente não encontrado."));
        }
        if (cliente == null) {
            throw new BusinessRuleException("Informe o cliente para mensalista.");
        }
        BigDecimal valor = dados.valorFixo();
        if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleException("Valor mensal inválido.");
        }
        LocalDate inicio = dados.dataContrato() != null ? dados.dataContrato() : LocalDate.now(clock);
        int dia = inicio.getDayOfMonth();
        var saved = mensalistaService.salvar(new MensalistaWriteRequest(
                cliente.getId(), valor, dia, inicio, null, true));
        MensalistaEntity men = new MensalistaEntity();
        men.setId(saved.id());
        item.setMensalista(men);
        item.setRoteamentoTipo(ContratoHonorariosImportacaoRoteamento.MENSALISTA.name());
    }

    private void aprovarHonorarios(
            ContratoHonorariosImportacaoEntity item,
            ContratoHonorariosImportarAprovarRequest req,
            ContratoHonorariosExtracaoDados dados) {
        boolean stubAntes = item.getProcesso() == null;
        ProcessoEntity processo = processoResolver.resolverOuCriarStub(item, req.processoStub(), req.processoId());
        item.setProcesso(processo);
        if (stubAntes && processo.getImportacaoItemId() == null) {
            processo.setImportacaoItemId(item.getId());
            processoRepository.save(processo);
            item.setProcessoStubCriado(true);
        }
        if (processo.getCliente() != null) {
            item.setCliente(processo.getCliente());
            item.setCodigoCliente(processo.getCliente().getCodigoCliente());
        }

        Optional<ContratoHonorariosEntity> existente = contratoRepository.findByProcessoIdWithDetalhes(processo.getId());
        if (existente.isPresent() && !req.forcarAtualizacao()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Processo já possui contrato de honorários (id="
                            + existente.get().getId()
                            + "). Use forcarAtualizacao=true para substituir.");
        }

        LocalDate dataContrato = dados.dataContrato() != null ? dados.dataContrato() : LocalDate.now(clock);
        ContratoHonorariosClausula3Dados clausula3 =
                ContratoHonorariosImportacaoParcelasUtil.prepararDadosHistoricos(dados.toClausula3Dados(), dataContrato);

        Long pessoaId = processo.getPessoa() != null ? processo.getPessoa().getId() : null;
        if (pessoaId == null) {
            throw new BusinessRuleException("Processo sem pessoa titular.");
        }

        ContratoHonorariosRequest contratoReq = new ContratoHonorariosRequest(
                pessoaId,
                List.of(),
                item.getCodigoCliente(),
                processo.getNumeroInterno(),
                null,
                dataContrato,
                processo.getId(),
                dados.formaAssinatura() != null ? dados.formaAssinatura() : "duas_vias",
                dados.objetoContrato(),
                null,
                clausula3,
                null,
                true,
                new ContratoHonorariosWhatsAppCobrancaConfig(false, "09:00", "VENCIMENTO_DIA", List.of()));

        var salvo = contratoHonorariosService.salvarContratacaoProcesso(processo.getId(), contratoReq);
        ContratoHonorariosEntity contrato = contratoRepository
                .findByProcessoIdWithDetalhes(processo.getId())
                .orElseThrow();

        aplicarExpectativa(contrato, req, dados);
        contratoRepository.save(contrato);

        item.setContratoHonorarios(contrato);
        item.setRoteamentoTipo(ContratoHonorariosImportacaoRoteamento.HONORARIOS.name());
    }

    private void aplicarExpectativa(
            ContratoHonorariosEntity contrato,
            ContratoHonorariosImportarAprovarRequest req,
            ContratoHonorariosExtracaoDados dados) {
        if (!"PERCENTUAL_PROVEITO".equalsIgnoreCase(contrato.getTipoRemuneracao())
                && !"MISTO".equalsIgnoreCase(contrato.getTipoRemuneracao())) {
            return;
        }
        BigDecimal estimativa = req.expectativaValorEstimado();
        if (estimativa == null && dados.percentualProveito() != null) {
            BigDecimal base = req.expectativaValorCausaRef();
            if (base == null) {
                base = dados.valorCausaExtraido();
            }
            if (base != null) {
                estimativa = base.multiply(dados.percentualProveito())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
        }
        if (estimativa != null && estimativa.signum() > 0) {
            contrato.setExpectativaValorEstimado(estimativa);
            contrato.setExpectativaBaseTipo(
                    StringUtils.hasText(req.expectativaBaseTipo()) ? req.expectativaBaseTipo() : "ESTIMATIVA");
            contrato.setExpectativaValorCausaRef(req.expectativaValorCausaRef() != null
                    ? req.expectativaValorCausaRef()
                    : dados.valorCausaExtraido());
            contrato.setExpectativaObservacao("Expectativa estimada — não confirmada em caixa");
        }
    }

    @Transactional
    public void rejeitar(Long id) {
        ContratoHonorariosImportacaoEntity item = importacaoRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Importação não encontrada: " + id));
        item.setStatus(ContratoHonorariosImportacaoStatus.REJEITADO.name());
        item.setHashPdfAtivo(null);
        item.setAtualizadoEm(Instant.now(clock));
        importacaoRepository.save(item);
        removerPdfTemporario(id);
    }

    @Transactional
    public void reverter(Long id) {
        reversaoService.reverter(id);
        removerPdfTemporario(id);
    }

    @Transactional(readOnly = true)
    public ContratoHonorariosImportacaoLoteStatusResponse statusLote(String loteId) {
        List<ContratoHonorariosImportacaoEntity> itens = importacaoRepository.findByImportacaoLoteIdOrderByScoreConfiancaDescIdAsc(loteId);
        int extraidos = 0, emRevisao = 0, aprovados = 0, rejeitados = 0, revertidos = 0, pendentes = 0, erros = 0;
        for (var i : itens) {
            switch (i.getStatus()) {
                case "EXTRAIDO" -> extraidos++;
                case "EM_REVISAO" -> emRevisao++;
                case "APROVADO" -> aprovados++;
                case "REJEITADO" -> rejeitados++;
                case "REVERTIDO" -> revertidos++;
                case "AGUARDANDO_EXTRACAO" -> pendentes++;
                case "ERRO_EXTRACAO", "PENDENTE_LIMITE" -> erros++;
                default -> {}
            }
        }
        return new ContratoHonorariosImportacaoLoteStatusResponse(
                loteId, itens.size(), extraidos, emRevisao, aprovados, rejeitados, revertidos, pendentes, erros);
    }

    @Transactional(readOnly = true)
    public CensoHonorariosRelatorioResponse relatorioCenso() {
        long aprovados = importacaoRepository.countByStatus(ContratoHonorariosImportacaoStatus.APROVADO.name());
        long rejeitados = importacaoRepository.countByStatus(ContratoHonorariosImportacaoStatus.REJEITADO.name());
        long revertidos = importacaoRepository.countByStatus(ContratoHonorariosImportacaoStatus.REVERTIDO.name());
        long total = importacaoRepository.count();
        BigDecimal passivo = BigDecimal.ZERO;
        BigDecimal contingente = BigDecimal.ZERO;
        BigDecimal confirmado = BigDecimal.ZERO;
        int cobrancaArmada = (int) armadaRepository.count();
        for (ContratoHonorariosEntity c : contratoRepository.listarComFiltros(null, null, null, null)) {
            if (c.getExpectativaValorEstimado() != null) {
                contingente = contingente.add(c.getExpectativaValorEstimado());
            }
            if (c.getParcelas() != null) {
                for (var p : c.getParcelas()) {
                    if (p.getPagamento() != null
                            && (PagamentoDominio.ST_RECEBIDO.equals(p.getPagamento().getStatus())
                                    || PagamentoDominio.ST_CONCILIADO.equals(p.getPagamento().getStatus()))) {
                        if (p.getValor() != null) {
                            confirmado = confirmado.add(p.getValor());
                        }
                    } else if (p.getValor() != null) {
                        passivo = passivo.add(p.getValor());
                    }
                }
            }
        }
        return new CensoHonorariosRelatorioResponse(
                (int) total,
                (int) aprovados,
                (int) rejeitados,
                (int) revertidos,
                confirmado,
                passivo,
                contingente,
                cobrancaArmada);
    }

    public List<Long> buscarPendentesExtracao(int limite) {
        return importacaoRepository
                .findPendentesExtracao(
                        ContratoHonorariosImportacaoStatus.AGUARDANDO_EXTRACAO.name(),
                        PageRequest.of(0, limite))
                .stream()
                .map(ContratoHonorariosImportacaoEntity::getId)
                .toList();
    }

    private void salvarPdfNoDrive(ContratoHonorariosImportacaoEntity item) {
        if (!googleDriveService.isConfigurado()) {
            return;
        }
        byte[] pdf = lerPdfTemporario(item.getId());
        if (pdf == null) {
            return;
        }
        try {
            String codigo = item.getCodigoCliente();
            Integer proc = item.getProcesso() != null ? item.getProcesso().getNumeroInterno() : null;
            Long pessoaId = item.getPessoa() != null ? item.getPessoa().getId() : null;
            String pastaId = documentoDrivePastaService.resolverPastaDestino(
                    googleDriveService, codigo, proc, pessoaId, TipoDocumento.CONTRATO);
            var fileId = googleDriveService.salvarPdfEmPasta(
                    pdf,
                    item.getPdfNomeArquivo() != null ? item.getPdfNomeArquivo() : "contrato_importado.pdf",
                    pastaId);
            if (StringUtils.hasText(fileId)) {
                item.setPdfDriveFileId(fileId);
            }
        } catch (Exception ignored) {
            // não bloqueia aprovação
        }
    }

    private ContratoHonorariosImportacaoItemResponse toItemResponseCompleto(ContratoHonorariosImportacaoEntity item) {
        ContratoHonorariosExtracaoDados extraidos = lerDadosJson(item.getDadosExtraidosJson());
        ContratoHonorariosExtracaoDados aprovados = lerDadosJson(item.getDadosAprovadosJson());
        List<String> alertas = lerAlertas(item.getAlertasJson());
        ProcessoMatchSugestaoResponse sugestao = processoResolver.sugerirProcesso(
                item, extraidos != null ? extraidos.numeroCnjExtraido() : null);
        boolean conflito = false;
        Long contratoExistenteId = null;
        if (item.getProcesso() != null) {
            var ex = contratoRepository.findByProcessoIdWithDetalhes(item.getProcesso().getId());
            if (ex.isPresent()) {
                conflito = true;
                contratoExistenteId = ex.get().getId();
            }
        }
        return toItemResponse(item, extraidos, aprovados, alertas, sugestao, conflito, contratoExistenteId);
    }

    private ContratoHonorariosImportacaoItemResponse toItemResponse(
            ContratoHonorariosImportacaoEntity item,
            ContratoHonorariosExtracaoDados extraidos,
            ContratoHonorariosExtracaoDados aprovados,
            List<String> alertas,
            ProcessoMatchSugestaoResponse sugestao,
            boolean conflito,
            Long contratoExistenteId) {
        return new ContratoHonorariosImportacaoItemResponse(
                item.getId(),
                item.getImportacaoLoteId(),
                item.getHashPdf(),
                item.getPdfNomeArquivo(),
                item.getCodigoCliente(),
                item.getProcesso() != null ? item.getProcesso().getId() : null,
                item.getStatus(),
                item.getClausulaExtraidaTexto(),
                extraidos,
                aprovados,
                item.getScoreConfianca(),
                alertas,
                item.getRoteamentoTipo(),
                sugestao,
                conflito,
                contratoExistenteId,
                item.getContratoHonorarios() != null ? item.getContratoHonorarios().getId() : null,
                item.getConciliacaoJson());
    }

    private ContratoHonorariosExtracaoDados lerDadosJson(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return objectMapper.readValue(json, ContratoHonorariosExtracaoDados.class);
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> lerAlertas(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of(json);
        }
    }

    private ClienteEntity resolverClienteOpcional(String codigo) {
        if (!StringUtils.hasText(codigo)) {
            return null;
        }
        return clienteRepository.findByCodigoClienteFetchPessoaTrim(codigo.trim()).orElse(null);
    }

    private UsuarioEntity usuarioAtualOrNull() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated()) {
            return null;
        }
        return usuarioRepository.findWithPerfilByLoginIgnoreCase(a.getName()).orElse(null);
    }

    private void salvarPdfTemporario(Long id, byte[] bytes) {
        try {
            Files.write(tempDir.resolve(id + ".pdf"), bytes);
        } catch (IOException e) {
            throw new BusinessRuleException("Falha ao armazenar PDF temporário.");
        }
    }

    private byte[] lerPdfTemporario(Long id) {
        try {
            Path p = tempDir.resolve(id + ".pdf");
            if (!Files.exists(p)) {
                return null;
            }
            return Files.readAllBytes(p);
        } catch (IOException e) {
            return null;
        }
    }

    private void removerPdfTemporario(Long id) {
        try {
            Files.deleteIfExists(tempDir.resolve(id + ".pdf"));
        } catch (IOException ignored) {
            // noop
        }
    }

    static String sha256(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public record ArquivoPdf(String nome, byte[] bytes) {}
}
