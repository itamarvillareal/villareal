package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeTrt18Properties;
import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.robot.RobotAutoFreio;
import br.com.vilareal.robot.RobotGlobalLock;
import br.com.vilareal.robot.RobotLoteContext;
import br.com.vilareal.totp.application.CredencialTotpService;
import br.com.vilareal.totp.application.SegundoFatorCodigoResolver;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PjeLoginOrchestratorTest {

    @Mock
    private PjeBrowserDriver browserDriver;

    @Mock
    private SegundoFatorCodigoResolver segundoFatorCodigoResolver;

    @Mock
    private CredencialTotpService credencialTotpService;

    private PjeTrt18Properties properties;
    private RobotGlobalLock globalLock;
    private RobotAutoFreio autoFreio;
    private RobotLoteContext loteContext;
    private PjeLoginOrchestrator orchestrator;

    @BeforeEach
    void setUp() {
        properties = new PjeTrt18Properties();
        globalLock = new RobotGlobalLock();
        autoFreio = new RobotAutoFreio();
        loteContext = new RobotLoteContext();
        orchestrator = new PjeLoginOrchestrator(
                browserDriver,
                properties,
                segundoFatorCodigoResolver,
                credencialTotpService,
                globalLock,
                autoFreio,
                loteContext);
    }

    @Test
    void loginComTotpInjetaCodigoNoDriver() {
        when(browserDriver.telaOtpVisivel()).thenReturn(true);
        when(segundoFatorCodigoResolver.obterCodigoTotpSeAplicavel(
                        eq(TribunalIntegracao.PJE_TRT18), eq("12345678901")))
                .thenReturn(Optional.of("654321"));
        when(browserDriver.estadoAtual())
                .thenReturn(PjeBrowserSessionState.AUTENTICADO);

        Optional<PjeLoginResult> resultado =
                orchestrator.executarLogin(PjeGrau.PRIMEIRO_GRAU, "12345678901", "senha-secreta");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().sucesso()).isTrue();
        assertThat(resultado.get().estadoFinal()).isEqualTo(PjeBrowserSessionState.AUTENTICADO);

        verify(browserDriver).abrir(eq(PjeGrau.PRIMEIRO_GRAU), eq(properties.getUrlPrimeiroGrau()));
        verify(browserDriver).preencherCredenciais("12345678901", "senha-secreta");
        verify(browserDriver).submeterLogin();
        verify(browserDriver).preencherCodigoOtp("654321");
        verify(browserDriver).submeterOtp();
        verify(browserDriver).fechar();
        verify(credencialTotpService, never()).obterSenhaPrimeiroFator(any(), any());
    }

    @Test
    void semSenhaNoBodyUsaCofre() {
        when(credencialTotpService.obterSenhaPrimeiroFator(TribunalIntegracao.PJE_TRT18, "12345678901"))
                .thenReturn(Optional.of("senha-do-cofre"));
        when(browserDriver.telaOtpVisivel()).thenReturn(false);
        when(browserDriver.estadoAtual()).thenReturn(PjeBrowserSessionState.AUTENTICADO);

        Optional<PjeLoginResult> resultado =
                orchestrator.executarLogin(PjeGrau.PRIMEIRO_GRAU, "12345678901", null);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().sucesso()).isTrue();
        verify(credencialTotpService).obterSenhaPrimeiroFator(TribunalIntegracao.PJE_TRT18, "12345678901");
        verify(browserDriver).preencherCredenciais("12345678901", "senha-do-cofre");
    }

    @Test
    void semSenhaEmLugarNenhumFalhaAcionavel() {
        when(credencialTotpService.obterSenhaPrimeiroFator(TribunalIntegracao.PJE_TRT18, "00733235190"))
                .thenReturn(Optional.empty());

        Optional<PjeLoginResult> resultado =
                orchestrator.executarLogin(PjeGrau.PRIMEIRO_GRAU, "00733235190", "");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().sucesso()).isFalse();
        assertThat(resultado.get().mensagem())
                .contains("Senha do PJE_TRT18 não informada")
                .contains("00733235190")
                .contains("/api/admin/totp/credenciais");

        verify(browserDriver, never()).abrir(any(), any());
        verify(browserDriver, never()).fechar();
    }

    @Test
    void semCredencialTotpFalhaComMensagemAcionavel() {
        when(browserDriver.telaOtpVisivel()).thenReturn(true);
        when(segundoFatorCodigoResolver.obterCodigoTotpSeAplicavel(
                        eq(TribunalIntegracao.PJE_TRT18), eq("00733235190")))
                .thenReturn(Optional.empty());
        when(browserDriver.estadoAtual()).thenReturn(PjeBrowserSessionState.TELA_OTP);

        Optional<PjeLoginResult> resultado =
                orchestrator.executarLogin(PjeGrau.SEGUNDO_GRAU, "00733235190", "senha");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().sucesso()).isFalse();
        assertThat(resultado.get().mensagem())
                .contains("Cadastre o segredo TOTP do PJE_TRT18")
                .contains("00733235190")
                .contains("/api/admin/totp/credenciais");

        verify(browserDriver, never()).preencherCodigoOtp(any());
        verify(browserDriver, never()).submeterOtp();
        verify(browserDriver).fechar();
    }

    @Test
    void totpGeradoAposSubmeterLoginETelaOtp() {
        when(browserDriver.telaOtpVisivel()).thenReturn(true);
        when(segundoFatorCodigoResolver.obterCodigoTotpSeAplicavel(any(), any()))
                .thenReturn(Optional.of("999888"));
        when(browserDriver.estadoAtual()).thenReturn(PjeBrowserSessionState.AUTENTICADO);

        orchestrator.executarLogin(PjeGrau.PRIMEIRO_GRAU, "user", "pass");

        var ordem = inOrder(browserDriver, segundoFatorCodigoResolver);
        ordem.verify(browserDriver).submeterLogin();
        ordem.verify(browserDriver).telaOtpVisivel();
        ordem.verify(segundoFatorCodigoResolver)
                .obterCodigoTotpSeAplicavel(TribunalIntegracao.PJE_TRT18, "user");
        ordem.verify(browserDriver).preencherCodigoOtp("999888");
    }

    @Test
    void resolverChamadoComTribunalPjeTrt18() {
        when(browserDriver.telaOtpVisivel()).thenReturn(true);
        when(segundoFatorCodigoResolver.obterCodigoTotpSeAplicavel(any(), any()))
                .thenReturn(Optional.of("111222"));
        when(browserDriver.estadoAtual()).thenReturn(PjeBrowserSessionState.AUTENTICADO);

        orchestrator.executarLogin(PjeGrau.PRIMEIRO_GRAU, "user", "pass");

        ArgumentCaptor<TribunalIntegracao> tribunalCaptor = ArgumentCaptor.forClass(TribunalIntegracao.class);
        verify(segundoFatorCodigoResolver)
                .obterCodigoTotpSeAplicavel(tribunalCaptor.capture(), eq("user"));
        assertThat(tribunalCaptor.getValue()).isEqualTo(TribunalIntegracao.PJE_TRT18);
    }
}
