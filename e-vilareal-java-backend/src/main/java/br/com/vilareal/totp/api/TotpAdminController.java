package br.com.vilareal.totp.api;

import br.com.vilareal.totp.api.dto.CredencialTotpRequest;
import br.com.vilareal.totp.api.dto.CredencialTotpResponse;
import br.com.vilareal.totp.api.dto.CredencialTotpSenhaRequest;
import br.com.vilareal.totp.api.dto.CredencialTotpTesteResponse;
import br.com.vilareal.totp.application.CredencialTotpService;
import br.com.vilareal.totp.application.TotpService;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/totp")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class TotpAdminController {

    private final CredencialTotpService credencialTotpService;
    private final TotpService totpService;

    public TotpAdminController(CredencialTotpService credencialTotpService, TotpService totpService) {
        this.credencialTotpService = credencialTotpService;
        this.totpService = totpService;
    }

    @PostMapping("/credenciais")
    @ResponseStatus(HttpStatus.CREATED)
    public CredencialTotpResponse cadastrar(@Valid @RequestBody CredencialTotpRequest request) {
        TribunalIntegracao tribunal = TribunalIntegracao.fromCodigo(request.tribunal());
        CredencialTotpEntity salva = credencialTotpService.cadastrarOuAtualizar(
                tribunal,
                request.login(),
                request.otpauthUriOuSecret(),
                request.senha(),
                request.ativo());
        return CredencialTotpResponse.from(salva);
    }

    @PutMapping("/credenciais/{id}/senha")
    public CredencialTotpResponse definirSenha(
            @PathVariable Long id, @Valid @RequestBody CredencialTotpSenhaRequest request) {
        CredencialTotpEntity salva = credencialTotpService.definirSenhaPrimeiroFator(id, request.senha());
        return CredencialTotpResponse.from(salva);
    }

    @PutMapping("/credenciais/{id}")
    public CredencialTotpResponse atualizar(
            @PathVariable Long id, @Valid @RequestBody CredencialTotpRequest request) {
        CredencialTotpEntity existente = credencialTotpService.buscar(id);
        TribunalIntegracao tribunal = TribunalIntegracao.fromCodigo(request.tribunal());
        if (!existente.getTribunal().equals(tribunal)
                || !existente.getLogin().equalsIgnoreCase(request.login().trim())) {
            throw new IllegalArgumentException(
                    "tribunal/login da credencial não podem ser alterados; cadastre nova credencial.");
        }
        CredencialTotpEntity salva = credencialTotpService.atualizarPorId(
                id, request.otpauthUriOuSecret(), request.senha(), request.ativo());
        return CredencialTotpResponse.from(salva);
    }

    @GetMapping("/credenciais/{id}")
    public CredencialTotpResponse obter(@PathVariable Long id) {
        return CredencialTotpResponse.from(credencialTotpService.buscar(id));
    }

    /**
     * Gera o código TOTP atual para o admin conferir contra o app autenticador na ativação.
     */
    @PostMapping("/credenciais/{id}/teste")
    public CredencialTotpTesteResponse testar(@PathVariable Long id) {
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
