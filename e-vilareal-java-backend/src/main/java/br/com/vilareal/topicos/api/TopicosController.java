package br.com.vilareal.topicos.api;

import br.com.vilareal.topicos.api.dto.TopicoNoDto;
import br.com.vilareal.topicos.application.TopicosApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/topicos")
@Tag(name = "Tópicos")
public class TopicosController {

    private final TopicosApplicationService topicosApplicationService;

    public TopicosController(TopicosApplicationService topicosApplicationService) {
        this.topicosApplicationService = topicosApplicationService;
    }

    @GetMapping("/hierarchy")
    @Operation(description = "Árvore raiz da tela Tópicos (mesmo contrato que `topicosHierarchy.js` no React).")
    public TopicoNoDto hierarchy() {
        return topicosApplicationService.obterRaiz();
    }
}
