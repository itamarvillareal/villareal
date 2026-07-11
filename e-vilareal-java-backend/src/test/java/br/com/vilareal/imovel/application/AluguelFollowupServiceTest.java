package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.api.dto.AluguelFollowupResponse;
import br.com.vilareal.imovel.api.dto.SugestoesAluguelPendenteResponse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.AluguelFollowupEventoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.AluguelFollowupEventoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import br.com.vilareal.whatsapp.service.CobrancaWhatsAppService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AluguelFollowupServiceTest {

    /** Competência fixa no passado: vencimento sempre anterior a hoje. */
    private static final String COMPETENCIA_PASSADA = "2020-01";

    @Mock
    private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock
    private LocacaoReconciliacaoService reconciliacaoService;
    @Mock
    private CobrancaWhatsAppService cobrancaWhatsAppService;
    @Mock
    private CobrancaWhatsAppRepository cobrancaWhatsAppRepository;
    @Mock
    private WhatsAppMessageRepository whatsAppMessageRepository;
    @Mock
    private AluguelFollowupEventoRepository eventoRepository;

    @InjectMocks
    private AluguelFollowupService service;

    @Test
    void casoSemNenhumaCobrancaPedeEnviarMensagemHoje() {
        prepararCaso(List.of(), List.of());

        AluguelFollowupResponse resp = service.followup(COMPETENCIA_PASSADA, 1);

        assertThat(resp.totalCasos()).isEqualTo(1);
        assertThat(resp.totalAcaoHoje()).isEqualTo(1);
        AluguelFollowupResponse.Item item = resp.itens().get(0);
        assertThat(item.proximaAcao()).isEqualTo(AluguelFollowupService.ACAO_ENVIAR_MENSAGEM);
        assertThat(item.acaoVencida()).isTrue();
        assertThat(item.cobrancasEnviadas()).isZero();
    }

    @Test
    void mensagemSemRespostaHaMaisDeDoisDiasEscalonaParaReenvio() {
        CobrancaWhatsAppEntity cobranca = cobranca(Instant.parse("2020-01-10T12:00:00Z"));
        prepararCaso(List.of(cobranca), List.of());
        when(whatsAppMessageRepository.findLatestInboundByPhoneSuffixSince(anyString(), any()))
                .thenReturn(Optional.empty());

        AluguelFollowupResponse resp = service.followup(COMPETENCIA_PASSADA, 1);

        AluguelFollowupResponse.Item item = resp.itens().get(0);
        assertThat(item.cobrancasEnviadas()).isEqualTo(1);
        assertThat(item.respondeuAposUltimaAcao()).isFalse();
        assertThat(item.proximaAcao()).isEqualTo(AluguelFollowupService.ACAO_REENVIAR_MENSAGEM);
        assertThat(item.acaoVencida()).isTrue();
    }

    @Test
    void duasMensagensSemRespostaEscalonamParaLigacao() {
        prepararCaso(
                List.of(cobranca(Instant.parse("2020-01-10T12:00:00Z")), cobranca(Instant.parse("2020-01-14T12:00:00Z"))),
                List.of());
        when(whatsAppMessageRepository.findLatestInboundByPhoneSuffixSince(anyString(), any()))
                .thenReturn(Optional.empty());

        AluguelFollowupResponse resp = service.followup(COMPETENCIA_PASSADA, 1);

        assertThat(resp.itens().get(0).proximaAcao()).isEqualTo(AluguelFollowupService.ACAO_LIGAR);
    }

    @Test
    void respostaDoInquilinoViraVerificarResposta() {
        prepararCaso(List.of(cobranca(Instant.parse("2020-01-10T12:00:00Z"))), List.of());
        WhatsAppMessageEntity inbound = new WhatsAppMessageEntity();
        inbound.setCreatedAt(Instant.parse("2020-01-11T09:00:00Z"));
        when(whatsAppMessageRepository.findLatestInboundByPhoneSuffixSince(anyString(), any()))
                .thenReturn(Optional.of(inbound));

        AluguelFollowupResponse resp = service.followup(COMPETENCIA_PASSADA, 1);

        AluguelFollowupResponse.Item item = resp.itens().get(0);
        assertThat(item.respondeuAposUltimaAcao()).isTrue();
        assertThat(item.proximaAcao()).isEqualTo(AluguelFollowupService.ACAO_VERIFICAR_RESPOSTA);
    }

    @Test
    void casoResolvidoManualSaiDaLista() {
        AluguelFollowupEventoEntity resolvido = evento(AluguelFollowupEventoEntity.TIPO_RESOLVIDO_MANUAL, null);
        prepararCaso(List.of(), List.of(resolvido));

        AluguelFollowupResponse resp = service.followup(COMPETENCIA_PASSADA, 1);

        assertThat(resp.totalCasos()).isZero();
    }

    @Test
    void casoAdiadoFicaAguardandoAteAData() {
        LocalDate futuro = LocalDate.now().plusDays(5);
        AluguelFollowupEventoEntity adiar = evento(AluguelFollowupEventoEntity.TIPO_ADIAR, futuro);
        prepararCaso(List.of(), List.of(adiar));

        AluguelFollowupResponse resp = service.followup(COMPETENCIA_PASSADA, 1);

        AluguelFollowupResponse.Item item = resp.itens().get(0);
        assertThat(item.proximaAcao()).isEqualTo(AluguelFollowupService.ACAO_AGUARDAR);
        assertThat(item.prazoAcao()).isEqualTo(futuro);
        assertThat(item.acaoVencida()).isFalse();
        assertThat(resp.totalAguardando()).isEqualTo(1);
    }

    @Test
    void sugestaoNoExtratoPrevaleceComoConciliar() {
        var sugestaoCredito = new SugestoesAluguelPendenteResponse.SugestaoCreditoItem(
                99L, LocalDate.of(2020, 1, 6), "PIX MARIA", new BigDecimal("1000.00"),
                26, "ORFAO", "ALTA", true, true, true);
        var contratoComSugestao = new SugestoesAluguelPendenteResponse.ContratoPendenteItem(
                1L, 42, "Rua A, 1", "Maria", new BigDecimal("1000.00"), 5, List.of(sugestaoCredito));
        prepararCaso(List.of(), List.of(), new SugestoesAluguelPendenteResponse(
                COMPETENCIA_PASSADA, 1, 1, List.of(contratoComSugestao)));

        AluguelFollowupResponse resp = service.followup(COMPETENCIA_PASSADA, 1);

        assertThat(resp.itens().get(0).proximaAcao()).isEqualTo(AluguelFollowupService.ACAO_CONCILIAR);
    }

    @Test
    void registrarEventoAdiarExigeDataFutura() {
        assertThatThrownBy(() -> service.registrarEvento(
                        new AluguelFollowupResponse.EventoRequest(
                                1L, COMPETENCIA_PASSADA, "ADIAR", null, LocalDate.now().minusDays(1)),
                        "itamar"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("futura");
    }

    @Test
    void registrarEventoLigacaoSalva() {
        when(contratoLocacaoRepository.findById(1L)).thenReturn(Optional.of(contrato(1L)));

        service.registrarEvento(
                new AluguelFollowupResponse.EventoRequest(
                        1L, COMPETENCIA_PASSADA, "ligacao", "Prometeu pagar sexta", null),
                "itamar");

        ArgumentCaptor<AluguelFollowupEventoEntity> captor =
                ArgumentCaptor.forClass(AluguelFollowupEventoEntity.class);
        verify(eventoRepository).save(captor.capture());
        AluguelFollowupEventoEntity salvo = captor.getValue();
        assertThat(salvo.getTipo()).isEqualTo(AluguelFollowupEventoEntity.TIPO_LIGACAO);
        assertThat(salvo.getObservacao()).isEqualTo("Prometeu pagar sexta");
        assertThat(salvo.getCreatedBy()).isEqualTo("itamar");
    }

    private void prepararCaso(
            List<CobrancaWhatsAppEntity> cobrancas, List<AluguelFollowupEventoEntity> eventos) {
        prepararCaso(cobrancas, eventos,
                new SugestoesAluguelPendenteResponse(COMPETENCIA_PASSADA, 1, 0, List.of()));
    }

    private void prepararCaso(
            List<CobrancaWhatsAppEntity> cobrancas,
            List<AluguelFollowupEventoEntity> eventos,
            SugestoesAluguelPendenteResponse sugestoes) {
        ContratoLocacaoEntity contrato = contrato(1L);
        when(reconciliacaoService.sugerirAlugueisPendentes(COMPETENCIA_PASSADA)).thenReturn(sugestoes);
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq(COMPETENCIA_PASSADA), any(), any()))
                .thenReturn(List.of(contrato));
        lenient()
                .when(cobrancaWhatsAppRepository.findByImovelIdInAndStatusNotOrderByCreatedAtDesc(
                        anyCollection(), eq("CANCELADO")))
                .thenReturn(cobrancas);
        lenient().when(eventoRepository.findByContratoIdInOrderByCreatedAtAsc(anyCollection())).thenReturn(eventos);
        lenient().when(cobrancaWhatsAppService.resolverTelefonePessoa(10L, null)).thenReturn("62999990000");
    }

    private static CobrancaWhatsAppEntity cobranca(Instant enviadoAt) {
        CobrancaWhatsAppEntity c = new CobrancaWhatsAppEntity();
        c.setImovelId(77L);
        c.setLoteDescricao("Aluguel em atraso · " + COMPETENCIA_PASSADA);
        c.setPhoneNumber("5562999990000");
        c.setEnviadoAt(enviadoAt);
        c.setCreatedAt(enviadoAt);
        return c;
    }

    private static AluguelFollowupEventoEntity evento(String tipo, LocalDate adiadoAte) {
        AluguelFollowupEventoEntity e = new AluguelFollowupEventoEntity();
        e.setContratoId(1L);
        e.setCompetencia(COMPETENCIA_PASSADA);
        e.setTipo(tipo);
        e.setAdiadoAte(adiadoAte);
        e.setCreatedAt(Instant.parse("2020-01-12T12:00:00Z"));
        return e;
    }

    private static ContratoLocacaoEntity contrato(Long id) {
        PessoaEntity inquilino = new PessoaEntity();
        inquilino.setId(10L);
        inquilino.setNome("Sergio Gonzaga");
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(77L);
        imovel.setNumeroPlanilha(42);
        imovel.setEnderecoCompleto("Rua A, 1");
        ContratoLocacaoEntity c = new ContratoLocacaoEntity();
        c.setId(id);
        c.setImovel(imovel);
        c.setInquilinoPessoa(inquilino);
        c.setValorAluguel(new BigDecimal("1000.00"));
        c.setDiaVencimentoAluguel(5);
        return c;
    }
}
