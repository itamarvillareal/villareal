package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class WhatsAppGrupoListService {

    private final WhatsAppConversaClienteManualRepository manualRepository;

    public WhatsAppGrupoListService(WhatsAppConversaClienteManualRepository manualRepository) {
        this.manualRepository = manualRepository;
    }

    @Transactional(readOnly = true)
    public List<WhatsAppGrupoDTO> listarGrupos() {
        return manualRepository.listarGruposEfetivosComContagem().stream()
                .map(row -> new WhatsAppGrupoDTO(
                        CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(row.getClienteCodigo()),
                        Utf8MojibakeUtil.corrigir(StringUtils.trimWhitespace(row.getClienteNome())),
                        row.getQtdConversas() != null ? row.getQtdConversas() : 0L))
                .toList();
    }

    @Transactional(readOnly = true)
    public java.util.Optional<WhatsAppGrupoDTO> buscarGrupo(String clienteCodigo) {
        String codigo = normalizarFiltroClienteCodigo(clienteCodigo);
        if (!StringUtils.hasText(codigo)) {
            return java.util.Optional.empty();
        }
        return listarGrupos().stream().filter(g -> codigo.equals(g.codigo())).findFirst();
    }

    /** Normaliza código para filtro SQL; vazio = sem filtro (aba Todas). */
    public static String normalizarFiltroClienteCodigo(String clienteCodigo) {
        if (!StringUtils.hasText(clienteCodigo)) {
            return "";
        }
        return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clienteCodigo.trim());
    }
}
