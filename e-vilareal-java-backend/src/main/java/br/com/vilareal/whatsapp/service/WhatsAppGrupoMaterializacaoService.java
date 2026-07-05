package br.com.vilareal.whatsapp.service;

import br.com.vilareal.processo.application.CodigoClienteUtil;
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
import java.util.LinkedHashMap;
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
        int telefonesComFalha = 0;
        for (String phone : telefones) {
            try {
                linhas += materializarTelefone(phone);
            } catch (Exception e) {
                telefonesComFalha++;
                log.warn(
                        "WhatsApp grupos materialização falhou telefone={}: {}",
                        phone,
                        e.getMessage(),
                        e);
            }
        }
        long duracaoMs = (System.nanoTime() - inicio) / 1_000_000L;
        log.info(
                "WhatsApp grupos materialização: telefones={} telefones_falha={} linhas_cliente={} duracao_ms={}",
                telefones.size(),
                telefonesComFalha,
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
        // Garante que o DELETE bulk chega ao banco antes dos INSERTs do saveAll (mesma transação).
        conversaClienteRepository.flush();
        if (clientes.isEmpty()) {
            return 0;
        }
        Instant agora = clock.instant();
        LinkedHashMap<String, WhatsAppConversaClienteEntity> porCodigoCanonico = new LinkedHashMap<>();
        for (WhatsAppVinculoService.ClienteVinculoResumo cliente : clientes) {
            String codigoCanonico = codigoClienteCanonico(cliente.codigoCliente());
            if (!StringUtils.hasText(codigoCanonico)) {
                continue;
            }
            porCodigoCanonico.putIfAbsent(
                    codigoCanonico,
                    novaLinhaCliente(phoneNumber, codigoCanonico, cliente.nome(), agora));
        }
        List<WhatsAppConversaClienteEntity> linhas = new ArrayList<>(porCodigoCanonico.values());
        if (linhas.isEmpty()) {
            return 0;
        }
        conversaClienteRepository.saveAll(linhas);
        return linhas.size();
    }

    private static WhatsAppConversaClienteEntity novaLinhaCliente(
            String phoneNumber, String codigoCanonico, String nome, Instant agora) {
        WhatsAppConversaClienteEntity entity = new WhatsAppConversaClienteEntity();
        entity.setPhoneNumber(phoneNumber);
        entity.setClienteCodigo(codigoCanonico);
        entity.setClienteNome(nome);
        entity.setAtualizadoEm(agora);
        return entity;
    }

    static String codigoClienteCanonico(String codigoCliente) {
        return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
    }
}
