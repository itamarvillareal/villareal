package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConsultaPeriodicaBackupServiceTest {

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");
    private static final String CNJ = "5059346-36.2026.8.09.0007";

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private AgendamentoConsultaRepository agendamentoConsultaRepository;

    @Mock
    private NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;

    @Mock
    private ConsultaPeriodicaBackupImportador importador;

    @Mock
    private Clock clock;

    @InjectMocks
    private ConsultaPeriodicaBackupExportLeitura exportLeitura;

    private ConsultaPeriodicaBackupService service;

    @BeforeEach
    void clockFixo() {
        lenient().when(clock.getZone()).thenReturn(ZONA_BR);
        lenient()
                .when(clock.instant())
                .thenReturn(Instant.parse("2026-06-03T15:30:00-03:00"));
        service = new ConsultaPeriodicaBackupService(exportLeitura, importador, clock);
    }

    @Test
    void exportar_doisAgendamentosUmDestinatario_duasLinhasComDestinatariosRepetidos() throws Exception {
        ProcessoEntity processo = processoComCliente(99L, CNJ, "Condomínio Teste");
        processo.setConsultaPeriodicaHabilitada(true);

        AgendamentoConsultaEntity ag1 = agendamentoIntervalo(processo, 60);
        AgendamentoConsultaEntity ag2 = agendamentoPeriodico(processo);

        NotificacaoDestinatarioEntity dest = new NotificacaoDestinatarioEntity();
        dest.setCanal(CanalNotificacao.EMAIL);
        dest.setValor("jr@teste.com");
        dest.setProcesso(processo);

        when(processoRepository.findIdsComConfigConsultaPeriodica()).thenReturn(List.of(99L));
        when(processoRepository.findByIdInWithClienteAndPessoa(List.of(99L))).thenReturn(List.of(processo));
        when(agendamentoConsultaRepository.findByProcessoIdIn(List.of(99L))).thenReturn(List.of(ag1, ag2));
        when(notificacaoDestinatarioRepository.findByProcessoIdIn(List.of(99L))).thenReturn(List.of(dest));

        var exportacao = service.exportar();
        assertThat(exportacao.nomeArquivo()).isEqualTo("consultas-periodicas-20260603-1530.csv");

        byte[] csv = exportacao.conteudo();
        String texto = new String(csv, StandardCharsets.UTF_8);
        assertThat(texto).startsWith("\uFEFF");

        try (CSVParser parser = CSVParser.parse(
                new StringReader(texto.substring(1)),
                CSVFormat.DEFAULT.builder()
                        .setDelimiter(';')
                        .setHeader()
                        .setSkipHeaderRecord(true)
                        .build())) {
            List<org.apache.commons.csv.CSVRecord> records = parser.getRecords();
            assertThat(records).hasSize(2);

            for (var rec : records) {
                assertThat(rec.get("numero_cnj")).isEqualTo(CNJ);
                assertThat(rec.get("cliente")).isEqualTo("Condomínio Teste");
                assertThat(rec.get("consulta_periodica_habilitada")).isEqualTo("true");
                assertThat(rec.get("destinatarios_adicionais")).isEqualTo("EMAIL:jr@teste.com");
            }
            assertThat(records.get(0).get("tipo_cadencia")).isEqualTo("INTERVALO");
            assertThat(records.get(0).get("intervalo_minutos")).isEqualTo("60");
            assertThat(records.get(1).get("tipo_cadencia")).isEqualTo("PERIODICO");
            assertThat(records.get(1).get("periodo")).isEqualTo("SEMANAL");
            assertThat(records.get(1).get("periodo_horario")).isEqualTo("08:00");
        }

        verify(agendamentoConsultaRepository, times(1)).findByProcessoIdIn(anyList());
        verify(notificacaoDestinatarioRepository, times(1)).findByProcessoIdIn(anyList());
        verify(processoRepository, times(0)).findByIdWithClienteAndPessoa(any());
        verify(agendamentoConsultaRepository, times(0)).findByProcessoId(any());
    }

    @Test
    void exportar_flagLigadaSemAgendamento_umaLinhaCadenciaVazia() throws Exception {
        ProcessoEntity processo = processoComCliente(1L, CNJ, "Cliente X");
        processo.setConsultaPeriodicaHabilitada(true);

        when(processoRepository.findIdsComConfigConsultaPeriodica()).thenReturn(List.of(1L));
        when(processoRepository.findByIdInWithClienteAndPessoa(List.of(1L))).thenReturn(List.of(processo));
        when(agendamentoConsultaRepository.findByProcessoIdIn(List.of(1L))).thenReturn(List.of());
        when(notificacaoDestinatarioRepository.findByProcessoIdIn(List.of(1L))).thenReturn(List.of());

        byte[] csv = service.exportar().conteudo();
        String texto = new String(csv, StandardCharsets.UTF_8).substring(1);

        assertThat(texto.split("\\r?\\n")).hasSizeGreaterThanOrEqualTo(2);

        try (CSVParser parser = CSVParser.parse(
                new StringReader(texto),
                CSVFormat.DEFAULT.builder()
                        .setDelimiter(';')
                        .setHeader()
                        .setSkipHeaderRecord(true)
                        .setIgnoreEmptyLines(false)
                        .build())) {
            var records = parser.getRecords();
            assertThat(records).hasSize(1);
            var rec = records.get(0);
            assertThat(rec.get("consulta_periodica_habilitada")).isEqualTo("true");
            assertThat(rec.get("tipo_cadencia")).isEmpty();
            assertThat(rec.get("intervalo_minutos")).isEmpty();
        }
    }

    @Test
    void exportar_carregaAgendamentosEDestinatariosEmLote() {
        ProcessoEntity p1 = processoComCliente(1L, CNJ, "A");
        ProcessoEntity p2 = processoComCliente(2L, "0000999-00.2026.8.09.0099", "B");
        p1.setConsultaPeriodicaHabilitada(true);
        p2.setConsultaPeriodicaHabilitada(true);

        when(processoRepository.findIdsComConfigConsultaPeriodica()).thenReturn(List.of(1L, 2L));
        when(processoRepository.findByIdInWithClienteAndPessoa(List.of(1L, 2L))).thenReturn(List.of(p1, p2));
        when(agendamentoConsultaRepository.findByProcessoIdIn(anyList())).thenReturn(List.of());
        when(notificacaoDestinatarioRepository.findByProcessoIdIn(anyList())).thenReturn(List.of());

        service.exportar();

        ArgumentCaptor<List<Long>> idsCaptor = ArgumentCaptor.forClass(List.class);
        verify(agendamentoConsultaRepository).findByProcessoIdIn(idsCaptor.capture());
        assertThat(idsCaptor.getValue()).containsExactly(1L, 2L);
        verify(notificacaoDestinatarioRepository).findByProcessoIdIn(idsCaptor.capture());
        assertThat(idsCaptor.getValue()).containsExactly(1L, 2L);
    }

    @Test
    void importar_csvComBomUtf8_leNumeroCnj() {
        String csv = linhaCsv(
                CNJ,
                "true",
                "INTERVALO",
                "30",
                "",
                "",
                "",
                "",
                "",
                "false",
                "false",
                "0",
                "",
                "",
                "true",
                "");
        MockMultipartFile file = arquivoComBom(csv);

        when(importador.importarProcesso(eq(CNJ), anyList()))
                .thenReturn(ConsultaPeriodicaBackupImportador.ResultadoProcesso.atualizado(1, 0));

        var rel = service.importar(file);

        assertThat(rel.getLinhasInvalidas()).isEmpty();
        assertThat(rel.getLinhasLidas()).isEqualTo(1);
        verify(importador).importarProcesso(eq(CNJ), anyList());
    }

    private static final byte[] UTF8_BOM = new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    @Test
    void importar_cnjInexistente_vaiParaPulados() {
        String csv = linhaCsv(
                CNJ,
                "true",
                "INTERVALO",
                "30",
                "",
                "",
                "",
                "",
                "",
                "false",
                "false",
                "0",
                "",
                "",
                "true",
                "");
        MockMultipartFile file = arquivo(csv);

        when(importador.importarProcesso(eq(CNJ), anyList()))
                .thenReturn(ConsultaPeriodicaBackupImportador.ResultadoProcesso.pulado());

        var rel = service.importar(file);

        assertThat(rel.getPuladosCnjInexistente()).containsExactly(CNJ);
        assertThat(rel.getProcessosAtualizados()).isZero();
        verify(importador).importarProcesso(eq(CNJ), anyList());
    }

    @Test
    void importar_parseTolerante_simNaoEHorariosPipe() {
        String csv = linhaCsv(
                CNJ,
                "sim",
                "HORARIOS_FIXOS",
                "",
                "08:00|14:30",
                "",
                "",
                "",
                "",
                "1",
                "SIM",
                "1",
                "motivo",
                "",
                "nao",
                "");
        MockMultipartFile file = arquivo(csv);

        when(importador.importarProcesso(eq(CNJ), anyList()))
                .thenReturn(ConsultaPeriodicaBackupImportador.ResultadoProcesso.atualizado(1, 0));

        var rel = service.importar(file);

        assertThat(rel.getLinhasInvalidas()).isEmpty();
        assertThat(rel.getProcessosAtualizados()).isEqualTo(1);
        verify(importador).importarProcesso(eq(CNJ), anyList());
    }

    @Test
    void importar_linhaInvalida_naoAbortaLote() {
        String csv = linhaCsv(
                        CNJ,
                        "true",
                        "INTERVALO",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "false",
                        "false",
                        "0",
                        "",
                        "",
                        "true",
                        "")
                + "\r\n"
                + linhaCsv(
                        "0000999-00.2026.8.09.0099",
                        "true",
                        "PERIODICO",
                        "",
                        "",
                        "SEMANAL",
                        "09:00",
                        "",
                        "",
                        "false",
                        "false",
                        "0",
                        "",
                        "",
                        "true",
                        "");

        MockMultipartFile file = arquivo(csv);

        when(importador.importarProcesso(any(), anyList()))
                .thenReturn(ConsultaPeriodicaBackupImportador.ResultadoProcesso.atualizado(1, 0));

        var rel = service.importar(file);

        assertThat(rel.getLinhasInvalidas()).hasSize(1);
        assertThat(rel.getLinhasInvalidas().get(0).getLinha()).isEqualTo(2);
        assertThat(rel.getLinhasInvalidas().get(0).getMotivo()).contains("intervaloMinutos");
        assertThat(rel.getProcessosAtualizados()).isEqualTo(1);
    }

    private static MockMultipartFile arquivo(String corpo) {
        String header = String.join(";", ConsultaPeriodicaBackupCsv.HEADER);
        byte[] bytes = (header + "\r\n" + corpo).getBytes(StandardCharsets.UTF_8);
        return new MockMultipartFile("file", "backup.csv", "text/csv", bytes);
    }

    private static MockMultipartFile arquivoComBom(String corpo) {
        String header = String.join(";", ConsultaPeriodicaBackupCsv.HEADER);
        byte[] conteudo = (header + "\r\n" + corpo).getBytes(StandardCharsets.UTF_8);
        byte[] bytes = new byte[UTF8_BOM.length + conteudo.length];
        System.arraycopy(UTF8_BOM, 0, bytes, 0, UTF8_BOM.length);
        System.arraycopy(conteudo, 0, bytes, UTF8_BOM.length, conteudo.length);
        return new MockMultipartFile("file", "backup.csv", "text/csv", bytes);
    }

    private static String linhaCsv(String... colunasAposCnj) {
        if (colunasAposCnj.length != 16) {
            throw new IllegalArgumentException("Esperadas 16 colunas após CNJ, recebidas: " + colunasAposCnj.length);
        }
        String[] cols = new String[17];
        cols[0] = colunasAposCnj[0];
        cols[1] = "Cliente";
        System.arraycopy(colunasAposCnj, 1, cols, 2, 15);
        return String.join(";", cols);
    }

    private static ProcessoEntity processoComCliente(long id, String cnj, String nomeCliente) {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setNome("Titular");
        ClienteEntity cliente = new ClienteEntity();
        cliente.setNomeReferencia(nomeCliente);
        cliente.setPessoa(pessoa);
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(id);
        processo.setNumeroCnj(cnj);
        processo.setCliente(cliente);
        processo.setPessoa(pessoa);
        processo.setNumeroInterno(1);
        return processo;
    }

    private static AgendamentoConsultaEntity agendamentoIntervalo(ProcessoEntity processo, int minutos) {
        AgendamentoConsultaEntity ag = new AgendamentoConsultaEntity();
        ag.setProcesso(processo);
        ag.setTipoCadencia(TipoCadencia.INTERVALO);
        ag.setIntervaloMinutos(minutos);
        ag.setAtivo(true);
        ag.setApenasDiasUteis(false);
        ag.setConsiderarFeriados(false);
        ag.setPrioridade(0);
        return ag;
    }

    private static AgendamentoConsultaEntity agendamentoPeriodico(ProcessoEntity processo) {
        AgendamentoConsultaEntity ag = new AgendamentoConsultaEntity();
        ag.setProcesso(processo);
        ag.setTipoCadencia(TipoCadencia.PERIODICO);
        ag.setPeriodo(PeriodoCadencia.SEMANAL);
        ag.setPeriodoHorario(java.time.LocalTime.of(8, 0));
        ag.setAtivo(true);
        ag.setApenasDiasUteis(false);
        ag.setConsiderarFeriados(false);
        ag.setPrioridade(0);
        return ag;
    }
}
