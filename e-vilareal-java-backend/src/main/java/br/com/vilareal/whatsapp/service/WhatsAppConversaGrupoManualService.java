package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.dto.WhatsAppConversaGrupoItemDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Service
public class WhatsAppConversaGrupoManualService {

    private final WhatsAppConversaClienteManualRepository manualRepository;
    private final WhatsAppConversaClienteRepository automaticoRepository;
    private final ClienteRepository clienteRepository;
    private final WhatsAppConversaGrupoResolucaoService resolucaoService;
    private final Clock clock;

    public WhatsAppConversaGrupoManualService(
            WhatsAppConversaClienteManualRepository manualRepository,
            WhatsAppConversaClienteRepository automaticoRepository,
            ClienteRepository clienteRepository,
            WhatsAppConversaGrupoResolucaoService resolucaoService,
            Clock clock) {
        this.manualRepository = manualRepository;
        this.automaticoRepository = automaticoRepository;
        this.clienteRepository = clienteRepository;
        this.resolucaoService = resolucaoService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<WhatsAppConversaGrupoItemDTO> listarGrupos(String phoneNumber) {
        return resolucaoService.listarGruposEfetivosDaConversa(phoneNumber);
    }

    @Transactional
    public List<WhatsAppConversaGrupoItemDTO> incluirManualmente(String phoneNumber, String clienteCodigo) {
        String canonico = WhatsAppService.formatPhoneNumber(phoneNumber);
        String codigo = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clienteCodigo);
        if (!StringUtils.hasText(codigo)) {
            throw new BusinessRuleException("Código de cliente inválido.");
        }
        String nome = resolverNomeCliente(codigo);
        manualRepository.upsert(
                canonico,
                codigo,
                nome,
                ConversaClienteManualAcao.INCLUIR.name(),
                resolveCriadoPor(),
                clock.instant());
        return resolucaoService.listarGruposEfetivosDaConversa(canonico);
    }

    @Transactional
    public List<WhatsAppConversaGrupoItemDTO> excluirManualmente(String phoneNumber, String clienteCodigo) {
        String canonico = WhatsAppService.formatPhoneNumber(phoneNumber);
        String codigo = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clienteCodigo);
        if (!StringUtils.hasText(codigo)) {
            throw new BusinessRuleException("Código de cliente inválido.");
        }

        boolean temAutomatico = automaticoRepository.findByPhoneNumber(canonico).stream()
                .anyMatch(a -> codigo.equals(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(a.getClienteCodigo())));

        var manualOpt = manualRepository.findByPhoneNumberAndClienteCodigo(canonico, codigo);
        if (temAutomatico) {
            String nome = manualOpt
                    .map(m -> m.getClienteNome())
                    .filter(StringUtils::hasText)
                    .orElseGet(() -> automaticoRepository.findByPhoneNumber(canonico).stream()
                            .filter(a ->
                                    codigo.equals(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(a.getClienteCodigo())))
                            .map(a -> a.getClienteNome())
                            .findFirst()
                            .orElseGet(() -> resolverNomeCliente(codigo)));
            manualRepository.upsert(
                    canonico,
                    codigo,
                    nome,
                    ConversaClienteManualAcao.EXCLUIR.name(),
                    resolveCriadoPor(),
                    clock.instant());
        } else if (manualOpt.isPresent()
                && manualOpt.orElseThrow().getAcao() == ConversaClienteManualAcao.INCLUIR) {
            manualRepository.deleteByPhoneNumberAndClienteCodigo(canonico, codigo);
        } else {
            String nome = resolverNomeCliente(codigo);
            manualRepository.upsert(
                    canonico,
                    codigo,
                    nome,
                    ConversaClienteManualAcao.EXCLUIR.name(),
                    resolveCriadoPor(),
                    clock.instant());
        }

        return resolucaoService.listarGruposEfetivosDaConversa(canonico);
    }

    private String resolverNomeCliente(String codigo) {
        ClienteEntity cliente = clienteRepository
                .findByCodigoClienteFetchPessoaTrim(codigo)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + codigo));
        String nome = StringUtils.hasText(cliente.getNomeReferencia())
                ? cliente.getNomeReferencia()
                : cliente.getPessoa().getNome();
        if (!StringUtils.hasText(nome)) {
            throw new BusinessRuleException("Cliente sem nome cadastrado: " + codigo);
        }
        return Utf8MojibakeUtil.corrigir(nome.trim());
    }

    private static String resolveCriadoPor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && StringUtils.hasText(auth.getName())) {
            return auth.getName();
        }
        return "sistema";
    }
}
