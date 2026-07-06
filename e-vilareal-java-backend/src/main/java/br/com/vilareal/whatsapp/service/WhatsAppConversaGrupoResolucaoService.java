package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.dto.WhatsAppConversaGrupoItemDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteManualEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;

@Service
public class WhatsAppConversaGrupoResolucaoService {

    private final WhatsAppConversaClienteManualRepository manualRepository;

    public WhatsAppConversaGrupoResolucaoService(WhatsAppConversaClienteManualRepository manualRepository) {
        this.manualRepository = manualRepository;
    }

    @Transactional(readOnly = true)
    public List<WhatsAppConversaGrupoItemDTO> listarGruposEfetivosDaConversa(String phoneNumber) {
        String canonico = WhatsAppService.formatPhoneNumber(phoneNumber);
        return manualRepository.findByPhoneNumber(canonico).stream()
                .filter(m -> m.getAcao() == ConversaClienteManualAcao.INCLUIR)
                .map(this::toDto)
                .sorted(Comparator.comparing(WhatsAppConversaGrupoItemDTO::nome, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private WhatsAppConversaGrupoItemDTO toDto(WhatsAppConversaClienteManualEntity manual) {
        String codigo = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(manual.getClienteCodigo());
        String nome = StringUtils.hasText(manual.getClienteNome())
                ? Utf8MojibakeUtil.corrigir(manual.getClienteNome().trim())
                : "";
        return new WhatsAppConversaGrupoItemDTO(codigo, nome, false, true);
    }
}
