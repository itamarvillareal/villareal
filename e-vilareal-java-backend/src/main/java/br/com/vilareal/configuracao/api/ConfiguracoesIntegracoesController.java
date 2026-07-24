package br.com.vilareal.configuracao.api;

import br.com.vilareal.configuracao.api.dto.InstanciaIntegracoesResponse;
import br.com.vilareal.configuracao.api.dto.ProjudiCredencialConfigRequest;
import br.com.vilareal.configuracao.application.ConfiguracoesIntegracoesService;
import br.com.vilareal.projudi.api.dto.ProjudiCredencialResponse;
import br.com.vilareal.projudi.application.ProjudiCredencialService;
import br.com.vilareal.totp.api.dto.CredencialTotpRequest;
import br.com.vilareal.totp.api.dto.CredencialTotpResponse;
import br.com.vilareal.totp.api.dto.CredencialTotpSenhaRequest;
import br.com.vilareal.totp.api.dto.CredencialTotpTesteResponse;
import br.com.vilareal.totp.application.CredencialTotpService;
import br.com.vilareal.totp.application.TotpService;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/configuracoes/integracoes")
@Tag(name = "Configurações — integrações", description = "Credenciais PROJUDI/PJe e status da instância")
public class ConfiguracoesIntegracoesController {

    private final ConfiguracoesIntegracoesService integracoesService;
    private final ProjudiCredencialService projudiCredencialService;
    private final CredencialTotpService credencialTotpService;
    private final TotpService totpService;

    public ConfiguracoesIntegracoesController(
            ConfiguracoesIntegracoesService integracoesService,
            ProjudiCredencialService projudiCredencialService,
            CredencialTotpService credencialTotpService,
            TotpService totpService) {
        this.integracoesService = integracoesService;
        this.projudiCredencialService = projudiCredencialService;
        this.credencialTotpService = credencialTotpService;
        this.totpService = totpService;
    }

    @GetMapping("/instancia")
    @Operation(summary = "Status da instância (portal / portal1)")
    public InstanciaIntegracoesResponse statusInstancia() {
        return integracoesService.statusInstancia();
    }

    @GetMapping("/projudi/credenciais")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Lista credenciais PROJUDI desta instância")
    public List<ProjudiCredencialResponse> listarProjudi() {
        return projudiCredencialService.listarAtivas();
    }

    @PostMapping("/projudi/credenciais")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cadastra ou atualiza credencial PROJUDI")
    public ProjudiCredencialResponse salvarProjudi(@Valid @RequestBody ProjudiCredencialConfigRequest body) {
        return projudiCredencialService.salvar(body.cpf(), body.senha(), body.rotulo());
    }

    @DeleteMapping("/projudi/credenciais/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove credencial PROJUDI")
    public void excluirProjudi(@PathVariable Long id) {
        projudiCredencialService.excluir(id);
    }

    @GetMapping("/pje/credenciais")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Lista credenciais PJe TRT18 desta instância")
    public List<CredencialTotpResponse> listarPje() {
        return credencialTotpService.listarPorTribunal(TribunalIntegracao.PJE_TRT18).stream()
                .map(CredencialTotpResponse::from)
                .toList();
    }

    @PostMapping("/pje/credenciais")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cadastra ou atualiza credencial PJe (TOTP + senha)")
    public CredencialTotpResponse salvarPje(@Valid @RequestBody CredencialTotpRequest body) {
        TribunalIntegracao tribunal = TribunalIntegracao.fromCodigo(body.tribunal());
        CredencialTotpEntity salva = credencialTotpService.cadastrarOuAtualizar(
                tribunal,
                body.login(),
                body.otpauthUriOuSecret(),
                body.senha(),
                body.ativo());
        return CredencialTotpResponse.from(salva);
    }

    @PutMapping("/pje/credenciais/{id}/senha")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Atualiza somente a senha do 1º fator PJe")
    public CredencialTotpResponse atualizarSenhaPje(
            @PathVariable Long id, @Valid @RequestBody CredencialTotpSenhaRequest body) {
        return CredencialTotpResponse.from(credencialTotpService.definirSenhaPrimeiroFator(id, body.senha()));
    }

    @PostMapping("/pje/credenciais/{id}/teste")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Gera código TOTP de teste")
    public CredencialTotpTesteResponse testarPje(@PathVariable Long id) {
        CredencialTotpEntity cred = credencialTotpService.buscar(id);
        long agora = System.currentTimeMillis() / 1000L;
        String codigo = totpService.gerarCodigoAtualSemMargem(id);
        int periodo = cred.getPeriodoSegundos();
        long segundosNoPeriodo = Math.floorMod(agora, periodo);
        int restantes = (int) (periodo - segundosNoPeriodo);
        return new CredencialTotpTesteResponse(
                cred.getId(),
                cred.getTribunal().name(),
                cred.getLogin(),
                codigo,
                periodo,
                restantes);
    }
}
