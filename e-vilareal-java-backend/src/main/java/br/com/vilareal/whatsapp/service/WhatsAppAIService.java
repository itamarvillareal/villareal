package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.util.CpfUtil;
import br.com.vilareal.documento.ClaudeApiService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
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
 * Assistente WhatsApp com Claude — monta contexto do cliente/processos/financeiro e responde automaticamente.
 */
@Service
public class WhatsAppAIService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppAIService.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter HORA_FORMAT = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_HISTORY_MESSAGES = 20;
    private static final int RATE_LIMIT_MAX = 10;
    private static final long RATE_LIMIT_WINDOW_SECONDS = 60L;
    private static final int CLAUDE_MAX_TOKENS = 800;
    private static final double CLAUDE_TEMPERATURE = 0.3;
    private static final String USUARIO_CONTATO_WHATSAPP = "whatsapp-ia";

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

            REGRAS FUNDAMENTAIS:
            1. Você NÃO é advogado. NUNCA dê parecer jurídico, conselho legal, ou interprete leis.
            2. Se o cliente fizer pergunta jurídica, responda: "Essa é uma questão jurídica que precisa ser analisada pelo Dr. Itamar pessoalmente. Posso agendar um horário para você?"
            3. NUNCA invente informações. Use APENAS os dados fornecidos no contexto.
            4. Respostas curtas e objetivas (máximo 3 parágrafos). Formatação para WhatsApp (sem markdown).
            5. Horário: segunda a sexta, 8h às 18h. Endereço: Anápolis-GO.

            CAPACIDADES — O QUE VOCÊ PODE FAZER:

            A) INFORMAR ANDAMENTO DE PROCESSOS
               - Informar dados dos processos listados em "PROCESSOS ATIVOS"
               - Se o cliente perguntar sobre um processo que não está listado, diga que vai verificar com o escritório

            B) CONSULTA DE DÉBITOS E PAGAMENTOS
               - Quando o cliente mencionar "pagar", "pagamento", "boleto", "dívida", "débito", "parcela", "honorário", "quanto devo", "segunda via":
               - Se o cliente está identificado: informar a situação financeira listada em "SITUAÇÃO FINANCEIRA"
               - Apresentar cada parcela pendente/vencida com valor e vencimento
               - Informar o total pendente
               - Se houver parcelas vencidas, informar há quantos dias estão vencidas
               - Para segunda via de boleto ou forma de pagamento: diga que vai solicitar ao setor financeiro e retornará em breve, ou que o cliente pode ligar para o escritório
               - NUNCA calcule juros, multas ou correção monetária — informe apenas os valores que estão nos dados
               - NUNCA negocie valores, descontos ou prazos — encaminhe para o escritório

            C) IDENTIFICAÇÃO DO CLIENTE
               - Se o cliente NÃO está identificado no sistema, pergunte educadamente o nome completo e o CPF
               - Se o cliente informou CPF e foi identificado (os dados aparecerão no contexto), confirme: "Encontrei seu cadastro, {nome}! Como posso ajudar?"
               - Se o CPF informado não foi encontrado, diga: "Não encontrei cadastro com esse CPF. Pode confirmar? Se preferir, entre em contato pelo telefone do escritório."

            D) AGENDAMENTO DE ATENDIMENTOS
               - Pergunte a preferência de dia e horário
               - Diga que vai confirmar a disponibilidade com o escritório

            E) DÚVIDAS OPERACIONAIS
               - Horário, endereço, documentos necessários, formas de contato

            EXEMPLOS DE RESPOSTAS:

            Cliente: "quero pagar"
            → Se identificado com débitos: informe parcelas pendentes com valores e vencimentos, total pendente, e ofereça solicitar segunda via ao financeiro
            → Se identificado sem débitos: informe que não constam parcelas pendentes
            → Se não identificado: peça nome completo e CPF

            Cliente: "quanto eu devo?"
            → Mesmo fluxo de débitos

            Cliente: "preciso de segunda via do boleto"
            → Se identificado: mostrar parcelas pendentes e dizer que vai solicitar ao financeiro

            Cliente: "quero agendar uma consulta"
            → "Claro! Qual dia e horário seria melhor para você? Nosso horário de atendimento é de segunda a sexta, 8h às 18h."

            Se a pessoa não for cliente cadastrado e não informar CPF, apresente o escritório e ofereça agendar consulta inicial.

            Se receber mensagem que não é texto legível (imagem, áudio, documento), responda:
            "Recebi seu arquivo! Vou encaminhar para a equipe analisar. Se preferir, pode descrever sua dúvida por texto que respondo na hora."
            """;

    private final ClaudeApiService claudeApiService;
    private final WhatsAppService whatsAppService;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final ClienteRepository clienteRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoAndamentoRepository processoAndamentoRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final WhatsAppFinanceiroContextService financeiroContextService;

    private final ConcurrentHashMap<String, MessageCounter> rateLimits = new ConcurrentHashMap<>();

    public WhatsAppAIService(
            ClaudeApiService claudeApiService,
            WhatsAppService whatsAppService,
            WhatsAppMessageRepository whatsAppMessageRepository,
            ClienteRepository clienteRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ProcessoAndamentoRepository processoAndamentoRepository,
            PessoaContatoRepository pessoaContatoRepository,
            WhatsAppFinanceiroContextService financeiroContextService) {
        this.claudeApiService = claudeApiService;
        this.whatsAppService = whatsAppService;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.clienteRepository = clienteRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.processoAndamentoRepository = processoAndamentoRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.financeiroContextService = financeiroContextService;
    }

    public void handleIncomingMessage(String phoneNumber, String messageBody, String contactName) {
        try {
            if (!checkRateLimit(phoneNumber)) {
                return;
            }

            ConversationContext context = loadConversationContext(phoneNumber, contactName, messageBody);
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

    @Transactional
    ConversationContext loadConversationContext(String phoneNumber, String contactName, String messageBody) {
        Optional<ClienteEntity> clienteOpt = findClienteByPhone(phoneNumber);
        boolean identificadoPorCpf = false;

        if (clienteOpt.isEmpty() && StringUtils.hasText(messageBody)) {
            String cpf = CpfUtil.extrairCpfValido(messageBody);
            if (cpf != null) {
                log.info("CPF detectado na mensagem WhatsApp de {} — buscando cadastro", maskPhoneNumber(phoneNumber));
                clienteOpt = buscarClientePorCpf(cpf);
                if (clienteOpt.isPresent()) {
                    identificadoPorCpf = true;
                    vincularTelefoneAPessoa(clienteOpt.get().getPessoa().getId(), phoneNumber);
                    log.info(
                            "Cliente {} identificado por CPF via WhatsApp",
                            clienteOpt.get().getId());
                } else {
                    log.info("CPF informado via WhatsApp não encontrado no cadastro");
                }
            }
        }

        String clienteInfo;
        String processosInfo;
        Long clienteId = null;

        if (clienteOpt.isPresent()) {
            ClienteEntity cliente = clienteOpt.get();
            clienteId = cliente.getId();
            clienteInfo = formatClienteInfo(cliente, contactName, phoneNumber, identificadoPorCpf);
            processosInfo = formatProcessosInfo(clienteId);
        } else {
            clienteInfo = "Cliente não identificado no sistema. Telefone: " + phoneNumber
                    + (StringUtils.hasText(contactName) ? " (contato: " + contactName + ")" : "")
                    + "\nSolicite nome completo e CPF se necessário.";
            processosInfo = "Nenhum processo vinculado (cliente não cadastrado)";
        }

        String contextoFinanceiro = financeiroContextService.montarContextoFinanceiro(clienteId);
        String historico = formatHistorico(phoneNumber);
        return new ConversationContext(clienteId, clienteInfo, processosInfo, contextoFinanceiro, historico);
    }

    private Optional<ClienteEntity> buscarClientePorCpf(String cpf) {
        return pessoaRepository.findByCpf(cpf).flatMap(pessoa -> clienteRepository
                .findByPessoa_IdOrderByCodigoClienteAsc(pessoa.getId())
                .stream()
                .findFirst());
    }

    private void vincularTelefoneAPessoa(Long pessoaId, String phoneFrom) {
        if (pessoaId == null || !StringUtils.hasText(phoneFrom)) {
            return;
        }
        String digits = phoneFrom.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return;
        }

        Optional<Long> pessoaExistente = pessoaContatoRepository.findPessoaIdByTelefoneNormalizado(digits);
        if (pessoaExistente.isPresent()) {
            if (!pessoaExistente.get().equals(pessoaId)) {
                log.warn(
                        "Telefone {} já vinculado a outra pessoa (pessoaId={}) — não alterar",
                        maskPhoneNumber(phoneFrom),
                        pessoaExistente.get());
            }
            return;
        }

        List<PessoaContatoEntity> contatos = pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoaId);
        boolean jaCadastrado = contatos.stream()
                .anyMatch(c -> "telefone".equalsIgnoreCase(c.getTipo())
                        && telefonesEquivalentes(c.getValor(), digits));
        if (jaCadastrado) {
            return;
        }

        PessoaEntity pessoa = pessoaRepository.getReferenceById(pessoaId);
        Instant now = Instant.now();
        PessoaContatoEntity contato = new PessoaContatoEntity();
        contato.setPessoa(pessoa);
        contato.setTipo("telefone");
        contato.setValor(digits);
        contato.setDataLancamento(now);
        contato.setDataAlteracao(now);
        contato.setUsuarioLancamento(USUARIO_CONTATO_WHATSAPP);
        pessoaContatoRepository.save(contato);
        log.info("Telefone {} vinculado à pessoa {} via WhatsApp IA", maskPhoneNumber(phoneFrom), pessoaId);
    }

    private static boolean telefonesEquivalentes(String valorCadastro, String digitsConversa) {
        if (!StringUtils.hasText(valorCadastro)) {
            return false;
        }
        String cad = valorCadastro.replaceAll("\\D", "");
        if (cad.equals(digitsConversa)) {
            return true;
        }
        if (cad.length() >= 10 && digitsConversa.length() >= 10) {
            return cad.endsWith(digitsConversa.substring(digitsConversa.length() - 10))
                    || digitsConversa.endsWith(cad.substring(cad.length() - 10));
        }
        return false;
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

                SITUAÇÃO FINANCEIRA:
                %s

                HISTÓRICO DA CONVERSA (últimas 24h):
                %s

                MENSAGEM ATUAL DO CLIENTE:
                %s
                """
                .formatted(
                        context.clienteInfo(),
                        context.processosInfo(),
                        context.contextoFinanceiro(),
                        context.historico(),
                        messageBody);
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

    private String formatClienteInfo(
            ClienteEntity cliente, String contactName, String phoneNumber, boolean identificadoPorCpf) {
        PessoaEntity pessoa = cliente.getPessoa();
        StringBuilder sb = new StringBuilder();
        sb.append("Nome: ")
                .append(pessoa != null && StringUtils.hasText(pessoa.getNome()) ? pessoa.getNome() : "—");
        if (StringUtils.hasText(contactName)) {
            sb.append(" (WhatsApp: ").append(contactName).append(")");
        }
        if (identificadoPorCpf) {
            sb.append("\nIdentificado nesta mensagem via CPF informado pelo cliente");
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

    record ConversationContext(
            Long clienteId,
            String clienteInfo,
            String processosInfo,
            String contextoFinanceiro,
            String historico) {}
}
