package br.com.vilareal.monitoramento.api;

import br.com.vilareal.monitoramento.api.dto.CadastroDescobertoResponse;
import br.com.vilareal.monitoramento.api.dto.PessoaMonitoradaResponse;
import br.com.vilareal.monitoramento.api.dto.ProcessoDescobertoResponse;
import br.com.vilareal.monitoramento.api.dto.SegredoContagemResponse;
import br.com.vilareal.monitoramento.application.MonitoramentoAvisoService;
import br.com.vilareal.monitoramento.application.MonitoramentoCadastroService;
import br.com.vilareal.monitoramento.application.MonitoramentoConsultaService;
import br.com.vilareal.monitoramento.application.MonitoramentoTriagemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints da tela de monitoramento PROJUDI (Parte 5): leituras (Bloco A) e ações de
 * triagem (Bloco B). Cadastro de processo virá em bloco próprio.
 */
@RestController
@RequestMapping("/api/monitoramento")
@Tag(name = "Monitoramento PROJUDI", description = "Processos descobertos pela varredura de pessoas monitoradas")
public class MonitoramentoController {

    private final MonitoramentoConsultaService consultaService;
    private final MonitoramentoTriagemService triagemService;
    private final MonitoramentoCadastroService cadastroService;
    private final MonitoramentoAvisoService avisoService;

    public MonitoramentoController(
            MonitoramentoConsultaService consultaService,
            MonitoramentoTriagemService triagemService,
            MonitoramentoCadastroService cadastroService,
            MonitoramentoAvisoService avisoService) {
        this.consultaService = consultaService;
        this.triagemService = triagemService;
        this.cadastroService = cadastroService;
        this.avisoService = avisoService;
    }

    @GetMapping("/pessoas")
    @Operation(summary = "Pessoas marcadas para monitoramento, com alertas pendentes, total de "
            + "descobertos e soma do segredo de justiça")
    public List<PessoaMonitoradaResponse> pessoas() {
        return consultaService.pessoasMonitoradas();
    }

    @GetMapping("/descobertos")
    @Operation(summary = "Caixa de entrada: descobertos de todas as pessoas monitoradas (default situacao=NOVO), "
            + "mais recentes por data de distribuição primeiro")
    public List<ProcessoDescobertoResponse> descobertos(
            @RequestParam(required = false, defaultValue = "NOVO") String situacao) {
        return consultaService.caixaDeEntrada(situacao);
    }

    @GetMapping("/pessoa/{id}/descobertos")
    @Operation(summary = "Painel da pessoa: descobertos filtráveis por situacao; recentes=true recorta por "
            + "data de distribuição nos últimos 30 dias")
    public List<ProcessoDescobertoResponse> descobertosDaPessoa(
            @PathVariable Long id,
            @RequestParam(required = false) String situacao,
            @RequestParam(required = false, defaultValue = "false") boolean recentes) {
        return consultaService.descobertosDaPessoa(id, situacao, recentes);
    }

    @GetMapping("/pessoa/{id}/segredo")
    @Operation(summary = "Contagem de processos em segredo de justiça por serventia da pessoa")
    public List<SegredoContagemResponse> segredoDaPessoa(@PathVariable Long id) {
        return consultaService.segredoDaPessoa(id);
    }

    @PostMapping("/descobertos/{id}/ignorar")
    @Operation(summary = "Marca o descoberto como IGNORADO (persistente)")
    public ProcessoDescobertoResponse ignorar(@PathVariable Long id) {
        return triagemService.ignorar(id);
    }

    @PostMapping("/descobertos/{id}/enriquecer")
    @Operation(summary = "Colhe CNJ completo, classe e serventia abrindo o detalhe no PROJUDI "
            + "(rebusca por CPF para obter token fresco; sob o gate; não registra ciência)")
    public ProcessoDescobertoResponse enriquecer(@PathVariable Long id) {
        return triagemService.enriquecer(id);
    }

    /** Corpo opcional do cadastro: sem ele, a resposta devolve candidatos/sugestão para o modal. */
    public record CadastrarDescobertoRequest(Long clienteId, Integer numeroInterno) {}

    @GetMapping("/descobertos/{id}/aviso")
    @Operation(summary = "Contexto do aviso WhatsApp: consentimento, telefones do cadastro, status do "
            + "template na Meta e mensagem sugerida — sem efeito colateral")
    public MonitoramentoAvisoService.ContextoAviso contextoAviso(@PathVariable Long id) {
        return avisoService.contexto(id);
    }

    /** Corpo do envio: telefone escolhido no modal + os 4 parâmetros do template (editáveis). */
    public record AvisarClienteRequest(String telefone, List<String> parametros) {}

    @PostMapping("/descobertos/{id}/avisar")
    @Operation(summary = "Envia o aviso de processo novo ao cliente via WhatsApp (template "
            + "aviso_novo_processo). RECUSA com 403 se a pessoa não registrou consentimento — "
            + "a trava é do backend, não da UI. Um aviso por descoberto; nunca automático")
    public MonitoramentoAvisoService.ResultadoAviso avisar(
            @PathVariable Long id, @RequestBody AvisarClienteRequest body) {
        String telefone = body == null ? null : body.telefone();
        List<String> parametros = body == null ? null : body.parametros();
        return avisoService.avisar(id, telefone, parametros);
    }

    @PostMapping("/descobertos/{id}/cadastrar")
    @Operation(summary = "Cadastra o descoberto como processo do acervo (ação humana do botão, nunca automática). "
            + "Anti-duplicata por numero_cnj_digitos: se o CNJ já existe, vincula sem criar")
    public CadastroDescobertoResponse cadastrar(
            @PathVariable Long id, @RequestBody(required = false) CadastrarDescobertoRequest body) {
        Long clienteId = body == null ? null : body.clienteId();
        Integer numeroInterno = body == null ? null : body.numeroInterno();
        return cadastroService.cadastrar(id, clienteId, numeroInterno);
    }
}
