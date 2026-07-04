package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.dto.WhatsAppConversaGrupoItemDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteManualEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class WhatsAppConversaGrupoResolucaoService {

    private final WhatsAppConversaClienteRepository automaticoRepository;
    private final WhatsAppConversaClienteManualRepository manualRepository;

    public WhatsAppConversaGrupoResolucaoService(
            WhatsAppConversaClienteRepository automaticoRepository,
            WhatsAppConversaClienteManualRepository manualRepository) {
        this.automaticoRepository = automaticoRepository;
        this.manualRepository = manualRepository;
    }

    @Transactional(readOnly = true)
    public List<WhatsAppConversaGrupoItemDTO> listarGruposEfetivosDaConversa(String phoneNumber) {
        String canonico = WhatsAppService.formatPhoneNumber(phoneNumber);
        return resolverEfetivosInterno(
                        automaticoRepository.findByPhoneNumber(canonico),
                        manualRepository.findByPhoneNumber(canonico))
                .stream()
                .map(this::toDto)
                .toList();
    }

    /** auto ∪ INCLUIR manual − EXCLUIR manual (EXCLUIR vence auto). */
    List<GrupoEfetivo> resolverEfetivosInterno(
            List<WhatsAppConversaClienteEntity> automaticos,
            List<WhatsAppConversaClienteManualEntity> manuais) {
        Map<String, WhatsAppConversaClienteManualEntity> manualPorCodigo = manuais.stream()
                .collect(Collectors.toMap(
                        m -> normalizarCodigo(m.getClienteCodigo()),
                        Function.identity(),
                        (a, b) -> b,
                        LinkedHashMap::new));

        Map<String, GrupoEfetivo> efetivos = new LinkedHashMap<>();

        for (WhatsAppConversaClienteEntity auto : automaticos) {
            String codigo = normalizarCodigo(auto.getClienteCodigo());
            if (!StringUtils.hasText(codigo)) {
                continue;
            }
            WhatsAppConversaClienteManualEntity manual = manualPorCodigo.get(codigo);
            if (manual != null && manual.getAcao() == ConversaClienteManualAcao.EXCLUIR) {
                continue;
            }
            efetivos.put(
                    codigo,
                    new GrupoEfetivo(
                            codigo,
                            nomeExibicao(auto.getClienteNome()),
                            true,
                            manual != null && manual.getAcao() == ConversaClienteManualAcao.INCLUIR));
        }

        for (WhatsAppConversaClienteManualEntity manual : manuais) {
            if (manual.getAcao() != ConversaClienteManualAcao.INCLUIR) {
                continue;
            }
            String codigo = normalizarCodigo(manual.getClienteCodigo());
            if (!StringUtils.hasText(codigo) || efetivos.containsKey(codigo)) {
                continue;
            }
            efetivos.put(
                    codigo,
                    new GrupoEfetivo(codigo, nomeExibicao(manual.getClienteNome()), false, true));
        }

        return efetivos.values().stream()
                .sorted(Comparator.comparing(GrupoEfetivo::nome, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private WhatsAppConversaGrupoItemDTO toDto(GrupoEfetivo grupo) {
        return new WhatsAppConversaGrupoItemDTO(
                grupo.codigo(), grupo.nome(), grupo.automatico(), grupo.incluidoManual());
    }

    private static String normalizarCodigo(String codigo) {
        return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigo);
    }

    private static String nomeExibicao(String nome) {
        return StringUtils.hasText(nome) ? Utf8MojibakeUtil.corrigir(nome.trim()) : "";
    }

    record GrupoEfetivo(String codigo, String nome, boolean automatico, boolean incluidoManual) {}
}
