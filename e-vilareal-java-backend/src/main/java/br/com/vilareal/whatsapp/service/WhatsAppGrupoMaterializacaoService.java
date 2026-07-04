package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppGrupoMaterializacaoResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Materializa clientes por conversa WhatsApp em {@code whatsapp_conversa_cliente} (limpa e regrava por
 * telefone).
 */
@Service
public class WhatsAppGrupoMaterializacaoService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppGrupoMaterializacaoService.class);

    private final WhatsAppMessageRepository messageRepository;
    private final WhatsAppConversaClienteRepository conversaClienteRepository;
    private final WhatsAppVinculoService vinculoService;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public WhatsAppGrupoMaterializacaoService(
            WhatsAppMessageRepository messageRepository,
            WhatsAppConversaClienteRepository conversaClienteRepository,
            WhatsAppVinculoService vinculoService,
            TransactionTemplate transactionTemplate,
            Clock clock) {
        this.messageRepository = messageRepository;
        this.conversaClienteRepository = conversaClienteRepository;
        this.vinculoService = vinculoService;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    public WhatsAppGrupoMaterializacaoResultDTO executarRodada() {
        long inicio = System.nanoTime();
        List<String> telefones = messageRepository.findDistinctPhoneNumbers();
        int linhas = 0;
        for (String phone : telefones) {
            linhas += materializarTelefone(phone);
        }
        long duracaoMs = (System.nanoTime() - inicio) / 1_000_000L;
        log.info(
                "WhatsApp grupos materialização: telefones={} linhas_cliente={} duracao_ms={}",
                telefones.size(),
                linhas,
                duracaoMs);
        return new WhatsAppGrupoMaterializacaoResultDTO(telefones.size(), linhas, duracaoMs);
    }

    int materializarTelefone(String phoneNumber) {
        String canonico = WhatsAppService.formatPhoneNumber(phoneNumber);
        if (!StringUtils.hasText(canonico)) {
            return 0;
        }
        List<WhatsAppVinculoService.ClienteVinculoResumo> clientes =
                vinculoService.resolverClientesPorTelefone(canonico);
        Integer inseridos = transactionTemplate.execute(status -> regravarTelefone(canonico, clientes));
        return inseridos != null ? inseridos : 0;
    }

    private int regravarTelefone(String phoneNumber, List<WhatsAppVinculoService.ClienteVinculoResumo> clientes) {
        conversaClienteRepository.deleteByPhoneNumber(phoneNumber);
        if (clientes.isEmpty()) {
            return 0;
        }
        Instant agora = clock.instant();
        List<WhatsAppConversaClienteEntity> linhas = new ArrayList<>(clientes.size());
        for (WhatsAppVinculoService.ClienteVinculoResumo cliente : clientes) {
            WhatsAppConversaClienteEntity entity = new WhatsAppConversaClienteEntity();
            entity.setPhoneNumber(phoneNumber);
            entity.setClienteCodigo(cliente.codigoCliente());
            entity.setClienteNome(cliente.nome());
            entity.setAtualizadoEm(agora);
            linhas.add(entity);
        }
        conversaClienteRepository.saveAll(linhas);
        return linhas.size();
    }
}
