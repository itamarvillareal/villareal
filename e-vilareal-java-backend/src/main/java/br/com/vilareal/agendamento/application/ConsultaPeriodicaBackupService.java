package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.RelatorioImportacaoConsultaPeriodica;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ConsultaPeriodicaBackupService {

    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final byte[] UTF8_BOM = new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final DateTimeFormatter NOME_ARQUIVO =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmm", Locale.ROOT);

    private final ProcessoRepository processoRepository;
    private final AgendamentoConsultaRepository agendamentoConsultaRepository;
    private final NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;
    private final ConsultaPeriodicaBackupImportador importador;
    private final Clock clock;

    public ConsultaPeriodicaBackupService(
            ProcessoRepository processoRepository,
            AgendamentoConsultaRepository agendamentoConsultaRepository,
            NotificacaoDestinatarioRepository notificacaoDestinatarioRepository,
            ConsultaPeriodicaBackupImportador importador,
            Clock clock) {
        this.processoRepository = processoRepository;
        this.agendamentoConsultaRepository = agendamentoConsultaRepository;
        this.notificacaoDestinatarioRepository = notificacaoDestinatarioRepository;
        this.importador = importador;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ExportacaoCsv exportar() {
        List<Long> ids = processoRepository.findIdsComConfigConsultaPeriodica();
        List<ProcessoExportacao> processos = new ArrayList<>();
        for (Long id : ids) {
            ProcessoEntity processo = processoRepository.findByIdWithClienteAndPessoa(id).orElse(null);
            if (processo == null) {
                continue;
            }
            List<AgendamentoConsultaEntity> agendamentos = agendamentoConsultaRepository.findByProcessoId(id);
            List<NotificacaoDestinatarioEntity> destinatarios =
                    notificacaoDestinatarioRepository.findByProcessoIdOrderByCanalAscIdAsc(id);
            processos.add(new ProcessoExportacao(processo, agendamentos, destinatarios));
        }
        processos.sort(Comparator.comparing(
                        (ProcessoExportacao p) ->
                                p.processo().getNumeroCnj() != null ? p.processo().getNumeroCnj() : "",
                        String.CASE_INSENSITIVE_ORDER)
                .thenComparing(p -> p.processo().getId()));

        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            buffer.write(UTF8_BOM);
            OutputStreamWriter writer = new OutputStreamWriter(buffer, StandardCharsets.UTF_8);
            CSVFormat format = CSVFormat.DEFAULT.builder()
                    .setDelimiter(ConsultaPeriodicaBackupCsv.DELIMITADOR)
                    .setRecordSeparator("\r\n")
                    .setHeader(ConsultaPeriodicaBackupCsv.HEADER)
                    .build();
            try (CSVPrinter printer = new CSVPrinter(writer, format)) {
                for (ProcessoExportacao pe : processos) {
                    escreverProcesso(printer, pe);
                }
            }
            String nomeArquivo = "consultas-periodicas-"
                    + clock.instant().atZone(clock.getZone()).format(NOME_ARQUIVO)
                    + ".csv";
            return new ExportacaoCsv(buffer.toByteArray(), nomeArquivo);
        } catch (IOException e) {
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

    private void escreverProcesso(CSVPrinter printer, ProcessoExportacao pe) throws IOException {
        ProcessoEntity processo = pe.processo();
        String numeroCnj = processo.getNumeroCnj() != null ? processo.getNumeroCnj() : "";
        String cliente = resolverNomeCliente(processo);
        boolean habilitada = Boolean.TRUE.equals(processo.getConsultaPeriodicaHabilitada());
        String destinatarios = ConsultaPeriodicaCsvUtil.formatDestinatarios(pe.destinatarios());

        List<AgendamentoConsultaEntity> agendamentos = pe.agendamentos();
        if (agendamentos.isEmpty()) {
            printer.printRecord(
                    numeroCnj,
                    cliente,
                    ConsultaPeriodicaCsvUtil.formatBoolean(habilitada),
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
            return;
        }

        for (AgendamentoConsultaEntity ag : agendamentos) {
            printer.printRecord(
                    numeroCnj,
                    cliente,
                    ConsultaPeriodicaCsvUtil.formatBoolean(habilitada),
                    ag.getTipoCadencia() != null ? ag.getTipoCadencia().name() : "",
                    ag.getIntervaloMinutos() != null ? ag.getIntervaloMinutos().toString() : "",
                    ConsultaPeriodicaCsvUtil.formatHorariosFixosExport(ag.getHorariosFixos()),
                    ag.getPeriodo() != null ? ag.getPeriodo().name() : "",
                    ConsultaPeriodicaCsvUtil.formatHora(ag.getPeriodoHorario()),
                    ConsultaPeriodicaCsvUtil.formatHora(ag.getJanelaInicio()),
                    ConsultaPeriodicaCsvUtil.formatHora(ag.getJanelaFim()),
                    ConsultaPeriodicaCsvUtil.formatBoolean(Boolean.TRUE.equals(ag.getApenasDiasUteis())),
                    ConsultaPeriodicaCsvUtil.formatBoolean(Boolean.TRUE.equals(ag.getConsiderarFeriados())),
                    ag.getPrioridade() != null ? ag.getPrioridade().toString() : "0",
                    ag.getMotivo() != null ? ag.getMotivo() : "",
                    ConsultaPeriodicaCsvUtil.formatValidoAte(ag.getValidoAte()),
                    ConsultaPeriodicaCsvUtil.formatBoolean(Boolean.TRUE.equals(ag.getAtivo())),
                    destinatarios);
        }
    }

    private static String resolverNomeCliente(ProcessoEntity processo) {
        ClienteEntity cliente = processo.getCliente();
        if (cliente == null) {
            return "";
        }
        if (StringUtils.hasText(cliente.getNomeReferencia())) {
            return cliente.getNomeReferencia();
        }
        PessoaEntity pessoa = cliente.getPessoa();
        return pessoa != null && pessoa.getNome() != null ? pessoa.getNome() : "";
    }

    public record ExportacaoCsv(byte[] conteudo, String nomeArquivo) {}

    private record ProcessoExportacao(
            ProcessoEntity processo,
            List<AgendamentoConsultaEntity> agendamentos,
            List<NotificacaoDestinatarioEntity> destinatarios) {}
}
