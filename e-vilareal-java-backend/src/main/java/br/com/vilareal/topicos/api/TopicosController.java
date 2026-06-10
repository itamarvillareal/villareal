package br.com.vilareal.topicos.api;

import br.com.vilareal.topicos.api.dto.*;
import br.com.vilareal.topicos.application.TopicoConteudoApplicationService;
import br.com.vilareal.topicos.application.TopicoImportService;
import br.com.vilareal.topicos.application.TopicoProcessadorService;
import br.com.vilareal.topicos.application.TopicosApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/topicos")
@Tag(name = "Tópicos")
public class TopicosController {

    private final TopicosApplicationService topicosApplicationService;
    private final TopicoConteudoApplicationService topicoConteudoApplicationService;
    private final TopicoProcessadorService topicoProcessadorService;
    private final TopicoImportService topicoImportService;

    public TopicosController(
            TopicosApplicationService topicosApplicationService,
            TopicoConteudoApplicationService topicoConteudoApplicationService,
            TopicoProcessadorService topicoProcessadorService,
            TopicoImportService topicoImportService) {
        this.topicosApplicationService = topicosApplicationService;
        this.topicoConteudoApplicationService = topicoConteudoApplicationService;
        this.topicoProcessadorService = topicoProcessadorService;
        this.topicoImportService = topicoImportService;
    }

    @GetMapping("/hierarchy")
    @Operation(description = "Árvore raiz da tela Tópicos (mesmo contrato que `topicosHierarchy.js` no React).")
    public TopicoNoDto hierarchy() {
        return topicosApplicationService.obterRaiz();
    }

    @PutMapping("/hierarchy")
    @Operation(description = "Substitui (upsert) a árvore raiz da tela Tópicos. Corpo = mesmo contrato do GET.")
    public TopicoNoDto salvarHierarchy(@RequestBody TopicoNoDto raiz) {
        return topicosApplicationService.salvarRaiz(raiz);
    }

    @GetMapping
    @Operation(description = "Lista tópicos ativos (paginado).")
    public Page<TopicoResumoResponse> listar(
            @PageableDefault(size = 50, sort = "categoria") Pageable pageable) {
        return topicoConteudoApplicationService.listarAtivos(pageable);
    }

    @GetMapping("/categorias")
    public List<String> categorias() {
        return topicoConteudoApplicationService.listarCategorias();
    }

    @GetMapping("/categoria/{categoria}")
    public List<TopicoResumoResponse> porCategoria(@PathVariable String categoria) {
        return topicoConteudoApplicationService.listarPorCategoria(categoria);
    }

    @GetMapping("/buscar")
    public List<TopicoResumoResponse> buscar(@RequestParam("q") String q) {
        return topicoConteudoApplicationService.buscar(q);
    }

    @GetMapping("/{id}")
    public TopicoResponse detalhe(@PathVariable Long id) {
        return topicoConteudoApplicationService.obterDetalhe(id);
    }

    @PostMapping("/{id}/processar")
    public TopicoProcessarResponse processar(@PathVariable Long id, @RequestBody TopicoProcessarRequest body) {
        return topicoProcessadorService.processarTopico(
                id, body != null ? body.getProcessoId() : null, body != null ? body.getParametros() : null);
    }

    @PostMapping("/processar-multiplos")
    public TopicoProcessarMultiplosResponse processarMultiplos(@RequestBody TopicoProcessarMultiplosRequest body) {
        TopicoProcessarMultiplosResponse resp = new TopicoProcessarMultiplosResponse();
        if (body == null || body.getTopicoIds() == null) {
            return resp;
        }
        resp.setItens(topicoProcessadorService.processarMultiplos(
                body.getTopicoIds(),
                body.getProcessoId(),
                body.getParametros()));
        return resp;
    }

    @PostMapping("/importar")
    @Operation(description = "Importa tópicos de arquivos .txt (multipart). Cada arquivo pode conter múltiplos blocos.")
    public TopicoImportResultDto importar(@RequestParam("files") List<MultipartFile> files) {
        return topicoImportService.importar(files);
    }

    @PostMapping("/admin/converter-html")
    @Profile("dev")
    @Operation(
            description =
                    "Manutenção (dev/admin): converte o conteúdo legado para HTML + tokens nos tópicos cujo"
                            + " subcategoria/chave contém 'filtro'. dryRun=true (default) não grava. Idempotente."
                            + " Nunca altera conteudo_template.")
    public TopicoConverterHtmlResponse converterHtml(
            @RequestParam("filtro") String filtro,
            @RequestParam(value = "dryRun", defaultValue = "true") boolean dryRun) {
        return topicoConteudoApplicationService.converterParaHtml(filtro, dryRun);
    }
}
