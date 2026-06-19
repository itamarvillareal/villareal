package br.com.vilareal.agenda.application;

import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.julia.triagem.TriagemResultado;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import br.com.vilareal.usuario.model.TipoUsuario;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/** Lembrete de agenda para prazo fatal — extraído da encanação da Júlia para reuso. */
@Service
public class PrazoAgendaLembreteService {

    private static final Logger log = LoggerFactory.getLogger(PrazoAgendaLembreteService.class);
    private static final DateTimeFormatter FMT_DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final AgendaApplicationService agendaApplicationService;
    private final UsuarioRepository usuarioRepository;

    public PrazoAgendaLembreteService(
            AgendaApplicationService agendaApplicationService, UsuarioRepository usuarioRepository) {
        this.agendaApplicationService = agendaApplicationService;
        this.usuarioRepository = usuarioRepository;
    }

    public Long criarLembreteAgendaPrazo(
            ProcessoEntity processo,
            TriagemResultado.Prazo prazo,
            LocalDate dataReal,
            LocalDate dataTrabalho,
            UsuarioEntity destinatario,
            String origemAgenda) {
        String tipo = prazo != null && StringUtils.hasText(prazo.tipo()) ? prazo.tipo().trim() : "Prazo processual";
        return criarLembreteAgendaPrazo(processo, tipo, dataReal, dataTrabalho, destinatario, origemAgenda);
    }

    public Long criarLembreteAgendaPrazo(
            ProcessoEntity processo,
            String tipoPrazo,
            LocalDate dataReal,
            LocalDate dataTrabalho,
            UsuarioEntity destinatario,
            String origemAgenda) {
        String processoRef = montarProcessoRef(processo);
        if (!StringUtils.hasText(processoRef)) {
            throw new BusinessRuleException(
                    "Processo id="
                            + processo.getId()
                            + " sem código cliente/nº interno — não foi possível vincular lembrete na agenda.");
        }
        String tipo = StringUtils.hasText(tipoPrazo) ? tipoPrazo.trim() : "Prazo processual";
        String dataRealFmt = dataReal.format(FMT_DATA_BR);
        AgendaEventoWriteRequest req = new AgendaEventoWriteRequest();
        req.setUsuarioId(destinatario.getId());
        req.setDataEvento(dataTrabalho);
        req.setDescricao("Prazo se aproximando: " + tipo + " (fatal em " + dataRealFmt + ")");
        req.setProcessoRef(processoRef);
        req.setOrigem(origemAgenda);
        return agendaApplicationService.criar(req).getId();
    }

    public Optional<UsuarioEntity> resolverDestinatarioHumanoAgenda(ProcessoEntity processo) {
        UsuarioEntity responsavel = processo.getUsuarioResponsavel();
        if (responsavel != null) {
            if (responsavel.getTipo() == TipoUsuario.ASSISTENTE_IA) {
                log.warn(
                        "processoId={}: responsável é assistente IA — lembrete de agenda omitido",
                        processo.getId());
                return Optional.empty();
            }
            return Optional.of(responsavel);
        }

        Optional<UsuarioEntity> porConsultor = resolverHumanoPorConsultor(processo.getConsultor());
        if (porConsultor.isPresent()) {
            log.info(
                    "processoId={}: destinatário agenda resolvido via consultor \"{}\" → usuarioId={}",
                    processo.getId(),
                    processo.getConsultor(),
                    porConsultor.get().getId());
            return porConsultor;
        }

        log.warn(
                "processoId={}: sem responsável humano — lembrete de agenda omitido",
                processo.getId());
        return Optional.empty();
    }

    public static String montarProcessoRef(ProcessoEntity processo) {
        if (processo == null || processo.getNumeroInterno() == null || processo.getNumeroInterno() < 1) {
            return null;
        }
        String codigo = null;
        if (processo.getCliente() != null && StringUtils.hasText(processo.getCliente().getCodigoCliente())) {
            codigo = processo.getCliente().getCodigoCliente().trim();
        }
        if (!StringUtils.hasText(codigo)) {
            return null;
        }
        return codigo + "|" + processo.getNumeroInterno();
    }

    private Optional<UsuarioEntity> resolverHumanoPorConsultor(String consultor) {
        if (!StringUtils.hasText(consultor)) {
            return Optional.empty();
        }
        String nome = consultor.trim();
        Optional<UsuarioEntity> porLogin = usuarioRepository.findWithPerfilByLoginIgnoreCase(nome);
        if (porLogin.isPresent() && isHumanoAtivo(porLogin.get())) {
            return porLogin;
        }

        String loginGuess = nome.toLowerCase().replaceAll("\\s+", ".").replaceAll("[^a-z0-9.]", "");
        if (StringUtils.hasText(loginGuess)) {
            Optional<UsuarioEntity> porGuess = usuarioRepository.findWithPerfilByLoginIgnoreCase(loginGuess);
            if (porGuess.isPresent() && isHumanoAtivo(porGuess.get())) {
                return porGuess;
            }
        }

        String primeiroToken = nome.split("\\s+")[0];
        for (UsuarioEntity u : usuarioRepository.findColaboradoresHumanosAtivos()) {
            if (loginCorrespondeConsultor(u.getLogin(), nome, primeiroToken)) {
                return Optional.of(u);
            }
            if (StringUtils.hasText(u.getApelido()) && u.getApelido().trim().equalsIgnoreCase(nome)) {
                return Optional.of(u);
            }
        }
        return Optional.empty();
    }

    private static boolean isHumanoAtivo(UsuarioEntity u) {
        return u.getTipo() == TipoUsuario.HUMANO && Boolean.TRUE.equals(u.getAtivo());
    }

    private static boolean loginCorrespondeConsultor(String login, String consultor, String primeiroToken) {
        if (!StringUtils.hasText(login)) {
            return false;
        }
        String l = login.trim().toLowerCase();
        String c = consultor.trim().toLowerCase();
        String t = primeiroToken.trim().toLowerCase();
        if (l.equals(c)) {
            return true;
        }
        if (l.startsWith(t + ".") || l.equals(t)) {
            return true;
        }
        return l.replace(".", " ").equals(c);
    }
}
