package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoSugestaoConversaDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class WhatsAppGrupoGestaoService {

    private static final int MAX_CONVERSAS_SUGESTAO = 2000;

    private final WhatsAppConversaClienteManualRepository manualRepository;
    private final WhatsAppMessageRepository messageRepository;
    private final WhatsAppVinculoService vinculoService;
    private final ClienteRepository clienteRepository;
    private final WhatsAppGrupoListService grupoListService;
    private final Clock clock;

    public WhatsAppGrupoGestaoService(
            WhatsAppConversaClienteManualRepository manualRepository,
            WhatsAppMessageRepository messageRepository,
            WhatsAppVinculoService vinculoService,
            ClienteRepository clienteRepository,
            WhatsAppGrupoListService grupoListService,
            Clock clock) {
        this.manualRepository = manualRepository;
        this.messageRepository = messageRepository;
        this.vinculoService = vinculoService;
        this.clienteRepository = clienteRepository;
        this.grupoListService = grupoListService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<WhatsAppGrupoSugestaoConversaDTO> listarSugestoesConversas(String clienteCodigo) {
        String codigo = normalizarCodigoObrigatorio(clienteCodigo);
        validarClienteExiste(codigo);
        Set<String> incluidos = telefonesIncluidosNoGrupo(codigo);

        Map<String, WhatsAppGrupoSugestaoConversaDTO> porTelefone = new LinkedHashMap<>();
        int page = 0;
        while (true) {
            var chunk = messageRepository.findConversationSummariesExcluindoAniversario(
                    false, "", PageRequest.of(page, 200));
            if (chunk.isEmpty()) {
                break;
            }
            for (var row : chunk.getContent()) {
                String phone = WhatsAppService.formatPhoneNumber(row.getPhoneNumber());
                if (!StringUtils.hasText(phone) || porTelefone.containsKey(phone)) {
                    continue;
                }
                boolean suggested = telefoneSugeridoParaCliente(phone, codigo);
                boolean included = incluidos.contains(phone);
                if (!suggested && !included) {
                    continue;
                }
                porTelefone.put(
                        phone,
                        new WhatsAppGrupoSugestaoConversaDTO(
                                phone,
                                nomeContato(row.getContactName()),
                                suggested,
                                included));
            }
            if (chunk.isLast() || porTelefone.size() >= MAX_CONVERSAS_SUGESTAO) {
                break;
            }
            page++;
        }

        for (String phone : incluidos) {
            if (porTelefone.containsKey(phone)) {
                continue;
            }
            porTelefone.put(
                    phone,
                    new WhatsAppGrupoSugestaoConversaDTO(phone, "", false, true));
        }

        return porTelefone.values().stream()
                .sorted(Comparator.comparing(WhatsAppGrupoSugestaoConversaDTO::included)
                        .reversed()
                        .thenComparing(WhatsAppGrupoSugestaoConversaDTO::suggested)
                        .reversed()
                        .thenComparing(
                                WhatsAppGrupoSugestaoConversaDTO::contactName,
                                String.CASE_INSENSITIVE_ORDER))
                .limit(MAX_CONVERSAS_SUGESTAO)
                .toList();
    }

    @Transactional
    public WhatsAppGrupoDTO salvarGrupo(String clienteCodigo, List<String> phoneNumbers) {
        String codigo = normalizarCodigoObrigatorio(clienteCodigo);
        String nome = resolverNomeCliente(codigo);
        sincronizarMembros(codigo, nome, phoneNumbers);
        return grupoListService.buscarGrupo(codigo)
                .orElse(new WhatsAppGrupoDTO(codigo, nome, 0));
    }

    @Transactional
    public void excluirGrupo(String clienteCodigo) {
        String codigo = normalizarCodigoObrigatorio(clienteCodigo);
        manualRepository.deleteByClienteCodigo(codigo);
    }

    private void sincronizarMembros(String codigo, String nome, List<String> phoneNumbers) {
        Set<String> desejados = new HashSet<>();
        if (phoneNumbers != null) {
            for (String raw : phoneNumbers) {
                String phone = WhatsAppService.formatPhoneNumber(raw);
                if (StringUtils.hasText(phone)) {
                    desejados.add(phone);
                }
            }
        }

        if (desejados.isEmpty()) {
            throw new BusinessRuleException("Selecione ao menos uma conversa para o grupo.");
        }

        Set<String> atuais = telefonesIncluidosNoGrupo(codigo);
        Instant agora = clock.instant();
        String criadoPor = resolveCriadoPor();

        for (String phone : desejados) {
            if (atuais.contains(phone)) {
                continue;
            }
            manualRepository.upsert(
                    phone, codigo, nome, ConversaClienteManualAcao.INCLUIR.name(), criadoPor, agora);
        }

        for (String phone : atuais) {
            if (!desejados.contains(phone)) {
                manualRepository.deleteByPhoneNumberAndClienteCodigo(phone, codigo);
            }
        }
    }

    private Set<String> telefonesIncluidosNoGrupo(String codigo) {
        Set<String> incluidos = new HashSet<>();
        for (var row : manualRepository.findByClienteCodigoAndAcao(codigo, ConversaClienteManualAcao.INCLUIR)) {
            incluidos.add(row.getPhoneNumber());
        }
        return incluidos;
    }

    private boolean telefoneSugeridoParaCliente(String phone, String codigo) {
        return vinculoService.resolverClientesPorTelefone(phone).stream()
                .anyMatch(c -> codigo.equals(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(c.codigoCliente())));
    }

    private void validarClienteExiste(String codigo) {
        clienteRepository
                .findByCodigoClienteFetchPessoaTrim(codigo)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + codigo));
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

    private static String normalizarCodigoObrigatorio(String clienteCodigo) {
        String codigo = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clienteCodigo);
        if (!StringUtils.hasText(codigo)) {
            throw new BusinessRuleException("Código de cliente inválido.");
        }
        return codigo;
    }

    private static String nomeContato(String nome) {
        return StringUtils.hasText(nome) ? Utf8MojibakeUtil.corrigir(nome.trim()) : "";
    }

    private static String resolveCriadoPor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && StringUtils.hasText(auth.getName())) {
            return auth.getName();
        }
        return "sistema";
    }
}
