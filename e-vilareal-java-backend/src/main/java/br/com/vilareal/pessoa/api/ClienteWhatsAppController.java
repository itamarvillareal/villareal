package br.com.vilareal.pessoa.api;

import br.com.vilareal.pessoa.api.dto.ClienteWhatsAppItemRequest;
import br.com.vilareal.pessoa.api.dto.ClienteWhatsAppItemResponse;
import br.com.vilareal.pessoa.application.ClienteWhatsAppApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clientes/{clienteId}/whatsapp")
@Tag(name = "Cliente — WhatsApp", description = "Números para notificações automáticas por cliente")
public class ClienteWhatsAppController {

    private final ClienteWhatsAppApplicationService clienteWhatsAppService;

    public ClienteWhatsAppController(ClienteWhatsAppApplicationService clienteWhatsAppService) {
        this.clienteWhatsAppService = clienteWhatsAppService;
    }

    @GetMapping
    @Operation(summary = "Listar números WhatsApp do cliente")
    public List<ClienteWhatsAppItemResponse> listar(@PathVariable Long clienteId) {
        return clienteWhatsAppService.listar(clienteId);
    }

    @PutMapping
    @Operation(summary = "Substituir lista de números WhatsApp do cliente")
    public List<ClienteWhatsAppItemResponse> substituir(
            @PathVariable Long clienteId, @Valid @RequestBody List<ClienteWhatsAppItemRequest> body) {
        return clienteWhatsAppService.substituir(clienteId, body);
    }

    @PostMapping("/importar-pessoa")
    @Operation(
            summary = "Importar telefones da pessoa",
            description =
                    "Copia contatos tipo telefone de pessoa_contato (e telefone legado da pessoa) para cliente_whatsapp, sem alterar o cadastro de pessoas.")
    public List<ClienteWhatsAppItemResponse> importarDaPessoa(
            @PathVariable Long clienteId, @RequestParam("pessoaId") Long pessoaId) {
        return clienteWhatsAppService.importarTelefonesDaPessoa(clienteId, pessoaId);
    }
}
