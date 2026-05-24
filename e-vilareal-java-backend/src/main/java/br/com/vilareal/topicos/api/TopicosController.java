package br.com.vilareal.topicos.api;

import br.com.vilareal.topicos.api.dto.*;
import br.com.vilareal.topicos.application.TopicoConteudoApplicationService;
import br.com.vilareal.topicos.application.TopicoProcessadorService;
import br.com.vilareal.topicos.application.TopicosApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/topicos")
@Tag(name = "Tópicos")
public class TopicosController {

    private final TopicosApplicationService topicosApplicationService;
    private final TopicoConteudoApplicationService topicoConteudoApplicationService;
    private final TopicoProcessadorService topicoProcessadorService;

    public TopicosController(
            TopicosApplicationService topicosApplicationService,
            TopicoConteudoApplicationService topicoConteudoApplicationService,
            TopicoProcessadorService topicoProcessadorService) {
        this.topicosApplicationService = topicosApplicationService;
        this.topicoConteudoApplicationService = topicoConteudoApplicationService;
        this.topicoProcessadorService = topicoProcessadorService;
    }

    @GetMapping("/hierarchy")
    @Operation(description = "Árvore raiz da tela Tópicos (mesmo contrato que `topicosHierarchy.js` no React).")
    public TopicoNoDto hierarchy() {
        return topicosApplicationService.obterRaiz();
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
}
