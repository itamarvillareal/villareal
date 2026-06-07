package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.RelatorioImportacaoConsultaPeriodica;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.common.exception.BusinessRuleException;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ConsultaPeriodicaBackupService {

    private static final Logger log = LoggerFactory.getLogger(ConsultaPeriodicaBackupService.class);

    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final byte[] UTF8_BOM = new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final DateTimeFormatter NOME_ARQUIVO =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmm", Locale.ROOT);

    private final ConsultaPeriodicaBackupExportLeitura exportLeitura;
    private final ConsultaPeriodicaBackupImportador importador;
    private final Clock clock;

    public ConsultaPeriodicaBackupService(
            ConsultaPeriodicaBackupExportLeitura exportLeitura,
            ConsultaPeriodicaBackupImportador importador,
            Clock clock) {
        this.exportLeitura = exportLeitura;
        this.importador = importador;
        this.clock = clock;
    }

    public ExportacaoCsv exportar() {
        long inicioMs = System.currentTimeMillis();

        List<Long> ids = exportLeitura.listarIdsComConfig();
        log.info("[export-consultas] início: {} processos a exportar", ids.size());

        List<ConsultaPeriodicaBackupExportLeitura.DadosProcessoExport> processos = exportLeitura.carregarPorIds(ids);
        long aposLeituraMs = System.currentTimeMillis();
        log.info("[export-consultas] dados carregados em {} ms", aposLeituraMs - inicioMs);

        int linhasCsv = 0;
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            buffer.write(UTF8_BOM);
            CSVFormat format = CSVFormat.DEFAULT.builder()
                    .setDelimiter(ConsultaPeriodicaBackupCsv.DELIMITADOR)
                    .setRecordSeparator("\r\n")
                    .setHeader(ConsultaPeriodicaBackupCsv.HEADER)
                    .build();
            try (OutputStreamWriter writer = new OutputStreamWriter(buffer, StandardCharsets.UTF_8);
                    CSVPrinter printer = new CSVPrinter(writer, format)) {
                for (ConsultaPeriodicaBackupExportLeitura.DadosProcessoExport pe : processos) {
                    linhasCsv += escreverProcesso(printer, pe);
                }
                printer.flush();
            }
            byte[] bytes = buffer.toByteArray();
            String nomeArquivo = "consultas-periodicas-"
                    + clock.instant().atZone(clock.getZone()).format(NOME_ARQUIVO)
                    + ".csv";
            long duracaoMs = System.currentTimeMillis() - inicioMs;
            log.info(
                    "[export-consultas] fim: {} processos, {} linhas, {} bytes, {} ms total",
                    processos.size(),
                    linhasCsv,
                    bytes.length,
                    duracaoMs);
            return new ExportacaoCsv(bytes, nomeArquivo);
        } catch (IOException e) {
            log.warn("[export-consultas] falha após {} ms: {}", System.currentTimeMillis() - inicioMs, e.getMessage());
            throw new BusinessRuleException("Falha ao gerar CSV de consultas periódicas: " + e.getMessage());
        }
    }

    public RelatorioImportacaoConsultaPeriodica importar(MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new BusinessRuleException("Arquivo CSV é obrigatório.");
        }
        if (arquivo.getSize() > MAX_BYTES) {
            throw new BusinessRuleException("Arquivo excede o limite de 5 MB.");
        }

        Map<String, List<ConsultaPeriodicaBackupImportador.LinhaProcessoCsv>> porCnj = new LinkedHashMap<>();
        List<RelatorioImportacaoConsultaPeriodica.LinhaInvalida> linhasInvalidas = new ArrayList<>();
        int linhasLidas = 0;

        try (CSVParser parser = CSVParser.parse(
                new InputStreamReader(arquivo.getInputStream(), StandardCharsets.UTF_8),
                CSVFormat.DEFAULT.builder()
                        .setDelimiter(ConsultaPeriodicaBackupCsv.DELIMITADOR)
                        .setHeader()
                        .setSkipHeaderRecord(true)
                        .setTrim(true)
                        .setIgnoreEmptyLines(true)
                        .build())) {
            validarHeader(parser.getHeaderMap().keySet().stream().toList());

            for (CSVRecord record : parser) {
                linhasLidas++;
                int numeroLinha = (int) record.getRecordNumber() + 1;
                try {
                    String numeroCnj = valor(record, "numero_cnj");
                    if (!StringUtils.hasText(numeroCnj)) {
                        throw new IllegalArgumentException("numero_cnj é obrigatório.");
                    }
                    String cnjChave = numeroCnj.trim();
                    boolean habilitada =
                            ConsultaPeriodicaCsvUtil.parseBooleanTolerante(valor(record, "consulta_periodica_habilitada"), false);
                    List<ConsultaPeriodicaCsvUtil.DestinatarioCsv> destinatarios =
                            ConsultaPeriodicaCsvUtil.parseDestinatarios(valor(record, "destinatarios_adicionais"));
                    ConsultaPeriodicaCsvUtil.LinhaAgendamentoCsv agendamento = parseAgendamento(record);

                    porCnj.computeIfAbsent(cnjChave, k -> new ArrayList<>())
                            .add(new ConsultaPeriodicaBackupImportador.LinhaProcessoCsv(
                                    habilitada, agendamento, destinatarios));
                } catch (IllegalArgumentException e) {
                    linhasInvalidas.add(RelatorioImportacaoConsultaPeriodica.LinhaInvalida.builder()
                            .linha(numeroLinha)
                            .motivo(e.getMessage())
                            .build());
                }
            }
        } catch (BusinessRuleException e) {
            throw e;
        } catch (IOException e) {
            throw new BusinessRuleException("Falha ao ler CSV: " + e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException(e.getMessage());
        }

        int processosAtualizados = 0;
        int agendamentosCriados = 0;
        int destinatariosCriados = 0;
        List<String> pulados = new ArrayList<>();

        for (Map.Entry<String, List<ConsultaPeriodicaBackupImportador.LinhaProcessoCsv>> entry :
                porCnj.entrySet()) {
            ConsultaPeriodicaBackupImportador.ResultadoProcesso resultado =
                    importador.importarProcesso(entry.getKey(), entry.getValue());
            if (resultado.skipped()) {
                pulados.add(entry.getKey());
            } else {
                processosAtualizados++;
                agendamentosCriados += resultado.agendamentosCriados();
                destinatariosCriados += resultado.destinatariosCriados();
            }
        }

        return RelatorioImportacaoConsultaPeriodica.builder()
                .linhasLidas(linhasLidas)
                .processosAtualizados(processosAtualizados)
                .agendamentosCriados(agendamentosCriados)
                .destinatariosCriados(destinatariosCriados)
                .puladosCnjInexistente(pulados)
                .linhasInvalidas(linhasInvalidas)
                .build();
    }

    private static void validarHeader(List<String> headerLido) {
        List<String> normalizado = new ArrayList<>(headerLido.stream()
                .map(h -> h != null ? h.trim().toLowerCase(Locale.ROOT) : "")
                .toList());
        if (!normalizado.isEmpty() && normalizado.get(0).startsWith("\ufeff")) {
            normalizado.set(0, normalizado.get(0).substring(1));
        }
        List<String> esperado = ConsultaPeriodicaBackupCsv.HEADER_LIST.stream()
                .map(h -> h.toLowerCase(Locale.ROOT))
                .toList();
        if (!normalizado.equals(esperado)) {
            throw new BusinessRuleException(
                    "Cabeçalho CSV inválido. Esperado: " + String.join(";", ConsultaPeriodicaBackupCsv.HEADER)
                            + ". Recebido: "
                            + String.join(";", headerLido));
        }
    }

    private static ConsultaPeriodicaCsvUtil.LinhaAgendamentoCsv parseAgendamento(CSVRecord record) {
        TipoCadencia tipo = ConsultaPeriodicaCsvUtil.parseTipoCadencia(valor(record, "tipo_cadencia"));
        if (tipo == null) {
            return null;
        }
        Integer intervalo = ConsultaPeriodicaCsvUtil.parseIntervaloMinutos(valor(record, "intervalo_minutos"));
        String horarios = ConsultaPeriodicaCsvUtil.parseHorariosFixosImport(valor(record, "horarios_fixos"));
        var periodo = ConsultaPeriodicaCsvUtil.parsePeriodo(valor(record, "periodo"));
        var periodoHorario = ConsultaPeriodicaCsvUtil.parseHora(valor(record, "periodo_horario"), "periodo_horario");
        var janelaInicio = ConsultaPeriodicaCsvUtil.parseHora(valor(record, "janela_inicio"), "janela_inicio");
        var janelaFim = ConsultaPeriodicaCsvUtil.parseHora(valor(record, "janela_fim"), "janela_fim");
        boolean apenasDiasUteis =
                ConsultaPeriodicaCsvUtil.parseBooleanTolerante(valor(record, "apenas_dias_uteis"), false);
        boolean considerarFeriados =
                ConsultaPeriodicaCsvUtil.parseBooleanTolerante(valor(record, "considerar_feriados"), false);
        int prioridade = ConsultaPeriodicaCsvUtil.parsePrioridade(valor(record, "prioridade"));
        String motivo = valor(record, "motivo");
        var validoAte = ConsultaPeriodicaCsvUtil.parseValidoAte(valor(record, "valido_ate"));
        boolean ativo = ConsultaPeriodicaCsvUtil.parseBooleanTolerante(valor(record, "ativo"), true);

        ConsultaPeriodicaCsvUtil.validarLinhaAgendamento(tipo, intervalo, horarios, periodo, periodoHorario);

        return new ConsultaPeriodicaCsvUtil.LinhaAgendamentoCsv(
                tipo,
                intervalo,
                horarios,
                periodo,
                periodoHorario,
                janelaInicio,
                janelaFim,
                apenasDiasUteis,
                considerarFeriados,
                prioridade,
                motivo,
                validoAte,
                ativo);
    }

    private static String valor(CSVRecord record, String coluna) {
        if (!record.isMapped(coluna)) {
            return "";
        }
        String v = record.get(coluna);
        return v != null ? v : "";
    }

    private int escreverProcesso(
            CSVPrinter printer, ConsultaPeriodicaBackupExportLeitura.DadosProcessoExport pe) throws IOException {
        String destinatarios = formatDestinatarios(pe.destinatarios());

        List<ConsultaPeriodicaBackupExportLeitura.DadosAgendamentoExport> agendamentos = pe.agendamentos();
        if (agendamentos.isEmpty()) {
            printer.printRecord(
                    pe.numeroCnj(),
                    pe.clienteNome(),
                    ConsultaPeriodicaCsvUtil.formatBoolean(pe.consultaPeriodicaHabilitada()),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    destinatarios);
            return 1;
        }

        for (ConsultaPeriodicaBackupExportLeitura.DadosAgendamentoExport ag : agendamentos) {
            printer.printRecord(
                    pe.numeroCnj(),
                    pe.clienteNome(),
                    ConsultaPeriodicaCsvUtil.formatBoolean(pe.consultaPeriodicaHabilitada()),
                    ag.tipoCadencia() != null ? ag.tipoCadencia().name() : "",
                    ag.intervaloMinutos() != null ? ag.intervaloMinutos().toString() : "",
                    ConsultaPeriodicaCsvUtil.formatHorariosFixosExport(ag.horariosFixos()),
                    ag.periodo() != null ? ag.periodo().name() : "",
                    ConsultaPeriodicaCsvUtil.formatHora(ag.periodoHorario()),
                    ConsultaPeriodicaCsvUtil.formatHora(ag.janelaInicio()),
                    ConsultaPeriodicaCsvUtil.formatHora(ag.janelaFim()),
                    ConsultaPeriodicaCsvUtil.formatBoolean(ag.apenasDiasUteis()),
                    ConsultaPeriodicaCsvUtil.formatBoolean(ag.considerarFeriados()),
                    Integer.toString(ag.prioridade()),
                    ag.motivo(),
                    ConsultaPeriodicaCsvUtil.formatValidoAte(ag.validoAte()),
                    ConsultaPeriodicaCsvUtil.formatBoolean(ag.ativo()),
                    destinatarios);
        }
        return agendamentos.size();
    }

    private static String formatDestinatarios(
            List<ConsultaPeriodicaBackupExportLeitura.DadosDestinatarioExport> destinatarios) {
        if (destinatarios == null || destinatarios.isEmpty()) {
            return "";
        }
        return destinatarios.stream()
                .map(d -> d.canal().name() + ":" + d.valor())
                .collect(java.util.stream.Collectors.joining("|"));
    }

    public record ExportacaoCsv(byte[] conteudo, String nomeArquivo) {}
}
