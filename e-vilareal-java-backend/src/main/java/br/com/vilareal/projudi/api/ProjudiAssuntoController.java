package br.com.vilareal.projudi.api;

import br.com.vilareal.projudi.ProjudiAssuntoCatalogoService;
import br.com.vilareal.projudi.ProjudiAssuntoCatalogoService.AssuntoItem;
import br.com.vilareal.projudi.api.dto.ProjudiAssuntoCadastroRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/projudi/assuntos")
@Tag(name = "PROJUDI — assuntos", description = "Catálogo de assuntos PROJUDI (fixos + cadastro do usuário)")
public class ProjudiAssuntoController {

    private static final Logger log = LoggerFactory.getLogger(ProjudiAssuntoController.class);

    private final ProjudiAssuntoCatalogoService assuntoCatalogoService;

    public ProjudiAssuntoController(ProjudiAssuntoCatalogoService assuntoCatalogoService) {
        this.assuntoCatalogoService = assuntoCatalogoService;
    }

    @GetMapping
    @Operation(summary = "Lista assuntos PROJUDI (catálogo fixo + cadastrados pelo usuário)")
    public List<AssuntoItem> listar() {
        return assuntoCatalogoService.listarCatalogo();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cadastra ou atualiza assunto PROJUDI (id + descrição)")
    public AssuntoItem cadastrar(@Valid @RequestBody ProjudiAssuntoCadastroRequest body) {
        log.info("cadastrar-assunto-projudi id={}", body.idAssunto());
        return assuntoCatalogoService.cadastrarAssunto(body.idAssunto(), body.descricao());
    }

    @DeleteMapping("/{idAssunto}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove assunto da lista (cadastro do usuário ou oculta item do catálogo fixo)")
    public void remover(@PathVariable int idAssunto) {
        log.info("remover-assunto-projudi id={}", idAssunto);
        assuntoCatalogoService.removerAssuntoCadastro(idAssunto);
    }
}
