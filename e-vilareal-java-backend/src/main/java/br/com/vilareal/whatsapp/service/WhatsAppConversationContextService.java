package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.whatsapp.dto.WhatsAppProcessoContextItemDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class WhatsAppConversationContextService {

    private static final int JANELA_DIAS = 90;
    private static final int MAX_CANDIDATOS = 5;

    private final CobrancaWhatsAppRepository cobrancaRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteRepository clienteRepository;

    public WhatsAppConversationContextService(
            CobrancaWhatsAppRepository cobrancaRepository,
            ProcessoRepository processoRepository,
            ClienteRepository clienteRepository) {
        this.cobrancaRepository = cobrancaRepository;
        this.processoRepository = processoRepository;
        this.clienteRepository = clienteRepository;
    }

    @Transactional(readOnly = true)
    public List<WhatsAppProcessoContextItemDTO> resolverContextos(String phoneNumber) {
        String suffix = sufixo11(phoneNumber);
        if (!StringUtils.hasText(suffix)) {
            return List.of();
        }
        Instant desde = Instant.now().minus(JANELA_DIAS, ChronoUnit.DAYS);
        List<CobrancaWhatsAppEntity> cobrancas =
                cobrancaRepository.findRecentesPorSufixoTelefone(desde, List.of(suffix));
        return montarContextos(cobrancas);
    }

    @Transactional(readOnly = true)
    public Map<String, List<WhatsAppProcessoContextItemDTO>> resolverPorTelefones(Collection<String> phoneNumbers) {
        if (phoneNumbers == null || phoneNumbers.isEmpty()) {
            return Map.of();
        }

        Map<String, String> canonicalPorTelefone = new LinkedHashMap<>();
        Set<String> suffixes = new HashSet<>();
        for (String phone : phoneNumbers) {
            if (!StringUtils.hasText(phone)) {
                continue;
            }
            String suffix = sufixo11(phone);
            if (!StringUtils.hasText(suffix)) {
                continue;
            }
            canonicalPorTelefone.put(phone, suffix);
            suffixes.add(suffix);
        }
        if (suffixes.isEmpty()) {
            return Map.of();
        }

        Instant desde = Instant.now().minus(JANELA_DIAS, ChronoUnit.DAYS);
        List<CobrancaWhatsAppEntity> cobrancas =
                cobrancaRepository.findRecentesPorSufixoTelefone(desde, suffixes);

        Map<String, List<CobrancaWhatsAppEntity>> porSuffix = new HashMap<>();
        for (CobrancaWhatsAppEntity c : cobrancas) {
            String suffix = sufixo11(c.getPhoneNumber());
            if (!StringUtils.hasText(suffix)) {
                continue;
            }
            porSuffix.computeIfAbsent(suffix, k -> new ArrayList<>()).add(c);
        }

        Map<String, List<WhatsAppProcessoContextItemDTO>> out = new HashMap<>();
        for (Map.Entry<String, String> entry : canonicalPorTelefone.entrySet()) {
            List<CobrancaWhatsAppEntity> rows = porSuffix.getOrDefault(entry.getValue(), List.of());
            out.put(entry.getKey(), montarContextos(rows));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public WhatsAppProcessoContextItemDTO resolverContextoMaisRecente(String phoneNumber) {
        List<WhatsAppProcessoContextItemDTO> itens = resolverContextos(phoneNumber);
        return itens.isEmpty() ? null : itens.getFirst();
    }

    private List<WhatsAppProcessoContextItemDTO> montarContextos(List<CobrancaWhatsAppEntity> cobrancas) {
        if (cobrancas == null || cobrancas.isEmpty()) {
            return List.of();
        }

        Set<Long> processoIds = cobrancas.stream()
                .map(CobrancaWhatsAppEntity::getProcessoId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Set<Long> clienteIds = cobrancas.stream()
                .map(CobrancaWhatsAppEntity::getClienteId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Long, ProcessoEntity> processos = new HashMap<>();
        if (!processoIds.isEmpty()) {
            for (ProcessoEntity p : processoRepository.findByIdInWithClienteAndPessoa(processoIds)) {
                processos.put(p.getId(), p);
            }
        }

        Map<Long, ClienteEntity> clientes = new HashMap<>();
        for (Long clienteId : clienteIds) {
            clienteRepository.findById(clienteId).ifPresent(c -> clientes.put(clienteId, c));
        }

        Map<Long, WhatsAppProcessoContextItemDTO> dedupePorProcesso = new LinkedHashMap<>();
        List<WhatsAppProcessoContextItemDTO> semProcesso = new ArrayList<>();

        for (CobrancaWhatsAppEntity c : cobrancas) {
            WhatsAppProcessoContextItemDTO item = toItem(c, processos, clientes);
            if (item.processoId() != null) {
                dedupePorProcesso.putIfAbsent(item.processoId(), item);
            } else {
                semProcesso.add(item);
            }
            if (dedupePorProcesso.size() + semProcesso.size() >= MAX_CANDIDATOS) {
                break;
            }
        }

        List<WhatsAppProcessoContextItemDTO> out = new ArrayList<>(dedupePorProcesso.values());
        for (WhatsAppProcessoContextItemDTO item : semProcesso) {
            if (out.size() >= MAX_CANDIDATOS) {
                break;
            }
            out.add(item);
        }
        return List.copyOf(out);
    }

    private static WhatsAppProcessoContextItemDTO toItem(
            CobrancaWhatsAppEntity c, Map<Long, ProcessoEntity> processos, Map<Long, ClienteEntity> clientes) {
        ProcessoEntity proc = c.getProcessoId() != null ? processos.get(c.getProcessoId()) : null;
        ClienteEntity cliente = null;
        if (proc != null && proc.getCliente() != null) {
            cliente = proc.getCliente();
        } else if (c.getClienteId() != null) {
            cliente = clientes.get(c.getClienteId());
        }

        Integer numeroInterno = proc != null ? proc.getNumeroInterno() : null;
        String codigo = null;
        String nomeEscritorio = null;
        if (cliente != null) {
            if (StringUtils.hasText(cliente.getCodigoCliente())) {
                codigo = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(cliente.getCodigoCliente());
            }
            PessoaEntity pessoa = cliente.getPessoa();
            if (pessoa != null && StringUtils.hasText(pessoa.getNome())) {
                nomeEscritorio = Utf8MojibakeUtil.corrigir(pessoa.getNome().trim());
            } else if (StringUtils.hasText(cliente.getNomeReferencia())) {
                nomeEscritorio = cliente.getNomeReferencia().trim();
            }
        }

        Instant quando = c.getEnviadoAt() != null ? c.getEnviadoAt() : c.getScheduledAt();
        if (quando == null) {
            quando = c.getCreatedAt();
        }

        Long clienteIdContexto = cliente != null ? cliente.getId() : c.getClienteId();

        return new WhatsAppProcessoContextItemDTO(
                c.getId(),
                c.getProcessoId(),
                numeroInterno,
                clienteIdContexto,
                codigo,
                nomeEscritorio,
                c.getUnidadeDescricao(),
                c.getCondominioNome(),
                c.getStatus(),
                quando);
    }

    static String sufixo11(String phoneNumber) {
        if (!StringUtils.hasText(phoneNumber)) {
            return null;
        }
        String digits = phoneNumber.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return null;
        }
        return digits.length() >= 11 ? digits.substring(digits.length() - 11) : digits;
    }
}
