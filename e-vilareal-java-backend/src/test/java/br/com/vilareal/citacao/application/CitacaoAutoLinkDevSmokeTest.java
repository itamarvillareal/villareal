package br.com.vilareal.citacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.MovimentacaoMonitoradaRepository;
import br.com.vilareal.citacao.api.dto.CitacaoSolicitarRequest;
import br.com.vilareal.citacao.infrastructure.persistence.entity.CitacaoTentativaEntity;
import br.com.vilareal.citacao.infrastructure.persistence.repository.CitacaoTentativaRepository;
import br.com.vilareal.citacao.domain.CitacaoStatus;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaEnderecoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.tarefa.infrastructure.persistence.repository.TarefaOperacionalRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke contra banco dev local (docker vilareal-db :3307). Requer processo 8697 com partes réu e endereços da pessoa 1.
 * Rodar com {@code -Dcitacao.dev.smoke=true} (não roda no CI — precisa do banco dev).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("dev")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@EnabledIfSystemProperty(named = "citacao.dev.smoke", matches = "true")
class CitacaoAutoLinkDevSmokeTest {

    private static final long PROCESSO_ID = 8697L;
    private static final long PARTE_REU = 27494L;
    private static final long ENDERECO_1 = 24669L;
    private static final long ENDERECO_2 = 30928L;

    @Autowired
    private CitacaoAutoLinkService citacaoAutoLinkService;

    @Autowired
    private CitacaoApplicationService citacaoApplicationService;

    @Autowired
    private CitacaoTentativaRepository tentativaRepository;

    @Autowired
    private MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository;

    @Autowired
    private ProcessoRepository processoRepository;

    @Autowired
    private ProcessoParteRepository processoParteRepository;

    @Autowired
    private PessoaEnderecoRepository pessoaEnderecoRepository;

    @Autowired
    private ProcessoAndamentoRepository andamentoRepository;

    @Autowired
    private TarefaOperacionalRepository tarefaOperacionalRepository;

    private static Long movFelizId;
    private static Long movIdempotenteId;
    private static Long tentativaFelizId;
    private static Long andamentoAutoDeleteId;

    @BeforeEach
    void limparTarefasAutoLink() {
        tarefaOperacionalRepository
                .findAll()
                .stream()
                .filter(t -> CitacaoAutoLinkService.ORIGEM_TAREFA_AMBIGUA.equals(t.getOrigem()))
                .forEach(t -> tarefaOperacionalRepository.delete(t));
    }

    @Test
    @Order(1)
    @Transactional
    void casoFeliz_umaTentativaAberta_viraNegativo() {
        limparTentativasProcesso();
        CitacaoTentativaEntity t = novaTentativa(PARTE_REU, ENDERECO_1);
        tentativaFelizId = t.getId();

        MovimentacaoMonitoradaEntity mov = novaMov("Citação Não Efetivada - teste auto-link feliz", 99001);
        movFelizId = mov.getId();

        citacaoAutoLinkService.processarNovaMovimentacao(mov.getId());

        CitacaoTentativaEntity atualizada = tentativaRepository.findById(tentativaFelizId).orElseThrow();
        assertThat(atualizada.getStatus()).isEqualTo(CitacaoStatus.NEGATIVO);
        assertThat(atualizada.getMovMonitoradaRetorno()).isNotNull();
        assertThat(atualizada.getMovMonitoradaRetorno().getId()).isEqualTo(movFelizId);
        assertThat(atualizada.getMovProjudiRetorno()).isEqualTo("99001");
        assertThat(atualizada.getDataRetorno()).isEqualTo(LocalDate.of(2026, 7, 6));
        assertThat(atualizada.getMotivoRetorno()).contains("Não Efetivada");
    }

    @Test
    @Order(2)
    @Transactional
    void casoAmbiguo_duasTentativasAbertas_criaTarefa() {
        limparTentativasProcesso();
        novaTentativa(PARTE_REU, ENDERECO_1);
        novaTentativa(PARTE_REU, ENDERECO_2);

        MovimentacaoMonitoradaEntity mov = novaMov("Mandado Não Cumprido - teste ambíguo", 99002);
        citacaoAutoLinkService.processarNovaMovimentacao(mov.getId());

        assertThat(tentativaRepository.findByProcessoIdAndStatusAndPoloReu(PROCESSO_ID, CitacaoStatus.SOLICITADO))
                .hasSize(2);
        assertThat(tarefaOperacionalRepository.findAll().stream()
                        .anyMatch(t -> CitacaoAutoLinkService.ORIGEM_TAREFA_AMBIGUA.equals(t.getOrigem())))
                .isTrue();
    }

    @Test
    @Order(3)
    @Transactional
    void casoSemMatch_legendaComum_nadaAcontece() {
        limparTentativasProcesso();
        novaTentativa(PARTE_REU, ENDERECO_1);

        MovimentacaoMonitoradaEntity mov = novaMov("Juntada -> Petição - teste sem match", 99003);
        citacaoAutoLinkService.processarNovaMovimentacao(mov.getId());

        assertThat(tentativaRepository.findById(
                        tentativaRepository.findByProcessoIdAndStatusAndPoloReu(
                                        PROCESSO_ID, CitacaoStatus.SOLICITADO)
                                .get(0)
                                .getId())
                .orElseThrow()
                .getStatus())
                .isEqualTo(CitacaoStatus.SOLICITADO);
        assertThat(tarefaOperacionalRepository.findAll().stream()
                        .noneMatch(t -> CitacaoAutoLinkService.ORIGEM_TAREFA_AMBIGUA.equals(t.getOrigem())))
                .isTrue();
    }

    @Test
    @Order(4)
    @Transactional
    void idempotencia_reprocessarMesmaMov_naoReaplica() {
        limparTentativasProcesso();
        CitacaoTentativaEntity t = novaTentativa(PARTE_REU, ENDERECO_1);
        MovimentacaoMonitoradaEntity mov = novaMov("Citação Não Efetivada - idempotência", 99004);
        movIdempotenteId = mov.getId();

        citacaoAutoLinkService.processarNovaMovimentacao(mov.getId());
        citacaoAutoLinkService.processarNovaMovimentacao(mov.getId());

        assertThat(tentativaRepository.findByMovMonitoradaRetorno_Id(movIdempotenteId)).isPresent();
        assertThat(tentativaRepository.findAll().stream()
                        .filter(x -> movIdempotenteId.equals(
                                x.getMovMonitoradaRetorno() != null ? x.getMovMonitoradaRetorno().getId() : null))
                        .count())
                .isEqualTo(1);
        assertThat(tentativaRepository.findById(t.getId()).orElseThrow().getStatus())
                .isEqualTo(CitacaoStatus.NEGATIVO);
    }

    @Test
    @Order(5)
    @WithMockUser("itamar")
    @Transactional
    void deleteTentativa_removeAndamentoAutoGerado() {
        limparTentativasProcesso();
        CitacaoSolicitarRequest req = new CitacaoSolicitarRequest();
        req.setProcessoParteId(PARTE_REU);
        req.setPessoaEnderecoId(ENDERECO_1);
        req.setDataSolicitacao(LocalDate.now());
        var resp = citacaoApplicationService.solicitar(PROCESSO_ID, req);
        andamentoAutoDeleteId = resp.getAndamentoSolicitacaoId();
        assertThat(andamentoAutoDeleteId).isNotNull();
        assertThat(andamentoRepository.findById(andamentoAutoDeleteId)).isPresent();

        citacaoApplicationService.excluirTentativa(PROCESSO_ID, resp.getId());

        assertThat(tentativaRepository.findById(resp.getId())).isEmpty();
        assertThat(andamentoRepository.findById(andamentoAutoDeleteId)).isEmpty();
    }

    private void limparTentativasProcesso() {
        Map<Long, CitacaoTentativaEntity> porId = new LinkedHashMap<>();
        for (String status : List.of(CitacaoStatus.SOLICITADO, CitacaoStatus.NEGATIVO, CitacaoStatus.POSITIVO)) {
            for (CitacaoTentativaEntity t :
                    tentativaRepository.findByProcessoIdAndStatusAndPoloReu(PROCESSO_ID, status)) {
                porId.put(t.getId(), t);
            }
        }
        for (CitacaoTentativaEntity t : porId.values()) {
            if (t.getAndamentoSolicitacao() != null
                    && "CITACAO".equals(t.getAndamentoSolicitacao().getOrigem())) {
                ProcessoAndamentoEntity a = t.getAndamentoSolicitacao();
                tentativaRepository.delete(t);
                andamentoRepository.delete(a);
            } else {
                tentativaRepository.delete(t);
            }
        }
        tentativaRepository.flush();
    }

    private CitacaoTentativaEntity novaTentativa(long parteId, long enderecoId) {
        CitacaoTentativaEntity t = new CitacaoTentativaEntity();
        t.setProcessoParte(processoParteRepository.getReferenceById(parteId));
        t.setPessoaEndereco(pessoaEnderecoRepository.getReferenceById(enderecoId));
        t.setStatus(CitacaoStatus.SOLICITADO);
        t.setDataSolicitacao(LocalDate.now());
        return tentativaRepository.saveAndFlush(t);
    }

    private MovimentacaoMonitoradaEntity novaMov(String legenda, int numero) {
        ProcessoEntity processo = processoRepository.findById(PROCESSO_ID).orElseThrow();
        MovimentacaoMonitoradaEntity mov = new MovimentacaoMonitoradaEntity();
        mov.setProcesso(processo);
        mov.setIdMovi("test-autolink-" + UUID.randomUUID());
        mov.setNumero(numero);
        mov.setLegenda(legenda);
        mov.setDataMovimentacao(LocalDateTime.of(2026, 7, 6, 10, 0));
        mov.setDataConsulta(LocalDateTime.now());
        return movimentacaoMonitoradaRepository.saveAndFlush(mov);
    }
}
