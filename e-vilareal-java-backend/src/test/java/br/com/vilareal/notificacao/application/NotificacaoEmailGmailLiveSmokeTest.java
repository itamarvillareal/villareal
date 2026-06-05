package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.email.GmailApiProvider;
import com.google.api.services.gmail.Gmail;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Smoke ao vivo: envia um e-mail real via Gmail API (requer credentials.json + tokens locais).
 * Não roda em CI sem OAuth — assume Gmail configurado como em dev.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "vilareal.smoke.gmail", matches = "true")
class NotificacaoEmailGmailLiveSmokeTest {

    @Autowired
    private NotificacaoEmailService notificacaoEmailService;

    @Autowired
    private NotificacaoMovimentacaoEmailRenderer emailRenderer;

    @Autowired
    private GmailApiProvider gmailApiProvider;

    @Value("${gmail.user:me}")
    private String gmailUser;

    @Test
    void enviaEmailMonitoramentoReal_paraDestinatarioPadrao() throws Exception {
        Assumptions.assumeTrue(
                notificacaoEmailService.isDisponivel(),
                "Gmail API indisponível (credentials/tokens)");

        Gmail gmail = gmailApiProvider.resolver().orElseThrow();
        String remetente =
                gmail.users().getProfile(gmailUser).execute().getEmailAddress();

        String numeroCnj = "5059346-36.2026.8.09.0007";
        String nomeCliente = "Smoke Monitor";
        MovimentacaoMonitoradaEntity m = new MovimentacaoMonitoradaEntity();
        m.setNumero(36);
        m.setLegenda("Processo Arquivado");
        m.setDataMovimentacao(LocalDateTime.of(2026, 6, 4, 10, 0));

        String assunto = emailRenderer.montarAssunto(numeroCnj, nomeCliente);
        String corpo = emailRenderer.renderCorpoHtml(numeroCnj, nomeCliente, List.of(m));

        notificacaoEmailService.enviar(List.of("itamarvillareal@gmail.com"), assunto, corpo);

        System.out.println("SMOKE_EMAIL_OK remetente=" + remetente + " assunto=" + assunto);
    }
}
