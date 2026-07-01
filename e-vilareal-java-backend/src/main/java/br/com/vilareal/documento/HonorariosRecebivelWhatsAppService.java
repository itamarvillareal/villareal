package br.com.vilareal.documento;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.ScheduledWhatsAppMessageRepository;
import br.com.vilareal.whatsapp.service.WhatsAppSchedulerService;
import br.com.vilareal.whatsapp.service.WhatsAppService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Agenda lembretes WhatsApp no vencimento de parcelas de honorários (contrato por processo).
 * Horário sempre interpretado em {@link #ZONE_BRASILIA}.
 */
@Service
public class HonorariosRecebivelWhatsAppService {

    private static final Logger log = LoggerFactory.getLogger(HonorariosRecebivelWhatsAppService.class);
    static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final String TEMPLATE = "atualizacao_processo";
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat MOEDA_BR = NumberFormat.getNumberInstance(new Locale("pt", "BR"));

    private final ContratoHonorariosRepository contratoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final PessoaRepository pessoaRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final WhatsAppSchedulerService whatsAppSchedulerService;
    private final ScheduledWhatsAppMessageRepository scheduledRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public HonorariosRecebivelWhatsAppService(
            ContratoHonorariosRepository contratoRepository,
            PagamentoRepository pagamentoRepository,
            PessoaRepository pessoaRepository,
            PessoaContatoRepository pessoaContatoRepository,
            WhatsAppSchedulerService whatsAppSchedulerService,
            ScheduledWhatsAppMessageRepository scheduledRepository,
            ObjectMapper objectMapper,
            Clock clock) {
        this.contratoRepository = contratoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.pessoaRepository = pessoaRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.whatsAppSchedulerService = whatsAppSchedulerService;
        this.scheduledRepository = scheduledRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional
    public void processarLembretesVencimento() {
        LocalDate hoje = LocalDate.now(clock.withZone(ZONE_BRASILIA));
        LocalTime agora = LocalTime.now(clock.withZone(ZONE_BRASILIA));

        List<ContratoHonorariosEntity> contratos = contratoRepository.findComWhatsappCobrancaAtiva();
        int agendados = 0;
        for (ContratoHonorariosEntity contrato : contratos) {
            LocalTime horario = parseHorario(contrato.getWhatsappCobrancaHorario());
            if (agora.isBefore(horario)) {
                continue;
            }
            if (agora.isAfter(horario.plusMinutes(45))) {
                continue;
            }
            ProcessoEntity processo = contrato.getProcesso();
            if (processo == null || processo.getId() == null) {
                continue;
            }
            HonorariosWhatsAppAntecedencia antecedencia =
                    HonorariosWhatsAppAntecedencia.parse(contrato.getWhatsappCobrancaAntecedencia());
            LocalDate vencimentoAlvo = hoje.plusDays(antecedencia.diasAntesDoVencimento());

            List<PagamentoEntity> pagamentos =
                    pagamentoRepository.findReceberHonorariosAbertosPorProcessoEVencimento(
                            processo.getId(), vencimentoAlvo);
            if (pagamentos.isEmpty()) {
                continue;
            }

            List<String> telefones = resolverTelefones(contrato);
            if (telefones.isEmpty()) {
                log.warn(
                        "Honorários WhatsApp: processo {} sem telefone (pessoa {} extras).",
                        processo.getId(),
                        contrato.getPessoa() != null ? contrato.getPessoa().getId() : null);
                continue;
            }

            String nomeCliente = primeiroNome(contrato.getPessoa());
            String rotuloProc = rotuloProcesso(processo);
            Long clienteId = processo.getCliente() != null ? processo.getCliente().getId() : null;

            for (PagamentoEntity pag : pagamentos) {
                if (scheduledRepository.existsByPagamentoIdAndTemplateNameAndStatusIn(
                        pag.getId(),
                        TEMPLATE,
                        List.of(ScheduledMessageStatus.PENDING, ScheduledMessageStatus.SENT))) {
                    continue;
                }
                String texto = montarTextoVencimento(pag, vencimentoAlvo);
                List<String> params = List.of(nomeCliente, rotuloProc, texto);
                Instant scheduledAt = Instant.now(clock).plusSeconds(3);
                for (String tel : telefones) {
                    whatsAppSchedulerService.agendarMensagem(
                            tel,
                            TEMPLATE,
                            params,
                            scheduledAt,
                            clienteId,
                            processo.getId(),
                            pag.getId(),
                            "sistema",
                            "Honorários vencimento — pagamento " + pag.getId());
                    agendados++;
                }
            }
        }
        if (agendados > 0) {
            log.info("Honorários WhatsApp: {} mensagem(ns) enfileirada(s) em {}", agendados, agora);
        }
    }

    static LocalTime parseHorario(String raw) {
        if (!StringUtils.hasText(raw)) {
            return LocalTime.of(9, 0);
        }
        try {
            String[] p = raw.trim().split(":");
            int h = Integer.parseInt(p[0]);
            int m = p.length > 1 ? Integer.parseInt(p[1]) : 0;
            return LocalTime.of(h, m);
        } catch (Exception e) {
            return LocalTime.of(9, 0);
        }
    }

    List<String> resolverTelefones(ContratoHonorariosEntity contrato) {
        Set<String> out = new LinkedHashSet<>();
        PessoaEntity pessoa = contrato.getPessoa();
        if (pessoa != null) {
            List<PessoaContatoEntity> contatos =
                    pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId());
            for (PessoaContatoEntity c : contatos) {
                if (c.getTipo() != null && "telefone".equalsIgnoreCase(c.getTipo().trim())) {
                    adicionarTelefone(out, c.getValor());
                }
            }
            pessoaRepository.findTelefoneById(pessoa.getId()).ifPresent(t -> adicionarTelefone(out, t));
        }
        for (String extra : parseTelefonesExtras(contrato.getWhatsappCobrancaTelefonesExtras())) {
            adicionarTelefone(out, extra);
        }
        return new ArrayList<>(out);
    }

    private List<String> parseTelefonesExtras(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            List<String> list = objectMapper.readValue(json, new TypeReference<>() {});
            return list != null ? list : List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    private static void adicionarTelefone(Set<String> destino, String raw) {
        if (!StringUtils.hasText(raw)) {
            return;
        }
        try {
            destino.add(WhatsAppService.formatPhoneNumber(raw.trim()));
        } catch (IllegalArgumentException ignored) {
            // ignora
        }
    }

    private static String montarTextoVencimento(PagamentoEntity pag, LocalDate vencimento) {
        String data = vencimento.format(DATA_BR);
        String valor = formatMoeda(pag.getValor());
        String parcela = extrairParcela(pag.getDescricao());
        if (parcela != null) {
            return String.format(
                    Locale.forLanguageTag("pt-BR"),
                    "Vence %s a parcela %s dos honorários advocatícios, no valor de R$ %s.",
                    data,
                    parcela,
                    valor);
        }
        return String.format(
                Locale.forLanguageTag("pt-BR"),
                "Vence %s o honorário advocatício, no valor de R$ %s.",
                data,
                valor);
    }

    private static String extrairParcela(String descricao) {
        if (!StringUtils.hasText(descricao)) {
            return null;
        }
        int idx = descricao.indexOf("parcela ");
        if (idx < 0) {
            return null;
        }
        String rest = descricao.substring(idx + "parcela ".length()).trim();
        int end = rest.indexOf(' ');
        if (end > 0) {
            return rest.substring(0, end);
        }
        return rest.length() <= 12 ? rest : null;
    }

    private static String formatMoeda(BigDecimal valor) {
        if (valor == null) {
            return "0,00";
        }
        synchronized (MOEDA_BR) {
            MOEDA_BR.setMinimumFractionDigits(2);
            MOEDA_BR.setMaximumFractionDigits(2);
            return MOEDA_BR.format(valor);
        }
    }

    private static String primeiroNome(PessoaEntity pessoa) {
        if (pessoa == null || !StringUtils.hasText(pessoa.getNome())) {
            return "Cliente";
        }
        String n = pessoa.getNome().trim().split("\\s+")[0];
        return n.isEmpty() ? "Cliente" : n;
    }

    private static String rotuloProcesso(ProcessoEntity processo) {
        if (processo.getNumeroInterno() != null) {
            return "Proc. " + String.format("%02d", processo.getNumeroInterno());
        }
        if (StringUtils.hasText(processo.getNumeroCnj())) {
            return processo.getNumeroCnj().trim();
        }
        return "Processo " + processo.getId();
    }
}
