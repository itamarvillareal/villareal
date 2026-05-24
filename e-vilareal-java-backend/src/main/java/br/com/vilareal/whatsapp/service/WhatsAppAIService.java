package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.ClaudeApiService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Assistente WhatsApp com Claude — monta contexto do cliente/processos e responde automaticamente.
 */
@Service
public class WhatsAppAIService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppAIService.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter HORA_FORMAT = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_HISTORY_MESSAGES = 20;
    private static final int RATE_LIMIT_MAX = 10;
    private static final long RATE_LIMIT_WINDOW_SECONDS = 60L;
    private static final int CLAUDE_MAX_TOKENS = 500;
    private static final double CLAUDE_TEMPERATURE = 0.3;

    private static final String FALLBACK_EMPTY_CLAUDE =
            "Obrigado pela sua mensagem! No momento não consegui processar sua solicitação. "
                    + "Nossa equipe entrará em contato em breve. Atendimento: seg-sex, 8h-18h.";

    private static final String FALLBACK_ERROR =
            "Obrigado pela mensagem! Tive uma dificuldade técnica, mas já informei a equipe. Retornaremos em breve.";

    private static final String RATE_LIMIT_MESSAGE =
            "Recebi suas mensagens! Por favor, aguarde enquanto processo. 😊";

    private static final String SYSTEM_PROMPT =
            """
            Você é o assistente virtual do escritório Villa Real e Advogados Associados, localizado em Anápolis-GO. O advogado responsável é Dr. Itamar (OAB/GO 33.329).

            REGRAS QUE VOCÊ DEVE SEGUIR RIGOROSAMENTE:

            1. Você NÃO é advogado e NÃO pode dar parecer jurídico, conselho legal, interpretar leis, artigos, súmulas ou jurisprudência. Nunca diga "no seu caso, o artigo X se aplica" ou qualquer variação.

            2. Sua função é EXCLUSIVAMENTE:
               - Informar sobre andamento de processos (usando APENAS os dados fornecidos abaixo, nunca inventando)
               - Agendar atendimentos presenciais ou por videochamada
               - Responder dúvidas operacionais: horário, endereço, documentos necessários
               - Encaminhar questões jurídicas para o advogado

            3. Se o cliente fizer qualquer pergunta jurídica (sobre direitos, prazos legais, chances de ganhar, o que fazer juridicamente, etc.), responda:
               "Essa é uma questão jurídica que precisa ser analisada pelo Dr. Itamar pessoalmente. Posso agendar um horário para você?"

            4. NUNCA invente informações sobre processos, movimentações, datas de audiência ou qualquer dado que não esteja explicitamente listado abaixo em "PROCESSOS ATIVOS".

            5. Se não tiver informação sobre algo que o cliente perguntou, diga que vai verificar com o escritório e retornar.

            6. Respostas devem ser:
               - Em português brasileiro
               - Cordiais e profissionais, mas sem formalidade excessiva
               - Curtas e objetivas (máximo 3 parágrafos curtos)
               - Adequadas para WhatsApp (sem formatação markdown, sem asteriscos, sem listas longas)

            7. Informações do escritório:
               - Horário: segunda a sexta, 8h às 18h
               - Endereço: Anápolis-GO (o cliente pode perguntar o endereço completo ao escritório)
               - Telefone: o mesmo número desta conversa
               - Para agendar: sugerir que o cliente indique dia e horário de preferência

            8. Se a pessoa não for cliente cadastrado, seja educado, apresente brevemente o escritório e ofereça agendar uma consulta inicial.

            9. Se receber mensagem que não é texto legível (imagem, áudio, documento), responda:
               "Recebi seu arquivo! Vou encaminhar para a equipe analisar. Se preferir, pode descrever sua dúvida por texto que respondo na hora."
            """;

    private final ClaudeApiService claudeApiService;
    private final WhatsAppService whatsAppService;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoAndamentoRepository processoAndamentoRepository;
    private final PessoaContatoRepository pessoaContatoRepository;

    private final ConcurrentHashMap<String, MessageCounter> rateLimits = new ConcurrentHashMap<>();

    public WhatsAppAIService(
            ClaudeApiService claudeApiService,
            WhatsAppService whatsAppService,
            WhatsAppMessageRepository whatsAppMessageRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ProcessoAndamentoRepository processoAndamentoRepository,
            PessoaContatoRepository pessoaContatoRepository) {
        this.claudeApiService = claudeApiService;
        this.whatsAppService = whatsAppService;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.processoAndamentoRepository = processoAndamentoRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
    }

    public void handleIncomingMessage(String phoneNumber, String messageBody, String contactName) {
        try {
            if (!checkRateLimit(phoneNumber)) {
                return;
            }

            ConversationContext context = loadConversationContext(phoneNumber, contactName);
            log.info(
                    "Contexto WhatsApp IA montado para {} — cliente {}",
                    maskPhoneNumber(phoneNumber),
                    context.clienteId() != null ? context.clienteId() : "não identificado");

            String userPrompt = buildUserPrompt(context, messageBody);
            String resposta = callClaude(userPrompt);
            if (!StringUtils.hasText(resposta)) {
                resposta = FALLBACK_EMPTY_CLAUDE;
            }

            log.info("Resposta Claude gerada ({} chars) para {}", resposta.length(), maskPhoneNumber(phoneNumber));
            whatsAppService.sendTextMessage(phoneNumber, resposta.trim());
        } catch (WhatsAppApiException e) {
            log.error("Falha ao enviar resposta WhatsApp para {}: {}", maskPhoneNumber(phoneNumber), e.getMessage(), e);
        } catch (Exception e) {
            log.error(
                    "Erro ao processar mensagem WhatsApp com IA para {}: {}",
                    maskPhoneNumber(phoneNumber),
                    e.getMessage(),
                    e);
            sendFallbackSafely(phoneNumber, FALLBACK_ERROR);
        }
    }

    @Transactional(readOnly = true)
    ConversationContext loadConversationContext(String phoneNumber, String contactName) {
        Optional<ClienteEntity> clienteOpt = findClienteByPhone(phoneNumber);
        String clienteInfo;
        String processosInfo;
        Long clienteId = null;

        if (clienteOpt.isPresent()) {
            ClienteEntity cliente = clienteOpt.get();
            clienteId = cliente.getId();
            clienteInfo = formatClienteInfo(cliente, contactName, phoneNumber);
            processosInfo = formatProcessosInfo(clienteId);
        } else {
            clienteInfo = "Cliente não identificado no sistema. Telefone: " + phoneNumber
                    + (StringUtils.hasText(contactName) ? " (contato: " + contactName + ")" : "");
            processosInfo = "Nenhum processo vinculado (cliente não cadastrado)";
        }

        String historico = formatHistorico(phoneNumber);
        return new ConversationContext(clienteId, clienteInfo, processosInfo, historico);
    }

    private boolean checkRateLimit(String phoneNumber) {
        Instant now = Instant.now();
        MessageCounter counter = rateLimits.compute(phoneNumber, (key, existing) -> {
            if (existing == null || ChronoUnit.SECONDS.between(existing.windowStart(), now) > RATE_LIMIT_WINDOW_SECONDS) {
                return new MessageCounter(new AtomicInteger(1), now);
            }
            existing.count().incrementAndGet();
            return existing;
        });

        int current = counter.count().get();
        if (current > RATE_LIMIT_MAX) {
            log.warn("Rate limit atingido para {}", maskPhoneNumber(phoneNumber));
            if (current == RATE_LIMIT_MAX + 1) {
                sendFallbackSafely(phoneNumber, RATE_LIMIT_MESSAGE);
            }
            return false;
        }
        return true;
    }

    private String callClaude(String userPrompt) {
        log.debug("Chamando Claude API para resposta WhatsApp");
        try {
            return claudeApiService.enviarMensagem(SYSTEM_PROMPT, userPrompt, CLAUDE_MAX_TOKENS, CLAUDE_TEMPERATURE);
        } catch (BusinessRuleException e) {
            log.error("Erro na Claude API: {}", e.getMessage());
            return null;
        }
    }

    private String buildUserPrompt(ConversationContext context, String messageBody) {
        return """
                DADOS DO CLIENTE:
                %s

                PROCESSOS ATIVOS:
                %s

                HISTÓRICO DA CONVERSA (últimas 24h):
                %s

                MENSAGEM ATUAL DO CLIENTE:
                %s
                """
                .formatted(context.clienteInfo(), context.processosInfo(), context.historico(), messageBody);
    }

    private Optional<ClienteEntity> findClienteByPhone(String phoneFrom) {
        if (!StringUtils.hasText(phoneFrom)) {
            return Optional.empty();
        }

        String digits = phoneFrom.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return Optional.empty();
        }

        return pessoaContatoRepository
                .findPessoaIdByTelefoneNormalizado(digits)
                .flatMap(pessoaId -> clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId).stream()
                        .findFirst());
    }

    private String formatClienteInfo(ClienteEntity cliente, String contactName, String phoneNumber) {
        PessoaEntity pessoa = cliente.getPessoa();
        StringBuilder sb = new StringBuilder();
        sb.append("Nome: ")
                .append(pessoa != null && StringUtils.hasText(pessoa.getNome()) ? pessoa.getNome() : "—");
        if (StringUtils.hasText(contactName)) {
            sb.append(" (WhatsApp: ").append(contactName).append(")");
        }
        sb.append("\nCódigo cliente: ").append(cliente.getCodigoCliente());
        if (pessoa != null) {
            if (StringUtils.hasText(pessoa.getEmail())) {
                sb.append("\nEmail: ").append(pessoa.getEmail());
            }
            if (StringUtils.hasText(pessoa.getTelefone())) {
                sb.append("\nTelefone cadastro: ").append(pessoa.getTelefone());
            }
        }
        sb.append("\nTelefone conversa: ").append(phoneNumber);
        return sb.toString();
    }

    private String formatProcessosInfo(Long clienteId) {
        List<ProcessoEntity> processos = processoRepository
                .findByCliente_Id(clienteId, PageRequest.of(0, 30))
                .getContent()
                .stream()
                .filter(p -> Boolean.TRUE.equals(p.getAtivo()))
                .limit(15)
                .toList();

        if (processos.isEmpty()) {
            return "Nenhum processo ativo encontrado para este cliente.";
        }

        List<String> linhas = new ArrayList<>();
        for (ProcessoEntity processo : processos) {
            String ultimoAndamento = processoAndamentoRepository
                    .findByProcesso_IdOrderByMovimentoEmDescIdDesc(processo.getId())
                    .stream()
                    .findFirst()
                    .map(this::formatAndamento)
                    .orElse("sem andamento registrado");

            linhas.add(String.format(
                    "- Nº interno %s | CNJ: %s | Área: %s | Fase: %s | Último andamento: %s",
                    processo.getNumeroInterno() != null ? processo.getNumeroInterno() : "—",
                    StringUtils.hasText(processo.getNumeroCnj()) ? processo.getNumeroCnj() : "—",
                    StringUtils.hasText(processo.getNaturezaAcao()) ? processo.getNaturezaAcao() : "—",
                    StringUtils.hasText(processo.getFase()) ? processo.getFase() : "—",
                    ultimoAndamento));
        }
        return String.join("\n", linhas);
    }

    private String formatAndamento(ProcessoAndamentoEntity andamento) {
        String hora = andamento.getMovimentoEm() != null
                ? andamento.getMovimentoEm().atZone(ZONE_BRASILIA).format(HORA_FORMAT)
                : "—";
        String titulo = StringUtils.hasText(andamento.getTitulo()) ? andamento.getTitulo() : "Movimentação";
        return titulo + " (" + hora + ")";
    }

    private String formatHistorico(String phoneNumber) {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        List<WhatsAppMessageEntity> messages =
                whatsAppMessageRepository.findByPhoneNumberAndCreatedAtAfterOrderByCreatedAtAsc(phoneNumber, since);

        if (messages.isEmpty()) {
            return "Primeira mensagem da conversa";
        }

        List<WhatsAppMessageEntity> recent = messages.size() > MAX_HISTORY_MESSAGES
                ? messages.subList(messages.size() - MAX_HISTORY_MESSAGES, messages.size())
                : messages;

        List<String> linhas = new ArrayList<>();
        for (WhatsAppMessageEntity msg : recent) {
            if (!StringUtils.hasText(msg.getContent())) {
                continue;
            }
            String prefix = msg.getDirection() == WhatsAppMessageDirection.INBOUND ? "[CLIENTE]" : "[ASSISTENTE]";
            String hora = msg.getCreatedAt() != null
                    ? msg.getCreatedAt().atZone(ZONE_BRASILIA).format(HORA_FORMAT)
                    : "--:--";
            linhas.add(prefix + " " + hora + ": " + msg.getContent());
        }

        return linhas.isEmpty() ? "Primeira mensagem da conversa" : String.join("\n", linhas);
    }

    private void sendFallbackSafely(String phoneNumber, String message) {
        try {
            whatsAppService.sendTextMessage(phoneNumber, message);
        } catch (Exception ex) {
            log.error(
                    "Falha ao enviar mensagem de fallback para {}: {}",
                    maskPhoneNumber(phoneNumber),
                    ex.getMessage());
        }
    }

    private static String maskPhoneNumber(String phone) {
        if (!StringUtils.hasText(phone) || phone.length() < 8) {
            return "****";
        }
        return phone.substring(0, 5) + "****" + phone.substring(phone.length() - 4);
    }

    private record MessageCounter(AtomicInteger count, Instant windowStart) {}

    record ConversationContext(Long clienteId, String clienteInfo, String processosInfo, String historico) {}
}
