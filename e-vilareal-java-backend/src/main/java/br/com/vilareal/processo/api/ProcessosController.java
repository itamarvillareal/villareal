package br.com.vilareal.processo.api;

import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.julia.application.JuliaTriagemService;
import br.com.vilareal.julia.triagem.TriagemRunResponse;
import br.com.vilareal.processo.api.dto.*;
import br.com.vilareal.processo.application.DiagnosticoAguardandoProtocoloAssinarService;
import br.com.vilareal.processo.application.DiagnosticoAssinaturaAutomaticaService;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.application.ProcessoAutosIntegralService;
import br.com.vilareal.processo.application.ProcessoMovimentacoesConsolidarPdfService;
import br.com.vilareal.agendamento.api.dto.ResultadoMonitoramentoResponse;
import br.com.vilareal.agendamento.application.MonitoramentoMovimentacoesService;
import br.com.vilareal.processo.application.ProcessoMovimentacoesDriveService;
import br.com.vilareal.processo.application.ProcessoProjudiMovimentacoesDriveService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/processos")
@Tag(name = "Processos", description = "Paridade processosRepository.js / Processos.jsx")
public class ProcessosController {

    private final ProcessoApplicationService processoApplicationService;
    private final ProcessoAutosIntegralService processoAutosIntegralService;
    private final ProcessoMovimentacoesConsolidarPdfService processoMovimentacoesConsolidarPdfService;
    private final ProcessoProjudiMovimentacoesDriveService processoProjudiMovimentacoesDriveService;
    private final ProcessoMovimentacoesDriveService processoMovimentacoesDriveService;
    private final MonitoramentoMovimentacoesService monitoramentoMovimentacoesService;
    private final JuliaTriagemService juliaTriagemService;
    private final DiagnosticoAguardandoProtocoloAssinarService diagnosticoAguardandoProtocoloAssinarService;
    private final DiagnosticoAssinaturaAutomaticaService diagnosticoAssinaturaAutomaticaService;

    public ProcessosController(
            ProcessoApplicationService processoApplicationService,
            ProcessoAutosIntegralService processoAutosIntegralService,
            ProcessoMovimentacoesConsolidarPdfService processoMovimentacoesConsolidarPdfService,
            ProcessoProjudiMovimentacoesDriveService processoProjudiMovimentacoesDriveService,
            ProcessoMovimentacoesDriveService processoMovimentacoesDriveService,
            MonitoramentoMovimentacoesService monitoramentoMovimentacoesService,
            JuliaTriagemService juliaTriagemService,
            DiagnosticoAguardandoProtocoloAssinarService diagnosticoAguardandoProtocoloAssinarService,
            DiagnosticoAssinaturaAutomaticaService diagnosticoAssinaturaAutomaticaService) {
        this.processoApplicationService = processoApplicationService;
        this.processoAutosIntegralService = processoAutosIntegralService;
        this.processoMovimentacoesConsolidarPdfService = processoMovimentacoesConsolidarPdfService;
        this.processoProjudiMovimentacoesDriveService = processoProjudiMovimentacoesDriveService;
        this.processoMovimentacoesDriveService = processoMovimentacoesDriveService;
        this.monitoramentoMovimentacoesService = monitoramentoMovimentacoesService;
        this.juliaTriagemService = juliaTriagemService;
        this.diagnosticoAguardandoProtocoloAssinarService = diagnosticoAguardandoProtocoloAssinarService;
        this.diagnosticoAssinaturaAutomaticaService = diagnosticoAssinaturaAutomaticaService;
    }

    @GetMapping
    @Operation(
            summary = "Listar processos",
            description =
                    "Com `codigoCliente` (8 dígitos): processos em que essa pessoa é **titular** do cabeçalho (`pessoa_id`), "
                            + "página JSON (`Page` Spring: `content`, `totalElements`, `last`, …; "
                            + "query `page`, `size`, `sort`; padrão `page=0`, `size=100`, `sort=numeroInterno`, `id`). "
                            + "Com `codigoCliente` e `numeroInterno`: um único processo (JSON objeto, 404 se inexistente). "
                            + "Sem `codigoCliente`: lista paginada de todos (`Page` Spring: `content`, `totalElements`, …; query `page`, `size`, `sort`).")
    public ResponseEntity<?> listar(
            @RequestParam(required = false) String codigoCliente,
            @RequestParam(required = false) Integer numeroInterno,
            HttpServletRequest request,
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        if (StringUtils.hasText(codigoCliente) && numeroInterno != null) {
            return processoApplicationService
                    .buscarPorCodigoClienteENumeroInterno(codigoCliente.trim(), numeroInterno)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }
        if (StringUtils.hasText(codigoCliente)) {
            boolean resumo = "true".equalsIgnoreCase(String.valueOf(request.getParameter("resumo")).trim());
            return ResponseEntity.ok(processoApplicationService.listarPorCodigoCliente(
                    codigoCliente.trim(), pageableParaCodigoCliente(request), resumo));
        }
        return ResponseEntity.ok(processoApplicationService.listarTodosPaginado(pageable));
    }

    /**
     * Paginação para {@code codigoCliente}: padrão {@code size=100}, {@code sort=numeroInterno asc, id asc}
     * quando {@code sort} não é enviado (evita conflito com {@link PageableDefault}(size=20) do branch sem cliente).
     */
    private static Pageable pageableParaCodigoCliente(HttpServletRequest req) {
        int page = parseNonNegativeInt(req.getParameter("page"), 0);
        int size = parsePositiveIntWithDefault(req.getParameter("size"), 100);
        Sort sort = sortParaCodigoCliente(req);
        return PageRequest.of(page, size, sort);
    }

    private static int parsePositiveIntWithDefault(String raw, int defaultVal) {
        if (raw == null || raw.isBlank()) {
            return defaultVal;
        }
        try {
            int v = Integer.parseInt(raw.trim());
            return v < 1 ? defaultVal : v;
        } catch (NumberFormatException e) {
            return defaultVal;
        }
    }

    private static int parseNonNegativeInt(String raw, int defaultVal) {
        if (raw == null || raw.isBlank()) {
            return defaultVal;
        }
        try {
            int v = Integer.parseInt(raw.trim());
            return Math.max(0, v);
        } catch (NumberFormatException e) {
            return defaultVal;
        }
    }

    private static Sort sortParaCodigoCliente(HttpServletRequest req) {
        String[] sortParams = req.getParameterValues("sort");
        if (sortParams == null || sortParams.length == 0) {
            return Sort.by(Sort.Order.asc("numeroInterno"), Sort.Order.asc("id"));
        }
        return Sort.by(Arrays.stream(sortParams)
                .map(ProcessosController::ordemSort)
                .collect(Collectors.toList()));
    }

    private static Sort.Order ordemSort(String token) {
        if (token == null || token.isBlank()) {
            return Sort.Order.asc("numeroInterno");
        }
        String t = token.trim();
        int comma = t.lastIndexOf(',');
        if (comma < 0) {
            return Sort.Order.asc(t);
        }
        String prop = t.substring(0, comma).trim();
        String dir = t.substring(comma + 1).trim();
        Sort.Direction d = dir.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC;
        return new Sort.Order(d, prop);
    }

    @GetMapping("/por-numero-interno")
    @Operation(summary = "Listar processos com o mesmo nº interno (vários clientes podem ter proc. 1, 2…)")
    public List<ProcessoResponse> listarPorNumeroInterno(@RequestParam int numeroInterno) {
        return processoApplicationService.listarPorNumeroInterno(numeroInterno);
    }

    @GetMapping("/vinculo-pessoa/{pessoaId}")
    @Operation(summary = "Diagnóstico: processos em que a pessoa figura (cliente, parte ou advogado)")
    public List<ProcessoDiagnosticoPessoaItemResponse> listarVinculosPessoa(@PathVariable Long pessoaId) {
        return processoApplicationService.listarVinculosDiagnosticoPorPessoa(pessoaId);
    }

    @GetMapping("/diagnostico/busca-numero")
    @Operation(
            summary = "Diagnóstico: busca por número de processo (CNJ)",
            description = "Normaliza o parâmetro `numero` (remove `.`, `-`, espaços; compara pelos dígitos do CNJ gravado).")
    public List<ProcessoDiagnosticoPessoaItemResponse> buscarDiagnosticoPorNumero(
            @RequestParam("numero") String numero) {
        return processoApplicationService.buscarDiagnosticoPorNumeroProcesso(numero);
    }

    @GetMapping("/diagnostico/prazo-fatal")
    @Operation(
            summary = "Diagnóstico: processos com prazo fatal na data",
            description = "Aceita `data` em dd/mm/aaaa ou yyyy-mm-dd; alinha com o cadastro na API (coluna prazo_fatal e prazos marcados como fatal).")
    public List<ProcessoDiagnosticoPessoaItemResponse> buscarDiagnosticoPorPrazoFatal(
            @RequestParam("data") String data) {
        return processoApplicationService.buscarDiagnosticoPorPrazoFatal(data);
    }

    @GetMapping("/diagnostico/aguardando-protocolo")
    @Operation(
            summary = "Diagnóstico: processos aguardando protocolo",
            description =
                    "Lista processos cuja fase na API corresponde a «Protocolo / Movimentação» (ou sinónimos como «Aguardando Protocolo»).")
    public List<ProcessoDiagnosticoPessoaItemResponse> buscarDiagnosticoAguardandoProtocolo() {
        return diagnosticoAguardandoProtocoloAssinarService.listarDiagnosticoAguardandoProtocolo();
    }

    @GetMapping("/diagnostico/aguardando-protocolo/cnjs-fila-projudi")
    @Operation(
            summary = "CNJs com petição ativa na fila PROJUDI",
            description =
                    "Processos que já têm petição PENDENTE_ASSINATURA, ASSINADA (incl. agendada) ou PROTOCOLANDO — "
                            + "devem ser omitidos do diagnóstico «Aguardando Protocolo».")
    public List<String> cnjsComFilaProjudiAtiva() {
        return new ArrayList<>(diagnosticoAguardandoProtocoloAssinarService.cnjDigitosComFilaProtocoloAtiva());
    }

    @PostMapping("/diagnostico/aguardando-protocolo/preparar-assinar")
    @Operation(
            summary = "Pré-registra PDFs da pasta Assinar (PENDENTE_ASSINATURA)",
            description =
                    "Para cada processo, baixa PDFs do Drive, deduplica por hash+CNJ e registra petições "
                            + "pendentes de assinatura (mesmo fluxo do POST /api/projudi/peticoes).")
    public PrepararAssinarResultado prepararAssinarDiagnostico(
            @RequestParam Long credencialId,
            @RequestBody List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        return diagnosticoAguardandoProtocoloAssinarService.prepararAssinatura(credencialId, processos);
    }

    @PostMapping("/diagnostico/aguardando-protocolo/assinar-automatico")
    @Operation(
            summary = "Enfileira lote PREPARANDO e prepara PDFs em segundo plano (assinador Windows)",
            description =
                    "Retorna loteId imediatamente (status PREPARANDO). O preparo Drive → PENDENTE_ASSINATURA "
                            + "roda async; polling em GET lote-assinatura/{loteId} até LIBERADO. "
                            + "Idempotente contra clique duplo (mesma seleção + credencial).")
    public AssinarAutomaticoResponse assinarAutomaticoDiagnostico(
            @RequestParam Long credencialId,
            @RequestBody List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        return diagnosticoAssinaturaAutomaticaService.assinarAutomatico(credencialId, processos);
    }

    @GetMapping("/diagnostico/aguardando-protocolo/lote-assinatura/{loteId}")
    @Operation(
            summary = "Status do lote de assinatura automática",
            description =
                    "Retorna PREPARANDO / LIBERADO / EM_ASSINATURA / CONCLUIDO / ERRO. Em ERRO inclui erro_codigo, "
                            + "erro_mensagem e mensagemUsuario amigável (ex.: TOKEN_OCUPADO).")
    public LoteAssinaturaStatusResponse statusLoteAssinaturaDiagnostico(@PathVariable Long loteId) {
        return diagnosticoAssinaturaAutomaticaService.consultarStatus(loteId);
    }

    @PostMapping("/diagnostico/aguardando-protocolo/lote-assinatura/{loteId}/reliberar")
    @Operation(
            summary = "Re-libera lote após erro recuperável (ex.: TOKEN_OCUPADO)",
            description =
                    "Volta o lote para LIBERADO sem reprocessar prepararAssinatura — uso do botão «Tentar novamente».")
    public LoteAssinaturaStatusResponse reliberarLoteAssinaturaDiagnostico(@PathVariable Long loteId) {
        return diagnosticoAssinaturaAutomaticaService.reliberar(loteId);
    }

    @PostMapping("/diagnostico/aguardando-protocolo/lote-assinatura/{loteId}/cancelar")
    @Operation(
            summary = "Cancela preparo assíncrono (PREPARANDO → CANCELADO)",
            description =
                    "Interrompe cooperativemente o job de preparo em segundo plano. Petições parciais "
                            + "do preparo abortado são revertidas; o assinador não recebe o lote.")
    public LoteAssinaturaStatusResponse cancelarLoteAssinaturaDiagnostico(@PathVariable Long loteId) {
        return diagnosticoAssinaturaAutomaticaService.cancelar(loteId);
    }

    @PostMapping("/diagnostico/aguardando-protocolo/lote-assinar-zip")
    @Operation(
            summary = "ZIP com PDFs pendentes do lote preparado",
            description =
                    "Gera ZIP plano com nomes canônicos {peticaoId}_{ordem}_{sha8}.pdf + manifest.json "
                            + "informativo. Pareamento no retorno é por hash, não por nome.")
    public ResponseEntity<byte[]> loteAssinarZipDiagnostico(@RequestBody LoteAssinarZipRequest body) {
        byte[] zip = diagnosticoAguardandoProtocoloAssinarService.gerarZipDoLote(body.peticaoIds());
        String filename = "assinar-aguardando-protocolo.zip";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(zip);
    }

    @PostMapping(
            value = "/diagnostico/aguardando-protocolo/upload-assinados",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Pareia .p7s assinados por hash (wrapper do POST /api/projudi/peticoes/assinados)",
            description = "Recebe apenas arquivos .p7s; o pareamento é pelo SHA-256 do PDF embutido.")
    public DiagnosticoUploadAssinadosResponse uploadAssinadosDiagnostico(
            @RequestParam("arquivosP7s") List<MultipartFile> arquivosP7s,
            @RequestParam(value = "substituir", defaultValue = "false") boolean substituir) {
        return diagnosticoAguardandoProtocoloAssinarService.registrarAssinados(arquivosP7s, substituir);
    }

    @GetMapping("/diagnostico/historico-data")
    @Operation(
            summary = "Diagnóstico: andamentos (histórico) na data",
            description =
                    "Lista histórico na API (`processo_andamento`) cuja data do movimento (`movimento_em`) coincide com o dia "
                            + "(fuso America/Sao_Paulo). Uma linha por processo (código cliente + nº interno), como o legado "
                            + "«Consultas Realizadas» — permanece o andamento de maior id no dia.")
    public List<ProcessoDiagnosticoHistoricoItemResponse> buscarDiagnosticoHistoricoPorData(
            @RequestParam("data") String data) {
        return processoApplicationService.buscarDiagnosticoHistoricoPorData(data);
    }

    @DeleteMapping("/manutencao/andamentos-por-origem/{origem}")
    @Operation(
            summary = "Excluir andamentos em massa por origem",
            description =
                    "Remove todos os registos em `processo_andamento` com a `origem` indicada (ex.: IMPORT_PLANILHA). "
                            + "Usado antes de reimportar histórico a partir de planilha.")
    public ResponseEntity<java.util.Map<String, Object>> excluirAndamentosPorOrigem(@PathVariable String origem) {
        int removidos = processoApplicationService.excluirAndamentosPorOrigem(origem);
        return ResponseEntity.ok(java.util.Map.of("origem", origem, "removidos", removidos));
    }

    @GetMapping("/autos-integral")
    @Operation(
            summary = "Baixar autos integral (PDF único)",
            description =
                    "Mescla os PDFs já existentes na pasta Movimentações do processo no Google Drive, "
                            + "ordenados por número de movimentação e índice de arquivo. Não consulta o PROJUDI.")
    public ResponseEntity<byte[]> baixarAutosIntegral(@RequestParam String numero) throws Exception {
        ProcessoAutosIntegralService.ResultadoAutosIntegral resultado =
                processoAutosIntegralService.gerarPdf(numero);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(resultado.nomeArquivo())
                .build());
        headers.setContentType(MediaType.APPLICATION_PDF);
        if (!resultado.avisos().isEmpty()) {
            headers.add("X-Autos-Integral-Avisos", String.join(" | ", resultado.avisos()));
        }
        return ResponseEntity.ok().headers(headers).body(resultado.pdf());
    }

    @GetMapping("/{id}")
    public ProcessoResponse buscar(@PathVariable Long id) {
        return processoApplicationService.buscar(id);
    }

    @GetMapping("/{id}/movimentacoes/arquivos")
    @Operation(
            summary = "Listar PDFs da pasta Movimentações",
            description =
                    "Retorna os PDFs diretos da pasta Movimentações do processo no Drive, "
                            + "ordenados por nome (crescente). Lista vazia se a pasta não existir.")
    public ResponseEntity<List<DriveArquivoDto>> listarPdfsMovimentacoes(@PathVariable Long id) throws Exception {
        return ResponseEntity.ok(processoMovimentacoesConsolidarPdfService.listarPdfsMovimentacoes(id));
    }

    @GetMapping("/{id}/movimentacoes/consolidar-pdf")
    @Operation(
            summary = "Consolidar PDFs da pasta Movimentações",
            description =
                    "Mescla PDFs da pasta Movimentações. Sem parâmetros: todos os PDFs (ordem por nome). "
                            + "Com fileId repetido na query: apenas os selecionados, na ordem enviada.")
    public ResponseEntity<byte[]> consolidarMovimentacoesPdf(
            @PathVariable Long id,
            @RequestParam(value = "fileId", required = false) List<String> fileIds)
            throws Exception {
        if (fileIds != null && !fileIds.isEmpty()) {
            return respostaPdfConsolidado(
                    processoMovimentacoesConsolidarPdfService.gerarPdf(id, fileIds));
        }
        return respostaPdfConsolidado(processoMovimentacoesConsolidarPdfService.gerarPdf(id));
    }

    @PostMapping("/{id}/movimentacoes/consolidar-pdf")
    @Operation(
            summary = "Consolidar PDFs selecionados da pasta Movimentações",
            description =
                    "Mescla apenas os PDFs indicados (fileIds do Drive), na ordem enviada no corpo. "
                            + "Cada id deve pertencer à pasta Movimentações do processo.")
    public ResponseEntity<byte[]> consolidarMovimentacoesPdfSelecionados(
            @PathVariable Long id, @RequestBody ConsolidarPdfRequest body) throws Exception {
        List<String> fileIds = body != null && body.fileIds() != null ? body.fileIds() : List.of();
        return respostaPdfConsolidado(processoMovimentacoesConsolidarPdfService.gerarPdf(id, fileIds));
    }

    private static ResponseEntity<byte[]> respostaPdfConsolidado(
            ProcessoMovimentacoesConsolidarPdfService.ResultadoConsolidado resultado) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(resultado.nomeArquivo())
                .build());
        headers.setContentType(MediaType.APPLICATION_PDF);
        if (resultado.avisos() != null && !resultado.avisos().isEmpty()) {
            headers.set("X-Movimentacoes-Consolidado-Avisos", String.join(" | ", resultado.avisos()));
        }
        return ResponseEntity.ok().headers(headers).body(resultado.pdf());
    }

    @PostMapping("/{id}/projudi/monitorar")
    @Operation(
            summary = "Monitorar movimentações PROJUDI (somente listagem)",
            description =
                    "Lista movimentações via consulta inócua (F3), grava baseline em "
                            + "movimentacao_monitorada e registra execução. Sem download, Drive ou publicações.")
    public ResultadoMonitoramentoResponse monitorarMovimentacoesProjudi(@PathVariable Long id) {
        return monitoramentoMovimentacoesService.monitorarProcesso(id);
    }

    @PostMapping("/{id}/movimentacoes-drive")
    @Operation(
            summary = "Obter movimentações (roteado por tramitação)",
            description =
                    "Projudi: consulta síncrona progressiva. PJe: dispara cópia integral assíncrona. "
                            + "Autos físicos / tramitação vazia: sem robô.")
    public ProcessoMovimentacoesDriveResponse obterMovimentacoesDrive(@PathVariable Long id) {
        return processoMovimentacoesDriveService.executar(id);
    }

    @GetMapping("/{id}/movimentacoes-drive/pje-status")
    @Operation(
            summary = "Status da cópia integral PJe (polling após disparo assíncrono)",
            description = "Retorna EM_ANDAMENTO, SUCESSO, FALHA ou NENHUM para o CNJ do processo.")
    public PjeCopiaIntegralStatusResponse statusCopiaIntegralPje(@PathVariable Long id) {
        return processoMovimentacoesDriveService.consultarStatusPje(id);
    }

    @PostMapping("/{id}/projudi/movimentacoes-drive")
    @Operation(
            summary = "Obter movimentações PROJUDI (progressivo → Drive)",
            description =
                    "Consulta manual pelo usuário — sempre executa, independente do desarme do pipeline "
                            + "automático (pode retornar zero arquivos se o acervo já estiver integral). "
                            + "Arquiva no Drive: novas no topo; a cada clique, até 10 movimentações antigas "
                            + "ainda não arquivadas. Repita até `temMais=false`.")
    public ProcessoProjudiMovimentacoesDriveResponse obterMovimentacoesProjudiDrive(@PathVariable Long id) {
        return processoProjudiMovimentacoesDriveService.executar(id);
    }

    @PostMapping("/{id}/julia/triagem")
    @Operation(
            summary = "Disparar triagem manual da Júlia",
            description =
                    "Executa a triagem da Júlia para uma publicação vinculada ao processo. "
                            + "Sem `publicacaoId`, usa a publicação mais recente. "
                            + "`dryRun=true`: só raciocínio (sem persistir nem enactment). "
                            + "`forcar=true`: apaga `julia_triagem` existente da publicação e reexecuta "
                            + "(útil quando PDFs chegaram ao Drive após a triagem automática). "
                            + "Não depende de `julia.triagem.auto.enabled`.")
    public TriagemRunResponse dispararTriagemJulia(
            @PathVariable Long id,
            @RequestParam(required = false) Long publicacaoId,
            @RequestParam(defaultValue = "false") boolean dryRun,
            @RequestParam(defaultValue = "false") boolean forcar) {
        return juliaTriagemService.triarPublicacaoNoProcesso(id, publicacaoId, dryRun, forcar);
    }

    @PostMapping
    public ResponseEntity<ProcessoResponse> criar(@Valid @RequestBody ProcessoWriteRequest request) {
        ProcessoResponse body = processoApplicationService.criar(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}")
    public ProcessoResponse atualizar(@PathVariable Long id, @Valid @RequestBody ProcessoWriteRequest request) {
        return processoApplicationService.atualizar(id, request);
    }

    @PatchMapping("/{id}/ativo")
    @Operation(summary = "Ativar/inativar", description = "Query ?value=true|false")
    public ResponseEntity<Void> patchAtivo(@PathVariable Long id, @RequestParam boolean value) {
        processoApplicationService.patchAtivo(id, value);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Excluir processo",
            description =
                    "Remove o processo e todos os dados vinculados (andamentos, partes, prazos, financeiro, cálculos, publicações, etc.).")
    public ResponseEntity<Void> excluirProcesso(@PathVariable Long id) {
        processoApplicationService.excluirProcesso(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/partes")
    public List<ProcessoParteResponse> listarPartes(@PathVariable Long id) {
        return processoApplicationService.listarPartes(id);
    }

    @PostMapping("/{id}/partes")
    public ResponseEntity<ProcessoParteResponse> criarParte(
            @PathVariable Long id, @Valid @RequestBody ProcessoParteWriteRequest request) {
        ProcessoParteResponse body = processoApplicationService.criarParte(id, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{parteId}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}/partes/{parteId}")
    public ProcessoParteResponse atualizarParte(
            @PathVariable Long id,
            @PathVariable Long parteId,
            @Valid @RequestBody ProcessoParteWriteRequest request) {
        return processoApplicationService.atualizarParte(id, parteId, request);
    }

    @DeleteMapping("/{id}/partes/{parteId}")
    public ResponseEntity<Void> excluirParte(@PathVariable Long id, @PathVariable Long parteId) {
        processoApplicationService.excluirParte(id, parteId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/andamentos")
    public List<ProcessoAndamentoResponse> listarAndamentos(@PathVariable Long id) {
        return processoApplicationService.listarAndamentos(id);
    }

    @PostMapping("/{id}/andamentos")
    public ResponseEntity<ProcessoAndamentoResponse> criarAndamento(
            @PathVariable Long id, @Valid @RequestBody ProcessoAndamentoWriteRequest request) {
        ProcessoAndamentoResponse body = processoApplicationService.criarAndamento(id, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{andamentoId}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}/andamentos/{andamentoId}")
    public ProcessoAndamentoResponse atualizarAndamento(
            @PathVariable Long id,
            @PathVariable Long andamentoId,
            @Valid @RequestBody ProcessoAndamentoWriteRequest request) {
        return processoApplicationService.atualizarAndamento(id, andamentoId, request);
    }

    @DeleteMapping("/{id}/andamentos/{andamentoId}")
    public ResponseEntity<Void> excluirAndamento(@PathVariable Long id, @PathVariable Long andamentoId) {
        processoApplicationService.excluirAndamento(id, andamentoId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/prazos")
    public List<ProcessoPrazoResponse> listarPrazos(@PathVariable Long id) {
        return processoApplicationService.listarPrazos(id);
    }

    @PostMapping("/{id}/prazos")
    public ResponseEntity<ProcessoPrazoResponse> criarPrazo(
            @PathVariable Long id, @Valid @RequestBody ProcessoPrazoWriteRequest request) {
        ProcessoPrazoResponse body = processoApplicationService.criarPrazo(id, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{prazoId}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}/prazos/{prazoId}")
    public ProcessoPrazoResponse atualizarPrazo(
            @PathVariable Long id,
            @PathVariable Long prazoId,
            @Valid @RequestBody ProcessoPrazoWriteRequest request) {
        return processoApplicationService.atualizarPrazo(id, prazoId, request);
    }
}
