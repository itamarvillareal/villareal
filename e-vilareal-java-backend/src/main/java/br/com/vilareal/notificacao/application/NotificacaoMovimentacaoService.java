package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.notificacao.api.dto.NotificacaoResultado;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.whatsapp.service.WhatsAppSchedulerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Disparo de notificações ao detectar novidade no monitor PROJUDI.
 * E-mail síncrono (resultado gravado na execução); WhatsApp assíncrono.
 */
@Service
public class NotificacaoMovimentacaoService {

    private static final Logger log = LoggerFactory.getLogger(NotificacaoMovimentacaoService.class);

    private final NotificacaoDestinatarioService notificacaoDestinatarioService;
    private final WhatsAppSchedulerService whatsAppSchedulerService;
    private final NotificacaoMovimentacaoEmailRenderer emailRenderer;
    private final NotificacaoEmailService notificacaoEmailService;

    public NotificacaoMovimentacaoService(
            NotificacaoDestinatarioService notificacaoDestinatarioService,
            WhatsAppSchedulerService whatsAppSchedulerService,
            NotificacaoMovimentacaoEmailRenderer emailRenderer,
            NotificacaoEmailService notificacaoEmailService) {
        this.notificacaoDestinatarioService = notificacaoDestinatarioService;
        this.whatsAppSchedulerService = whatsAppSchedulerService;
        this.emailRenderer = emailRenderer;
        this.notificacaoEmailService = notificacaoEmailService;
    }

    /**
     * Envia e-mail de novidade de forma síncrona e enfileira WhatsApp em virtual thread.
     * Nunca lança — retorna {@link NotificacaoResultado} do e-mail.
     */
    public NotificacaoResultado notificarNovidade(ProcessoEntity processo, List<MovimentacaoMonitoradaEntity> novas) {
        try {
            if (novas == null || novas.isEmpty() || processo == null || processo.getId() == null) {
                return NotificacaoResultado.naoAplicavel();
            }

            Long processoId = processo.getId();
            Long clienteId = processo.getCliente() != null ? processo.getCliente().getId() : null;
            String numeroCnj = StringUtils.hasText(processo.getNumeroCnj()) ? processo.getNumeroCnj().trim() : "—";
            String nomeCliente = resolverNomeCliente(processo);
            String resumo = NotificacaoMovimentacaoResumoBuilder.montarResumo(novas);
            String descricao = "Monitor PROJUDI — " + numeroCnj;
            List<MovimentacaoMonitoradaEntity> copiaNovas = List.copyOf(novas);

            NotificacaoResultado resultadoEmail =
                    enviarEmailNovidade(processoId, numeroCnj, nomeCliente, copiaNovas);

            Thread.startVirtualThread(() -> {
                try {
                    dispararWhatsapp(processoId, clienteId, numeroCnj, nomeCliente, resumo, descricao);
                } catch (Exception e) {
                    log.warn(
                            "Falha ao disparar WhatsApp de novidade (processo {}): {}",
                            processoId,
                            e.getMessage());
                }
            });

            return resultadoEmail;
        } catch (Exception e) {
            log.warn(
                    "Falha ao notificar novidade (processo {}): {}",
                    processo != null ? processo.getId() : null,
                    e.getMessage());
            return NotificacaoResultado.falha(null, resumirErro(e));
        }
    }

    NotificacaoResultado enviarEmailNovidade(
            Long processoId,
            String numeroCnj,
            String nomeCliente,
            List<MovimentacaoMonitoradaEntity> novas) {
        DestinatariosCanaisDto destinatarios = notificacaoDestinatarioService.resolver(processoId);
        List<String> emails = destinatarios.email();
        if (emails.isEmpty()) {
            log.info("sem destinatários e-mail configurados para processo {} (notificação de novidade)", processoId);
            return NotificacaoResultado.semDestinatario();
        }

        String destinatariosCsv = emails.stream().collect(Collectors.joining(", "));
        try {
            String assunto = emailRenderer.montarAssunto(numeroCnj, nomeCliente);
            String corpoHtml = emailRenderer.renderCorpoHtml(numeroCnj, nomeCliente, novas);
            notificacaoEmailService.enviar(emails, assunto, corpoHtml);
            return NotificacaoResultado.enviado(destinatariosCsv);
        } catch (Exception e) {
            log.warn(
                    "Falha ao enviar e-mail de novidade (processo {}): {}",
                    processoId,
                    e.getMessage());
            return NotificacaoResultado.falha(destinatariosCsv, resumirErro(e));
        }
    }

    void dispararWhatsapp(
            Long processoId,
            Long clienteId,
            String numeroCnj,
            String nomeCliente,
            String resumo,
            String descricao) {
        DestinatariosCanaisDto destinatarios = notificacaoDestinatarioService.resolver(processoId);
        List<String> whatsapp = destinatarios.whatsapp();
        if (whatsapp.isEmpty()) {
            log.info(
                    "sem destinatários WhatsApp configurados para processo {} (notificação de novidade)",
                    processoId);
            return;
        }

        List<String> params = List.of(nomeCliente, numeroCnj, resumo);
        for (String telefone : whatsapp) {
            try {
                whatsAppSchedulerService.enfileirarAtualizacaoProcesso(
                        telefone, params, clienteId, processoId, descricao);
                log.info(
                        "WhatsApp atualizacao_processo enfileirado para {} (processo {})",
                        maskTelefone(telefone),
                        processoId);
            } catch (Exception e) {
                log.warn(
                        "Falha ao enfileirar WhatsApp para {} (processo {}): {}",
                        maskTelefone(telefone),
                        processoId,
                        e.getMessage());
            }
        }
    }

    static String resolverNomeCliente(ProcessoEntity processo) {
        ClienteEntity cliente = processo.getCliente();
        if (cliente == null) {
            return "Cliente";
        }
        if (StringUtils.hasText(cliente.getNomeReferencia())) {
            return cliente.getNomeReferencia().trim();
        }
        PessoaEntity pessoa = cliente.getPessoa();
        if (pessoa != null && StringUtils.hasText(pessoa.getNome())) {
            return pessoa.getNome().trim();
        }
        return "Cliente";
    }

    private static String resumirErro(Exception e) {
        String msg = e.getMessage();
        if (StringUtils.hasText(msg)) {
            return msg.trim();
        }
        return e.getClass().getSimpleName();
    }

    private static String maskTelefone(String telefone) {
        if (!StringUtils.hasText(telefone) || telefone.length() < 8) {
            return "****";
        }
        String digits = telefone.replaceAll("\\D", "");
        if (digits.length() < 8) {
            return "****";
        }
        return digits.substring(0, Math.min(5, digits.length())) + "****"
                + digits.substring(digits.length() - 4);
    }
}
