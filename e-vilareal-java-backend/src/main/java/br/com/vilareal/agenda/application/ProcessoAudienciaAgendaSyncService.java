package br.com.vilareal.agenda.application;

import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.infrastructure.persistence.repository.AgendaEventoRepository;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoPartesVinculoTextoResolver;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Espelha {@code processo.audiencia_*} na agenda ({@code agenda_evento}, origem {@code processos-audiencia})
 * para todos os colaboradores humanos ativos — fonte canônica no processo, réplica na agenda.
 */
@Service
public class ProcessoAudienciaAgendaSyncService {

    public static final String ORIGEM_PROCESSOS_AUDIENCIA = "processos-audiencia";

    private static final Logger log = LoggerFactory.getLogger(ProcessoAudienciaAgendaSyncService.class);

    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository parteRepository;
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;
    private final AgendaEventoRepository agendaEventoRepository;
    private final AgendaApplicationService agendaApplicationService;
    private final ProcessoAudienciaAgendaSyncService self;

    public ProcessoAudienciaAgendaSyncService(
            ProcessoRepository processoRepository,
            ProcessoParteRepository parteRepository,
            UsuarioRepository usuarioRepository,
            ClienteRepository clienteRepository,
            AgendaEventoRepository agendaEventoRepository,
            AgendaApplicationService agendaApplicationService,
            @Lazy ProcessoAudienciaAgendaSyncService self) {
        this.processoRepository = processoRepository;
        this.parteRepository = parteRepository;
        this.usuarioRepository = usuarioRepository;
        this.clienteRepository = clienteRepository;
        this.agendaEventoRepository = agendaEventoRepository;
        this.agendaApplicationService = agendaApplicationService;
        this.self = self;
    }

    public record SyncResult(int colaboradoresSincronizados, int eventosRemovidos, boolean audienciaRemovida) {
        public static SyncResult removida(int removidos) {
            return new SyncResult(0, removidos, true);
        }

        public static SyncResult espelhada(int colaboradores) {
            return new SyncResult(colaboradores, 0, false);
        }

        public static SyncResult ignorada() {
            return new SyncResult(0, 0, false);
        }
    }

    public record BackfillResult(
            int processosProcessados, int colaboradoresSincronizados, int eventosRemovidos, int falhas) {}

    @Transactional
    public SyncResult sincronizarProcesso(Long processoId) {
        ProcessoEntity processo = processoRepository
                .findByIdDetalhado(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        return sincronizarProcesso(processo);
    }

    @Transactional
    public SyncResult sincronizarProcesso(ProcessoEntity processo) {
        if (processo == null || processo.getId() == null) {
            return SyncResult.ignorada();
        }
        String processoRef = montarProcessoRefAgenda(processo);
        if (!StringUtils.hasText(processoRef)) {
            log.warn(
                    "Audiência agenda: processoId={} sem código cliente/nº interno — espelhamento omitido",
                    processo.getId());
            return SyncResult.ignorada();
        }

        if (processo.getAudienciaData() == null) {
            int removidos =
                    agendaApplicationService.excluirPorProcessoRefEOrigem(processoRef, ORIGEM_PROCESSOS_AUDIENCIA);
            if (removidos > 0) {
                log.info(
                        "Audiência agenda: processoId={} ref={} — {} evento(s) removido(s)",
                        processo.getId(),
                        processoRef,
                        removidos);
            }
            return SyncResult.removida(removidos);
        }

        List<ProcessoParteEntity> partes =
                parteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processo.getId());
        String descricao = montarDescricaoAgendaAudiencia(processo, partes);
        String hora = processo.getAudienciaHora();
        int ok = 0;
        for (UsuarioEntity u : usuarioRepository.findColaboradoresHumanosAtivos()) {
            if (u == null || u.getId() == null) {
                continue;
            }
            try {
                AgendaEventoWriteRequest req = new AgendaEventoWriteRequest();
                req.setUsuarioId(u.getId());
                req.setDataEvento(processo.getAudienciaData());
                req.setHoraEvento(hora);
                req.setDescricao(descricao);
                req.setProcessoRef(processoRef);
                req.setOrigem(ORIGEM_PROCESSOS_AUDIENCIA);
                self.upsertAudienciaColaboradorIsolado(req);
                ok++;
            } catch (Exception e) {
                log.warn(
                        "Audiência agenda: falha upsert processoId={} usuarioId={}: {}",
                        processo.getId(),
                        u.getId(),
                        e.getMessage());
            }
        }
        if (ok > 0) {
            log.debug(
                    "Audiência agenda: processoId={} ref={} data={} — {} colaborador(es)",
                    processo.getId(),
                    processoRef,
                    processo.getAudienciaData(),
                    ok);
        }
        return SyncResult.espelhada(ok);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SyncResult sincronizarProcessoIsolado(Long processoId) {
        return sincronizarProcesso(processoId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void upsertAudienciaColaboradorIsolado(AgendaEventoWriteRequest req) {
        agendaApplicationService.upsertAudiencia(req);
    }

    @Transactional
    public BackfillResult backfillPeriodo(LocalDate inicio, LocalDate fim) {
        LocalDate de = inicio != null ? inicio : LocalDate.of(2000, 1, 1);
        LocalDate ate = fim != null ? fim : LocalDate.of(2100, 12, 31);
        List<ProcessoEntity> processos = processoRepository.findAudienciasEntre(de, ate);
        return executarBackfill(processos);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public BackfillResult backfillTodosAtivosComAudiencia() {
        int orfaosRemovidos = limparEventosAudienciaOrfaos();
        BackfillResult r = executarBackfill(processoRepository.findAtivosComAudienciaData());
        return new BackfillResult(
                r.processosProcessados(),
                r.colaboradoresSincronizados(),
                r.eventosRemovidos() + orfaosRemovidos,
                r.falhas());
    }

    /** Remove eventos de audiência cujo processo não existe mais ou não tem audiência agendada. */
    @Transactional
    public int limparEventosAudienciaOrfaos() {
        int removidos = 0;
        for (String ref : agendaEventoRepository.findDistinctProcessoRefByOrigem(ORIGEM_PROCESSOS_AUDIENCIA)) {
            if (!StringUtils.hasText(ref)) {
                continue;
            }
            if (processoComAudienciaPorRef(ref).isEmpty()) {
                int n = agendaApplicationService.excluirPorProcessoRefEOrigem(ref.trim(), ORIGEM_PROCESSOS_AUDIENCIA);
                if (n > 0) {
                    log.info("Audiência agenda: órfãos removidos ref={} eventos={}", ref, n);
                    removidos += n;
                }
            }
        }
        return removidos;
    }

    private java.util.Optional<ProcessoEntity> processoComAudienciaPorRef(String processoRef) {
        int pipe = processoRef.indexOf('|');
        if (pipe <= 0 || pipe >= processoRef.length() - 1) {
            return java.util.Optional.empty();
        }
        String codigoRaw = processoRef.substring(0, pipe).trim();
        String numRaw = processoRef.substring(pipe + 1).trim();
        int numeroInterno;
        try {
            numeroInterno = Integer.parseInt(numRaw);
        } catch (NumberFormatException e) {
            return java.util.Optional.empty();
        }
        if (numeroInterno < 1) {
            return java.util.Optional.empty();
        }
        String codigo = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoRaw);
        if (!StringUtils.hasText(codigo)) {
            return java.util.Optional.empty();
        }
        return clienteRepository
                .findByCodigoClienteFetchPessoaTrim(codigo)
                .flatMap(c -> processoRepository.findByCliente_IdAndNumeroInterno(c.getId(), numeroInterno))
                .filter(p -> Boolean.TRUE.equals(p.getAtivo()) && p.getAudienciaData() != null);
    }

    private BackfillResult executarBackfill(List<ProcessoEntity> processos) {
        int processados = 0;
        int colaboradores = 0;
        int removidos = 0;
        int falhas = 0;
        for (ProcessoEntity p : processos) {
            try {
                SyncResult r = self.sincronizarProcessoIsolado(p.getId());
                processados++;
                colaboradores += r.colaboradoresSincronizados();
                removidos += r.eventosRemovidos();
            } catch (Exception e) {
                falhas++;
                log.warn("Backfill audiência agenda: falha processoId={}: {}", p.getId(), e.getMessage());
            }
        }
        return new BackfillResult(processados, colaboradores, removidos, falhas);
    }

    /** Formato alinhado ao front ({@code montarDescricaoAgendaAudienciaProcesso}). */
    public static String montarDescricaoAgendaAudiencia(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        String tipo =
                StringUtils.hasText(processo.getAudienciaTipo()) ? processo.getAudienciaTipo().trim() : "Audiência";
        String cli = ProcessoPartesVinculoTextoResolver.parteCliente(processo, partes);
        if (!StringUtils.hasText(cli)) {
            cli = "CLIENTE";
        }
        String reu = ProcessoPartesVinculoTextoResolver.parteOposta(processo, partes);
        if (!StringUtils.hasText(reu)) {
            reu = "PARTE OPOSTA";
        }
        String autos = formatarResumoCnjParaLinhaAgenda(processo.getNumeroCnj());
        StringBuilder sb = new StringBuilder();
        sb.append(tipo).append(" (").append(cli.trim()).append(" x ").append(reu.trim()).append(") Autos nº ").append(autos);
        String comp = processo.getCompetencia();
        if (StringUtils.hasText(comp)) {
            String c = comp.trim();
            if (!c.toLowerCase(Locale.ROOT).startsWith("no ")) {
                c = "no " + c;
            }
            sb.append(", ").append(c);
        }
        return sb.toString();
    }

    public static String montarProcessoRefAgenda(ProcessoEntity processo) {
        if (processo == null || processo.getNumeroInterno() == null || processo.getNumeroInterno() < 1) {
            return null;
        }
        if (processo.getCliente() == null || !StringUtils.hasText(processo.getCliente().getCodigoCliente())) {
            return null;
        }
        String codigo =
                CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(processo.getCliente().getCodigoCliente());
        if (!StringUtils.hasText(codigo)) {
            return null;
        }
        return codigo + "|" + processo.getNumeroInterno();
    }

    public static String formatarResumoCnjParaLinhaAgenda(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "s/n";
        }
        String digitos = raw.replaceAll("\\D", "");
        if (digitos.length() >= 13) {
            return digitos.substring(0, 7) + "." + digitos.substring(7, 9) + "." + digitos.substring(9, 13);
        }
        String s = raw.trim();
        var m = java.util.regex.Pattern.compile("^(\\d{7})-(\\d{2})\\.(\\d{4})\\b").matcher(s);
        if (m.find()) {
            return m.group(1) + "." + m.group(2) + "." + m.group(3);
        }
        return s;
    }
}
