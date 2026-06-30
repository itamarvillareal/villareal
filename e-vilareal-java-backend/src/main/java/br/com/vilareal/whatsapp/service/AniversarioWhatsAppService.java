package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.dto.AniversarioDTO;
import br.com.vilareal.whatsapp.dto.AniversarioStatsDTO;
import br.com.vilareal.whatsapp.dto.ProximoAniversarioDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.AniversarioWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.AniversarioWhatsAppRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AniversarioWhatsAppService {

    private static final Logger log = LoggerFactory.getLogger(AniversarioWhatsAppService.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final String TEMPLATE = WhatsAppTemplateService.TEMPLATE_ANIVERSARIO;

    private final WhatsAppConfig whatsAppConfig;
    private final PessoaRepository pessoaRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final AniversarioWhatsAppRepository aniversarioRepository;
    private final WhatsAppService whatsAppService;
    private final WhatsAppTemplateService whatsAppTemplateService;

    public AniversarioWhatsAppService(
            WhatsAppConfig whatsAppConfig,
            PessoaRepository pessoaRepository,
            PessoaContatoRepository pessoaContatoRepository,
            AniversarioWhatsAppRepository aniversarioRepository,
            WhatsAppService whatsAppService,
            WhatsAppTemplateService whatsAppTemplateService) {
        this.whatsAppConfig = whatsAppConfig;
        this.pessoaRepository = pessoaRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.aniversarioRepository = aniversarioRepository;
        this.whatsAppService = whatsAppService;
        this.whatsAppTemplateService = whatsAppTemplateService;
    }

    public record ExecucaoStats(int enviados, int semTelefone, int duplicados, int falhas) {}

    @Transactional(readOnly = true)
    public Page<AniversarioDTO> listar(int ano, Pageable pageable) {
        return aniversarioRepository.findByAnoEnvioOrderByCreatedAtDesc(ano, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public List<ProximoAniversarioDTO> listarProximos(int dias) {
        int limite = Math.max(1, Math.min(dias, 366));
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        int anoAtual = hoje.getYear();
        Map<Long, ProximoAniversarioDTO> porPessoa = new LinkedHashMap<>();

        for (int offset = 0; offset < limite; offset++) {
            LocalDate data = hoje.plusDays(offset);
            List<PessoaEntity> aniversariantes =
                    pessoaRepository.findAniversariantes(data.getDayOfMonth(), data.getMonthValue());
            for (PessoaEntity pessoa : aniversariantes) {
                if (pessoa == null || pessoa.getId() == null) {
                    continue;
                }
                String telefone = resolverTelefone(pessoa);
                boolean temTelefone = StringUtils.hasText(telefone);
                boolean jaEnviou = aniversarioRepository.existsByPessoaIdAndAnoEnvio(pessoa.getId(), anoAtual);
                porPessoa.putIfAbsent(
                        pessoa.getId(),
                        new ProximoAniversarioDTO(
                                pessoa.getId(),
                                nomePessoa(pessoa),
                                data.getDayOfMonth(),
                                data.getMonthValue(),
                                temTelefone ? telefone : null,
                                temTelefone,
                                jaEnviou,
                                offset));
            }
        }

        return porPessoa.values().stream()
                .sorted(Comparator.comparingInt(ProximoAniversarioDTO::diasParaAniversario)
                        .thenComparing(ProximoAniversarioDTO::pessoaNome, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional(readOnly = true)
    public AniversarioStatsDTO estatisticas() {
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        int ano = hoje.getYear();
        ZonedDateTime inicioMes = hoje.withDayOfMonth(1).atStartOfDay(ZONE_BRASILIA);
        ZonedDateTime inicioProximoMes = inicioMes.plusMonths(1);

        long enviadosAno = aniversarioRepository.countEnviadosComSucessoByAnoEnvio(ano);
        long enviadosMes = aniversarioRepository.countEnviadosEntre(
                inicioMes.toInstant(), inicioProximoMes.toInstant());

        List<ProximoAniversarioDTO> proximos7 = listarProximos(7);
        int proximosSeteDias = proximos7.size();
        int semTelefone = (int) proximos7.stream().filter(p -> !p.temTelefone()).count();

        return new AniversarioStatsDTO(enviadosAno, enviadosMes, proximosSeteDias, semTelefone);
    }

    @Transactional(noRollbackFor = {WhatsAppApiException.class, IllegalArgumentException.class})
    public AniversarioDTO enviarManual(Long pessoaId) {
        PessoaEntity pessoa = pessoaRepository
                .findById(pessoaId)
                .orElseThrow(() -> new IllegalArgumentException("Pessoa não encontrada: " + pessoaId));

        int anoEnvio = LocalDate.now(ZONE_BRASILIA).getYear();
        Optional<AniversarioWhatsAppEntity> existente =
                aniversarioRepository.findByPessoaIdAndAnoEnvio(pessoa.getId(), anoEnvio);
        if (existente.isPresent() && !"FAILED".equalsIgnoreCase(existente.get().getStatus())) {
            throw new IllegalStateException("Felicitação já enviada este ano para esta pessoa.");
        }

        return enviarParaPessoa(pessoa, anoEnvio, true);
    }

    public ExecucaoStats enviarFelicitacoesDoDia() {
        if (!whatsAppConfig.isAniversarioEnabled()) {
            log.debug("Job de aniversários WhatsApp desabilitado via configuração");
            return new ExecucaoStats(0, 0, 0, 0);
        }

        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        List<PessoaEntity> aniversariantes =
                pessoaRepository.findAniversariantes(hoje.getDayOfMonth(), hoje.getMonthValue());
        log.info(
                "Job aniversários: {} aniversariante(s) em {}/{}",
                aniversariantes.size(),
                hoje.getDayOfMonth(),
                hoje.getMonthValue());

        int enviados = 0;
        int semTelefone = 0;
        int duplicados = 0;
        int falhas = 0;

        for (PessoaEntity pessoa : aniversariantes) {
            try {
                ResultadoEnvio resultado = processarAniversariante(pessoa, hoje.getYear(), false);
                switch (resultado) {
                    case ENVIADO -> enviados++;
                    case SEM_TELEFONE -> semTelefone++;
                    case DUPLICADO -> duplicados++;
                    case FALHA -> falhas++;
                }
            } catch (Exception e) {
                falhas++;
                log.error(
                        "Erro ao processar aniversariante pessoa {}: {}",
                        pessoa != null ? pessoa.getId() : null,
                        e.getMessage(),
                        e);
            }
        }

        log.info(
                "Job de aniversários concluído: {} enviados, {} sem telefone, {} já enviados, {} falhas",
                enviados,
                semTelefone,
                duplicados,
                falhas);
        return new ExecucaoStats(enviados, semTelefone, duplicados, falhas);
    }

    private ResultadoEnvio processarAniversariante(PessoaEntity pessoa, int anoEnvio, boolean manual) {
        if (pessoa == null || pessoa.getId() == null) {
            return ResultadoEnvio.FALHA;
        }

        String telefone = resolverTelefone(pessoa);
        if (!StringUtils.hasText(telefone)) {
            log.warn("Aniversário: pessoa {} ({}) sem telefone. Pulando.", pessoa.getId(), nomePessoa(pessoa));
            return ResultadoEnvio.SEM_TELEFONE;
        }

        Optional<AniversarioWhatsAppEntity> existente =
                aniversarioRepository.findByPessoaIdAndAnoEnvio(pessoa.getId(), anoEnvio);
        if (existente.isPresent()) {
            String status = existente.get().getStatus();
            if ("FAILED".equalsIgnoreCase(status)) {
                // permite nova tentativa no job
            } else if (!manual) {
                log.debug("Felicitação já enviada para {} em {}", nomePessoa(pessoa), anoEnvio);
                return ResultadoEnvio.DUPLICADO;
            } else {
                throw new IllegalStateException("Felicitação já enviada este ano para esta pessoa.");
            }
        } else if (aniversarioRepository.existsByPessoaIdAndAnoEnvio(pessoa.getId(), anoEnvio)) {
            log.debug("Felicitação já enviada para {} em {}", nomePessoa(pessoa), anoEnvio);
            return ResultadoEnvio.DUPLICADO;
        }

        try {
            enviarParaPessoa(pessoa, anoEnvio, manual);
            return ResultadoEnvio.ENVIADO;
        } catch (Exception e) {
            log.error("Falha ao enviar felicitação para {}: {}", nomePessoa(pessoa), e.getMessage());
            return ResultadoEnvio.FALHA;
        }
    }

    private AniversarioDTO enviarParaPessoa(PessoaEntity pessoa, int anoEnvio, boolean manual) {
        String telefone = resolverTelefone(pessoa);
        if (!StringUtils.hasText(telefone)) {
            throw new IllegalArgumentException("Pessoa sem telefone cadastrado.");
        }

        String nome = nomePessoa(pessoa);
        String primeiroNome = extrairPrimeiroNome(nome);
        String telefoneFormatado = WhatsAppService.formatPhoneNumber(telefone);

        AniversarioWhatsAppEntity registro = aniversarioRepository
                .findByPessoaIdAndAnoEnvio(pessoa.getId(), anoEnvio)
                .orElseGet(AniversarioWhatsAppEntity::new);
        registro.setPessoaId(pessoa.getId());
        registro.setPessoaNome(nome);
        registro.setPhoneNumber(telefoneFormatado);
        registro.setDataAniversario(
                pessoa.getDataNascimento() != null ? pessoa.getDataNascimento() : LocalDate.now(ZONE_BRASILIA));
        registro.setAnoEnvio(anoEnvio);
        registro.setErrorMessage(null);

        validarTemplateAniversarioAprovado();

        try {
            WhatsAppSendResponse response = whatsAppService.sendTemplateMessage(
                    telefoneFormatado, TEMPLATE, "pt_BR", List.of(primeiroNome));
            registro.setWaMessageId(extrairMessageId(response));
            registro.setStatus("SENT");
            AniversarioWhatsAppEntity saved = aniversarioRepository.save(registro);
            log.info("Felicitação de aniversário enviada para {} ({})", nome, telefoneFormatado);
            return toDto(saved);
        } catch (WhatsAppApiException | IllegalArgumentException e) {
            registro.setStatus("FAILED");
            registro.setErrorMessage(resumirErro(e));
            aniversarioRepository.save(registro);
            throw e;
        }
    }

    private void validarTemplateAniversarioAprovado() {
        try {
            var templates = whatsAppTemplateService.listarTemplates();
            var template = templates.stream()
                    .filter(t -> TEMPLATE.equals(t.name()))
                    .findFirst();
            if (template.isEmpty()) {
                throw new IllegalStateException(
                        "Template \"" + TEMPLATE + "\" não encontrado na Meta. "
                                + "Aguarde a criação automática ou contate o administrador.");
            }
            String status = template.get().status();
            if (!"APPROVED".equalsIgnoreCase(status)) {
                throw new IllegalStateException(
                        "Template \"" + TEMPLATE + "\" ainda não foi aprovado pela Meta (status: "
                                + status + "). Envio só é possível após aprovação.");
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Não foi possível verificar template de aniversário: {}", e.getMessage());
        }
    }

    @Transactional
    public void atualizarStatusPorWaMessageId(String waMessageId, String status) {
        if (!StringUtils.hasText(waMessageId) || !StringUtils.hasText(status)) {
            return;
        }
        aniversarioRepository.findByWaMessageId(waMessageId).ifPresent(aniv -> {
            aniv.setStatus(status.trim().toUpperCase());
            aniversarioRepository.save(aniv);
            log.debug("Status aniversário atualizado: {} → {}", waMessageId, status);
        });
    }

    private String resolverTelefone(PessoaEntity pessoa) {
        List<PessoaContatoEntity> contatos = pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId());
        for (PessoaContatoEntity contato : contatos) {
            if (contato.getTipo() != null
                    && "telefone".equalsIgnoreCase(contato.getTipo().trim())
                    && StringUtils.hasText(contato.getValor())) {
                return contato.getValor().trim();
            }
        }
        if (StringUtils.hasText(pessoa.getTelefone())) {
            return pessoa.getTelefone().trim();
        }
        return null;
    }

    private static String nomePessoa(PessoaEntity pessoa) {
        return StringUtils.hasText(pessoa.getNome()) ? pessoa.getNome().trim() : "Aniversariante";
    }

    private static String extrairPrimeiroNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "Amigo(a)";
        }
        String[] partes = nome.trim().split("\\s+");
        return partes.length > 0 ? partes[0] : nome.trim();
    }

    private static String extrairMessageId(WhatsAppSendResponse response) {
        if (response == null || response.messages() == null || response.messages().isEmpty()) {
            return null;
        }
        return response.messages().getFirst().id();
    }

    private static String resumirErro(Exception e) {
        String msg = e.getMessage();
        if (!StringUtils.hasText(msg)) {
            return e.getClass().getSimpleName();
        }
        return msg.length() > 500 ? msg.substring(0, 497) + "..." : msg;
    }

    private AniversarioDTO toDto(AniversarioWhatsAppEntity entity) {
        return new AniversarioDTO(
                entity.getId(),
                entity.getPessoaId(),
                entity.getPessoaNome(),
                entity.getPhoneNumber(),
                entity.getDataAniversario(),
                entity.getAnoEnvio(),
                entity.getStatus(),
                entity.getErrorMessage(),
                entity.getCreatedAt());
    }

    private enum ResultadoEnvio {
        ENVIADO,
        SEM_TELEFONE,
        DUPLICADO,
        FALHA
    }
}
