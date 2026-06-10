package br.com.vilareal.projudi.api;

import br.com.vilareal.projudi.api.dto.AtualizarCredencialPeticaoRequest;
import br.com.vilareal.projudi.api.dto.ProjudiPeticaoDetailResponse;
import br.com.vilareal.projudi.api.dto.PreviaProtocoloResponse;
import br.com.vilareal.projudi.api.dto.PreviaValidarLoteRequest;
import br.com.vilareal.projudi.api.dto.ProtocolarLoteRequest;
import br.com.vilareal.projudi.api.dto.ProtocolarProcessoRequest;
import br.com.vilareal.projudi.api.dto.ValidarProtocoloRequest;
import br.com.vilareal.projudi.api.dto.ValidarProtocoloResponse;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ArquivoAssinadoRecebido;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ItemAssinado;
import br.com.vilareal.projudi.application.ProjudiPeticaoProtocoloLoteService;
import br.com.vilareal.projudi.application.ProjudiPeticaoProtocoloLoteService.ResultadoItemLote;
import br.com.vilareal.projudi.application.ProjudiCredencialService;
import br.com.vilareal.projudi.api.dto.ProjudiCredencialResponse;
import br.com.vilareal.projudi.application.ProjudiPeticaoRegistroService;
import br.com.vilareal.projudi.application.ProjudiPeticaoRegistroService.ArquivoParaAssinar;
import br.com.vilareal.projudi.application.ProjudiPeticaoRegistroService.ArquivoP7sRegistro;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/projudi/peticoes")
@Tag(name = "PROJUDI — petições", description = "Staging, assinatura e preparação para protocolo")
@Validated
public class ProjudiPeticaoController {

    private final ProjudiPeticaoRegistroService registroService;
    private final ProjudiPeticaoAssinaturaService assinaturaService;
    private final ProjudiPeticaoProtocoloLoteService protocoloLoteService;
    private final ProjudiCredencialService credencialService;

    public ProjudiPeticaoController(
            ProjudiPeticaoRegistroService registroService,
            ProjudiPeticaoAssinaturaService assinaturaService,
            ProjudiPeticaoProtocoloLoteService protocoloLoteService,
            ProjudiCredencialService credencialService) {
        this.registroService = registroService;
        this.assinaturaService = assinaturaService;
        this.protocoloLoteService = protocoloLoteService;
        this.credencialService = credencialService;
    }

    @GetMapping("/credenciais")
    @Operation(summary = "Lista credenciais PROJUDI ativas (metadados, sem senha)")
    public List<ProjudiCredencialResponse> listarCredenciais() {
        return credencialService.listarAtivas();
    }

    @GetMapping
    @Operation(summary = "Lista petições com detalhe para a UI")
    public List<ProjudiPeticaoDetailResponse> listar(@RequestParam(required = false) String status) {
        return registroService.listarDetalhadas(status).stream()
                .map(ProjudiPeticaoDetailResponse::de)
                .toList();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Registra nova petição para assinatura")
    public ProjudiPeticaoDetailResponse registrar(
            @RequestParam Long credencialId,
            @RequestParam String numeroProcesso,
            @RequestParam(required = false) String complemento,
            @RequestParam("pdfs") List<MultipartFile> pdfs,
            @RequestParam(value = "idArquivoTipos", required = false) List<Integer> idArquivoTipos)
            throws IOException {
        if (pdfs == null || pdfs.isEmpty()) {
            throw new IllegalArgumentException("pdfs é obrigatório (ao menos um PDF).");
        }
        if (idArquivoTipos != null && !idArquivoTipos.isEmpty() && idArquivoTipos.size() != pdfs.size()) {
            throw new IllegalArgumentException(
                    "idArquivoTipos deve ter o mesmo tamanho de pdfs (ou ficar vazio).");
        }
        List<ArquivoParaAssinar> arquivos = new ArrayList<>(pdfs.size());
        for (int i = 0; i < pdfs.size(); i++) {
            MultipartFile mf = pdfs.get(i);
            int idTipo = resolverIdArquivoTipo(i, idArquivoTipos);
            arquivos.add(new ArquivoParaAssinar(mf.getBytes(), idTipo, mf.getOriginalFilename()));
        }
        ProjudiPeticaoEntity peticao =
                registroService.registrarPeticao(credencialId, numeroProcesso, complemento, arquivos);
        return ProjudiPeticaoDetailResponse.de(peticao);
    }

    @PostMapping(value = "/registrar-assinados", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Registra petição com arquivos .p7s já assinados (PDF embutido)")
    public ProjudiPeticaoDetailResponse registrarAssinados(
            @RequestParam Long credencialId,
            @RequestParam String numeroProcesso,
            @RequestParam(required = false) String complemento,
            @RequestParam("arquivosP7s") List<MultipartFile> arquivosP7s,
            @RequestParam(value = "idArquivoTipos", required = false) List<Integer> idArquivoTipos)
            throws IOException {
        if (arquivosP7s == null || arquivosP7s.isEmpty()) {
            throw new IllegalArgumentException("arquivosP7s é obrigatório (ao menos um .p7s).");
        }
        if (idArquivoTipos != null && !idArquivoTipos.isEmpty() && idArquivoTipos.size() != arquivosP7s.size()) {
            throw new IllegalArgumentException(
                    "idArquivoTipos deve ter o mesmo tamanho de arquivosP7s (ou ficar vazio).");
        }
        List<ArquivoP7sRegistro> arquivos = new ArrayList<>(arquivosP7s.size());
        for (int i = 0; i < arquivosP7s.size(); i++) {
            MultipartFile mf = arquivosP7s.get(i);
            int idTipo = resolverIdArquivoTipo(i, idArquivoTipos);
            arquivos.add(new ArquivoP7sRegistro(mf.getBytes(), idTipo, mf.getOriginalFilename()));
        }
        ProjudiPeticaoEntity peticao = registroService.registrarPeticaoComAssinados(
                credencialId, numeroProcesso, complemento, arquivos);
        return ProjudiPeticaoDetailResponse.de(peticao);
    }

    @GetMapping("/por-processo")
    @Operation(summary = "Lista petições de um processo (match por dígitos do número)")
    public List<ProjudiPeticaoDetailResponse> listarPorProcesso(@RequestParam String numeroProcesso) {
        return registroService.listarPorProcesso(numeroProcesso).stream()
                .map(ProjudiPeticaoDetailResponse::de)
                .toList();
    }

    @GetMapping(value = "/lote-assinar.zip", produces = "application/zip")
    @Operation(summary = "ZIP com PDFs pendentes de assinatura")
    public ResponseEntity<byte[]> loteAssinarZip() {
        byte[] zip = assinaturaService.gerarZipLoteParaAssinar();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("lote-assinar.zip").build().toString())
                .body(zip);
    }

    @PostMapping(value = "/assinados", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Recebe arquivos .p7s e pareia com PDFs pendentes pelo hash do conteúdo embutido")
    public ResponseEntity<List<ItemAssinado>> receberAssinados(
            @RequestParam("arquivosP7s") List<MultipartFile> arquivosP7s) throws IOException {
        if (arquivosP7s == null || arquivosP7s.isEmpty()) {
            throw new IllegalArgumentException("arquivosP7s é obrigatório (ao menos um arquivo).");
        }
        List<ArquivoAssinadoRecebido> itens = new ArrayList<>(arquivosP7s.size());
        for (MultipartFile mf : arquivosP7s) {
            itens.add(new ArquivoAssinadoRecebido(mf.getOriginalFilename(), mf.getBytes()));
        }
        List<ItemAssinado> resultado = assinaturaService.receberAssinados(itens);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(resultado);
    }

    @PostMapping(value = "/previa-lote", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Prévia do plano de protocolo para petições selecionadas")
    public PreviaProtocoloResponse previaLote(@Valid @RequestBody PreviaValidarLoteRequest body) {
        return protocoloLoteService.previaProtocoloLote(body.peticaoIds());
    }

    @PostMapping(value = "/validar-lote", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Valida no PROJUDI até passo 10 (sem Concluir) para petições selecionadas")
    public ValidarProtocoloResponse validarLote(@Valid @RequestBody PreviaValidarLoteRequest body) {
        return protocoloLoteService.validarProtocoloLote(body.peticaoIds());
    }

    @GetMapping("/previa-protocolo")
    @Operation(summary = "Prévia do plano de protocolo (sem contato com PROJUDI)")
    public PreviaProtocoloResponse previaProtocolo(@RequestParam String numeroProcesso) {
        return protocoloLoteService.previaProtocoloPorProcesso(numeroProcesso);
    }

    @PostMapping(value = "/validar-protocolo", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Valida no PROJUDI até passo 10 (upload incluído), sem Concluir",
            description = "Não altera status das petições. Use antes do protocolo definitivo.")
    public ValidarProtocoloResponse validarProtocolo(@Valid @RequestBody ValidarProtocoloRequest body) {
        return protocoloLoteService.validarProtocoloPorProcesso(body.numeroProcesso());
    }

    @PostMapping(value = "/protocolar-lote", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Protocola em lote petições ASSINADA (sequencial, irreversível)",
            description = "Exige confirmar=true. Petições que não estejam ASSINADA retornam IGNORADA.")
    public ResponseEntity<List<ResultadoItemLote>> protocolarLote(@Valid @RequestBody ProtocolarLoteRequest body) {
        if (body.confirmar() == null || !body.confirmar()) {
            throw new IllegalArgumentException(
                    "confirmar=true é obrigatório — o passo Concluir no PROJUDI é irreversível.");
        }
        List<ResultadoItemLote> resultado = protocoloLoteService.protocolarLote(body.peticaoIds());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(resultado);
    }

    @PostMapping(value = "/protocolar-processo", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Protocola petições ASSINADA de um processo (irreversível)",
            description = "Exige confirmar=true. Casamento por dígitos do número do processo.")
    public ResponseEntity<List<ResultadoItemLote>> protocolarProcesso(
            @Valid @RequestBody ProtocolarProcessoRequest body) {
        if (body.confirmar() == null || !body.confirmar()) {
            throw new IllegalArgumentException(
                    "confirmar=true é obrigatório — o passo Concluir no PROJUDI é irreversível.");
        }
        List<ResultadoItemLote> resultado = protocoloLoteService.protocolarProcesso(body.numeroProcesso());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(resultado);
    }

    @DeleteMapping("/{peticaoId}")
    @Operation(summary = "Exclui petição pendente de assinatura (e todos os arquivos)")
    public ResponseEntity<Void> excluirPeticao(@PathVariable Long peticaoId) {
        registroService.excluirPeticao(peticaoId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{peticaoId}/arquivos/{arquivoId}")
    @Operation(summary = "Exclui um arquivo ainda não assinado")
    public ResponseEntity<Void> excluirArquivo(@PathVariable Long peticaoId, @PathVariable Long arquivoId) {
        registroService.excluirArquivo(peticaoId, arquivoId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{peticaoId}/reabrir-protocolo")
    @Operation(summary = "Reabre petição em ERRO para ASSINADA (nova tentativa de protocolo)")
    public ResponseEntity<Void> reabrirProtocolo(@PathVariable Long peticaoId) {
        protocoloLoteService.reabrirParaRetentativa(peticaoId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{peticaoId}/credencial", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Altera credencial PROJUDI de petição ASSINADA ou ERRO")
    public ResponseEntity<Void> atualizarCredencial(
            @PathVariable Long peticaoId, @Valid @RequestBody AtualizarCredencialPeticaoRequest body) {
        registroService.atualizarCredencial(peticaoId, body.credencialId());
        return ResponseEntity.noContent().build();
    }

    private static int resolverIdArquivoTipo(int indice, List<Integer> idArquivoTipos) {
        if (idArquivoTipos != null && !idArquivoTipos.isEmpty()) {
            return idArquivoTipos.get(indice);
        }
        return indice == 0 ? 16 : 1;
    }
}
