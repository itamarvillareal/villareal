package br.com.vilareal.whatsapp.service;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.pessoa.application.TelefoneCadastroNormalizacaoService;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.AgendarCobrancaResultDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.ClienteEscritorioCobrancaDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaItemDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResultDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResumoDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaHistoricoItemDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaPreviewDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaStatsDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CondominioResumoDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository.LoteResumoRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CobrancaWhatsAppService {

    public static final String TEMPLATE_COBRANCA = "cobranca_pagamento";

    private static final Logger log = LoggerFactory.getLogger(CobrancaWhatsAppService.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final NumberFormat MOEDA_BR = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
    private static final long DELAY_ENTRE_ENVIOS_MS = 200L;

    private static Instant inicioMesInstant(int ano, int mes) {
        return LocalDate.of(ano, mes, 1).atStartOfDay(ZONE_BRASILIA).toInstant();
    }

    private static Instant fimMesInstant(int ano, int mes) {
        return LocalDate.of(ano, mes, 1).plusMonths(1).atStartOfDay(ZONE_BRASILIA).toInstant();
    }

    private final CobrancaWhatsAppRepository cobrancaRepository;
    private final ImovelRepository imovelRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final ClienteRepository clienteRepository;
    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final PessoaRepository pessoaRepository;
    private final WhatsAppService whatsAppService;
    private final WhatsAppTemplateService whatsAppTemplateService;
    private final TelefoneCadastroNormalizacaoService telefoneCadastroNormalizacaoService;
    private final CobrancaWhatsAppElegibilidadeService cobrancaWhatsAppElegibilidadeService;

    public CobrancaWhatsAppService(
            CobrancaWhatsAppRepository cobrancaRepository,
            ImovelRepository imovelRepository,
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            ClienteRepository clienteRepository,
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            PessoaContatoRepository pessoaContatoRepository,
            PessoaRepository pessoaRepository,
            WhatsAppService whatsAppService,
            WhatsAppTemplateService whatsAppTemplateService,
            TelefoneCadastroNormalizacaoService telefoneCadastroNormalizacaoService,
            CobrancaWhatsAppElegibilidadeService cobrancaWhatsAppElegibilidadeService) {
        this.cobrancaRepository = cobrancaRepository;
        this.imovelRepository = imovelRepository;
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.clienteRepository = clienteRepository;
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.pessoaRepository = pessoaRepository;
        this.whatsAppService = whatsAppService;
        this.whatsAppTemplateService = whatsAppTemplateService;
        this.telefoneCadastroNormalizacaoService = telefoneCadastroNormalizacaoService;
        this.cobrancaWhatsAppElegibilidadeService = cobrancaWhatsAppElegibilidadeService;
    }

    public List<CondominioResumoDTO> listarCondominios() {
        List<Object[]> rows = imovelRepository.findCondominiosDistinctComContagem();
        List<CondominioResumoDTO> out = new ArrayList<>();
        long seq = 1L;
        for (Object[] row : rows) {
            String nome = row[0] != null ? row[0].toString().trim() : "";
            if (!StringUtils.hasText(nome)) {
                continue;
            }
            long total = row[1] instanceof Number n ? n.longValue() : 0L;
            out.add(new CondominioResumoDTO(seq++, nome, total));
        }
        return out;
    }

    public List<ClienteEscritorioCobrancaDTO> listarClientesEscritorioCobranca() {
        List<ClienteEscritorioCobrancaDTO> out = new ArrayList<>();
        for (Object[] row : processoRepository.findClientesEscritorioComProcessosUnidade()) {
            String cod = row[0] != null ? row[0].toString().trim() : "";
            String nome = row[1] != null ? row[1].toString().trim() : "";
            long total = row[2] instanceof Number n ? n.longValue() : 0L;
            if (!StringUtils.hasText(cod)) {
                continue;
            }
            out.add(new ClienteEscritorioCobrancaDTO(cod, nome, total));
        }
        return out;
    }

    /**
     * Unidades vinculadas a processos do cliente do escritório, com réu e telefone.
     * Exige pendência no cálculo (débito ou parcela em aberto) para {@code elegivelCobranca=true}.
     */
    @Transactional(readOnly = true)
    public List<CobrancaPreviewDTO> buscarProcessosParaCobranca(String codigoClienteRaw) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoClienteRaw);
        List<ProcessoEntity> processos = processoRepository.findAtivosComUnidadeByClienteCodigo(cod8);
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        int ano = hoje.getYear();
        int mes = hoje.getMonthValue();
        Instant inicioMes = inicioMesInstant(ano, mes);
        Instant fimMes = fimMesInstant(ano, mes);
        String nomeEscritorio = processos.stream()
                .map(ProcessoEntity::getCliente)
                .filter(c -> c != null && c.getPessoa() != null && StringUtils.hasText(c.getPessoa().getNome()))
                .map(c -> c.getPessoa().getNome().trim())
                .findFirst()
                .orElse("Condomínio");

        List<CobrancaPreviewDTO> previews = new ArrayList<>();
        for (ProcessoEntity processo : processos) {
            List<ProcessoParteEntity> reus =
                    processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(processo.getId());
            ProcessoParteEntity reuParte = escolherReuParaCobranca(reus);
            if (reuParte == null) {
                continue;
            }
            PessoaEntity pessoa = reuParte.getPessoa();
            String pessoaNome = pessoa != null && StringUtils.hasText(pessoa.getNome())
                    ? pessoa.getNome().trim()
                    : StringUtils.hasText(reuParte.getNomeLivre()) ? reuParte.getNomeLivre().trim() : "Cliente";
            Long pessoaId = pessoa != null ? pessoa.getId() : null;
            Long devedorClienteId = pessoa != null
                    ? clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoa.getId()).stream()
                            .findFirst()
                            .map(ClienteEntity::getId)
                            .orElse(null)
                    : null;
            String telefone = pessoaId != null ? resolverTelefonePessoa(pessoaId, devedorClienteId) : null;
            boolean temTelefone = StringUtils.hasText(telefone);
            String telefoneFormatado = temTelefone ? WhatsAppService.formatPhoneDisplay(telefone) : null;
            String unidadeDescricao = montarUnidadeDescricao(processo.getUnidade());
            CobrancaWhatsAppElegibilidadeService.Avaliacao avaliacao =
                    cobrancaWhatsAppElegibilidadeService.avaliarProcessoEscritorio(cod8, processo.getNumeroInterno());
            BigDecimal valorPendente = avaliacao.valorDebitoAberto();
            boolean jaCobrado = cobrancaRepository.existsCobrancaNoMesPorProcesso(processo.getId(), inicioMes, fimMes);

            ClienteEntity clienteEscritorio = processo.getCliente();
            Long clienteEscritorioId = clienteEscritorio != null ? clienteEscritorio.getId() : null;

            previews.add(new CobrancaPreviewDTO(
                    null,
                    clienteEscritorioId,
                    pessoaId,
                    pessoaNome,
                    telefone,
                    telefoneFormatado,
                    temTelefone,
                    nomeEscritorio,
                    unidadeDescricao,
                    processo.getId(),
                    valorPendente,
                    MOEDA_BR.format(valorPendente),
                    jaCobrado,
                    "PROCESSO",
                    processo.getNumeroInterno(),
                    cod8,
                    nomeEscritorio,
                    avaliacao.elegivelCobranca(),
                    avaliacao.motivoInelegivel(),
                    avaliacao.calculoDesatualizado(),
                    avaliacao.dataCalculo(),
                    avaliacao.debitosAbertos(),
                    avaliacao.parcelasAbertas(),
                    List.of()));
        }
        return enriquecerPreviewComHistorico(previews);
    }

    private static ProcessoParteEntity escolherReuParaCobranca(List<ProcessoParteEntity> reus) {
        if (reus == null || reus.isEmpty()) {
            return null;
        }
        for (ProcessoParteEntity p : reus) {
            if (p.getPessoa() != null && StringUtils.hasText(p.getPessoa().getNome())) {
                return p;
            }
        }
        return reus.getFirst();
    }

    @Transactional(readOnly = true)
    public List<CobrancaPreviewDTO> buscarImoveisParaCobranca(String condominioNome, Long clienteId) {
        String condominioFiltro = StringUtils.hasText(condominioNome) ? condominioNome.trim() : null;
        List<ImovelEntity> imoveis = imovelRepository.findForCobrancaPreview(condominioFiltro, clienteId);
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        int ano = hoje.getYear();
        int mes = hoje.getMonthValue();
        Instant inicioMes = inicioMesInstant(ano, mes);
        Instant fimMes = fimMesInstant(ano, mes);

        List<CobrancaPreviewDTO> previews = new ArrayList<>();
        for (ImovelEntity imovel : imoveis) {
            ClienteEntity cliente = imovel.getCliente();
            if (cliente == null) {
                continue;
            }
            Long imovelId = imovel.getId();
            Long cid = cliente.getId();
            CobrancaWhatsAppElegibilidadeService.Avaliacao avaliacao =
                    cobrancaWhatsAppElegibilidadeService.avaliarImovel(imovelId, cid);
            if (!avaliacao.elegivelCobranca()) {
                continue;
            }
            BigDecimal valorPendente = avaliacao.valorDebitoAberto();

            PessoaEntity pessoa = cliente.getPessoa();
            String pessoaNome = pessoa != null && StringUtils.hasText(pessoa.getNome())
                    ? pessoa.getNome().trim()
                    : "Cliente";
            Long pessoaId = pessoa != null ? pessoa.getId() : null;
            String telefone = resolverTelefoneCliente(cliente.getId());
            boolean temTelefone = StringUtils.hasText(telefone);
            String telefoneFormatado = temTelefone ? WhatsAppService.formatPhoneDisplay(telefone) : null;
            String condominio = StringUtils.hasText(imovel.getCondominio()) ? imovel.getCondominio().trim() : "";
            String unidadeDescricao = montarUnidadeDescricao(imovel.getUnidade());
            ProcessoEntity processo = imovel.getProcesso();
            Long processoId = processo != null ? processo.getId() : null;
            boolean jaCobrado = cobrancaRepository.existsCobrancaNoMes(imovelId, inicioMes, fimMes);

            previews.add(new CobrancaPreviewDTO(
                    imovelId,
                    cid,
                    pessoaId,
                    pessoaNome,
                    telefone,
                    telefoneFormatado,
                    temTelefone,
                    condominio,
                    unidadeDescricao,
                    processoId,
                    valorPendente,
                    MOEDA_BR.format(valorPendente),
                    jaCobrado,
                    "IMOVEL",
                    processo != null ? processo.getNumeroInterno() : null,
                    null,
                    null,
                    avaliacao.elegivelCobranca(),
                    avaliacao.motivoInelegivel(),
                    avaliacao.calculoDesatualizado(),
                    avaliacao.dataCalculo(),
                    avaliacao.debitosAbertos(),
                    avaliacao.parcelasAbertas(),
                    List.of()));
        }
        return enriquecerPreviewComHistorico(previews);
    }

    @Transactional
    public CobrancaLoteResultDTO dispararLote(List<CobrancaItemDTO> itens, String loteDescricao, String createdBy) {
        return dispararLote(itens, loteDescricao, createdBy, true);
    }

    /**
     * @param verificarElegibilidade quando {@code false}, pula a elegibilidade condominial
     *     (cálculo/recebíveis) — usado pela cobrança de ALUGUEL, cuja elegibilidade é o próprio
     *     atraso apurado pela reconciliação de locação.
     */
    @Transactional
    public CobrancaLoteResultDTO dispararLote(
            List<CobrancaItemDTO> itens, String loteDescricao, String createdBy, boolean verificarElegibilidade) {
        validarTemplateCobrancaAprovado();
        if (itens == null || itens.isEmpty()) {
            throw new IllegalArgumentException("Selecione ao menos uma unidade para cobrança.");
        }

        String loteId = UUID.randomUUID().toString();
        int enviados = 0;
        int falhos = 0;
        int semTelefone = 0;
        int jaCobrados = 0;
        int puladosInelegiveis = 0;

        for (CobrancaItemDTO item : itens) {
            if (item == null) {
                continue;
            }
            Optional<String> inelegivel = verificarElegibilidade ? motivoInelegivelEnvio(item) : Optional.empty();
            if (inelegivel.isPresent()) {
                puladosInelegiveis++;
                salvarFalha(loteId, loteDescricao, item, createdBy, inelegivel.get(), item.telefone());
                continue;
            }
            if (!StringUtils.hasText(item.telefone())) {
                semTelefone++;
                salvarFalha(loteId, loteDescricao, item, createdBy, "Sem telefone cadastrado", null);
                continue;
            }

            try {
                String phone = resolverTelefoneNormalizado(item)
                        .orElseThrow(() -> new IllegalArgumentException("Telefone inválido"));
                String primeiroNome = extrairPrimeiroNome(item.pessoaNome());
                Long clienteVinculoId = resolverClienteIdVinculo(item);
                WhatsAppSendResponse response = whatsAppService.sendTemplateMessage(
                        phone,
                        TEMPLATE_COBRANCA,
                        "pt_BR",
                        List.of(primeiroNome, item.unidadeDescricao(), item.condominioNome()),
                        clienteVinculoId,
                        item.processoId());

                CobrancaWhatsAppEntity cobranca = montarEntidade(loteId, loteDescricao, item, createdBy);
                cobranca.setPhoneNumber(phone);
                cobranca.setStatus("ENVIADO");
                cobranca.setWaMessageId(extractMessageId(response));
                cobranca.setEnviadoAt(Instant.now());
                cobrancaRepository.save(cobranca);
                enviados++;
            } catch (Exception e) {
                falhos++;
                String msg = e instanceof WhatsAppApiException wae
                        ? wae.getMessage()
                        : (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                salvarFalha(loteId, loteDescricao, item, createdBy, msg, item.telefone(), item.pessoaId(), item.clienteId());
                log.warn(
                        "Falha ao enviar cobrança WhatsApp imóvel {}: {}",
                        item.imovelId(),
                        msg);
            }

            try {
                Thread.sleep(DELAY_ENTRE_ENVIOS_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        return new CobrancaLoteResultDTO(loteId, itens.size(), enviados, falhos, semTelefone, jaCobrados, puladosInelegiveis);
    }

    @Transactional
    public AgendarCobrancaResultDTO agendarLote(
            List<CobrancaItemDTO> itens, String loteDescricao, Instant scheduledAt, String createdBy) {
        return agendarLote(itens, loteDescricao, scheduledAt, createdBy, true);
    }

    /**
     * @param verificarElegibilidade quando {@code false}, pula elegibilidade condominial — usado por
     *     cobrança de ALUGUEL.
     */
    @Transactional
    public AgendarCobrancaResultDTO agendarLote(
            List<CobrancaItemDTO> itens,
            String loteDescricao,
            Instant scheduledAt,
            String createdBy,
            boolean verificarElegibilidade) {
        validarTemplateCobrancaAprovado();
        if (itens == null || itens.isEmpty()) {
            throw new IllegalArgumentException("Selecione ao menos uma unidade para cobrança.");
        }
        if (scheduledAt == null || !scheduledAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Informe data e hora de envio no futuro.");
        }

        String loteId = UUID.randomUUID().toString();
        int agendados = 0;
        int semTelefone = 0;
        int puladosInelegiveis = 0;

        for (CobrancaItemDTO item : itens) {
            if (item == null) {
                continue;
            }
            Optional<String> inelegivel =
                    verificarElegibilidade ? motivoInelegivelEnvio(item) : Optional.empty();
            if (inelegivel.isPresent()) {
                puladosInelegiveis++;
                salvarAgendamentoFalha(
                        loteId, loteDescricao, item, createdBy, scheduledAt, inelegivel.get(), item.telefone());
                continue;
            }
            if (!StringUtils.hasText(item.telefone())) {
                semTelefone++;
                salvarAgendamentoFalha(loteId, loteDescricao, item, createdBy, scheduledAt, "Sem telefone cadastrado", null);
                continue;
            }
            Optional<String> phoneOpt = resolverTelefoneNormalizado(item);
            if (phoneOpt.isEmpty()) {
                semTelefone++;
                salvarAgendamentoFalha(
                        loteId, loteDescricao, item, createdBy, scheduledAt, "Telefone inválido", item.telefone(), item.pessoaId(), item.clienteId());
                continue;
            }
            CobrancaWhatsAppEntity cobranca = montarEntidade(loteId, loteDescricao, item, createdBy);
            cobranca.setPhoneNumber(phoneOpt.get());
            cobranca.setStatus("AGENDADO");
            cobranca.setScheduledAt(scheduledAt);
            cobrancaRepository.save(cobranca);
            agendados++;
        }

        return new AgendarCobrancaResultDTO(loteId, itens.size(), agendados, semTelefone, puladosInelegiveis, scheduledAt);
    }

    @Transactional
    public int cancelarLoteAgendado(String loteId) {
        List<CobrancaWhatsAppEntity> rows = cobrancaRepository.findByLoteIdAndStatus(loteId, "AGENDADO");
        int n = 0;
        for (CobrancaWhatsAppEntity c : rows) {
            c.setStatus("CANCELADO");
            cobrancaRepository.save(c);
            n++;
        }
        return n;
    }

    @Transactional
    public void cancelarItemAgendado(Long cobrancaId) {
        CobrancaWhatsAppEntity cobranca = cobrancaRepository
                .findById(cobrancaId)
                .orElseThrow(() -> new IllegalArgumentException("Cobrança agendada não encontrada."));
        if (!"AGENDADO".equalsIgnoreCase(cobranca.getStatus())) {
            throw new IllegalStateException("Somente cobranças com status AGENDADO podem ser canceladas.");
        }
        cobranca.setStatus("CANCELADO");
        cobrancaRepository.save(cobranca);
    }

    @Scheduled(fixedRate = 60_000)
    public void processarCobrancasAgendadasTick() {
        try {
            processarCobrancasAgendadas();
        } catch (Exception e) {
            log.warn("Falha ao processar cobranças agendadas: {}", e.getMessage());
        }
    }

    @Transactional
    public void processarCobrancasAgendadas() {
        List<CobrancaWhatsAppEntity> due =
                cobrancaRepository.findByStatusAndScheduledAtLessThanEqualOrderByScheduledAtAsc(
                        "AGENDADO", Instant.now());
        if (due.isEmpty()) {
            return;
        }
        validarTemplateCobrancaAprovado();
        for (CobrancaWhatsAppEntity cobranca : due) {
            enviarCobrancaAgendada(cobranca);
        }
    }

    private void enviarCobrancaAgendada(CobrancaWhatsAppEntity cobranca) {
        Optional<String> inelegivel = cobrancaWhatsAppElegibilidadeService.motivoInelegivelEnvio(
                cobranca.getImovelId(), cobranca.getProcessoId(), cobranca.getClienteId());
        if (inelegivel.isPresent()) {
            cobranca.setStatus("FALHOU");
            cobranca.setErrorMessage(inelegivel.get());
            cobrancaRepository.save(cobranca);
            log.warn(
                    "Cobrança agendada id={} bloqueada: {}",
                    cobranca.getId(),
                    cobranca.getErrorMessage());
            return;
        }
        try {
            String primeiroNome = extrairPrimeiroNome(cobranca.getPessoaNome());
            WhatsAppSendResponse response = whatsAppService.sendTemplateMessage(
                    cobranca.getPhoneNumber(),
                    TEMPLATE_COBRANCA,
                    "pt_BR",
                    List.of(primeiroNome, cobranca.getUnidadeDescricao(), cobranca.getCondominioNome()),
                    cobranca.getClienteId(),
                    cobranca.getProcessoId());
            cobranca.setStatus("ENVIADO");
            cobranca.setWaMessageId(extractMessageId(response));
            cobranca.setErrorMessage(null);
            cobranca.setEnviadoAt(Instant.now());
            cobrancaRepository.save(cobranca);
        } catch (Exception e) {
            cobranca.setStatus("FALHOU");
            cobranca.setErrorMessage(
                    e instanceof WhatsAppApiException wae
                            ? wae.getMessage()
                            : (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
            cobrancaRepository.save(cobranca);
            log.warn("Falha ao enviar cobrança agendada id={}: {}", cobranca.getId(), cobranca.getErrorMessage());
        }
        try {
            Thread.sleep(DELAY_ENTRE_ENVIOS_MS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    @Transactional
    public int reenviarFalhas(String loteId) {
        validarTemplateCobrancaAprovado();
        List<CobrancaWhatsAppEntity> falhas = cobrancaRepository.findByLoteIdAndStatus(loteId, "FALHOU");
        int reenviados = 0;
        for (CobrancaWhatsAppEntity cobranca : falhas) {
            try {
                String primeiroNome = extrairPrimeiroNome(cobranca.getPessoaNome());
                WhatsAppSendResponse response = whatsAppService.sendTemplateMessage(
                        cobranca.getPhoneNumber(),
                        TEMPLATE_COBRANCA,
                        "pt_BR",
                        List.of(
                                primeiroNome,
                                cobranca.getUnidadeDescricao(),
                                cobranca.getCondominioNome()),
                        cobranca.getClienteId(),
                        cobranca.getProcessoId());
                cobranca.setStatus("ENVIADO");
                cobranca.setWaMessageId(extractMessageId(response));
                cobranca.setErrorMessage(null);
                cobranca.setEnviadoAt(Instant.now());
                cobrancaRepository.save(cobranca);
                reenviados++;
                Thread.sleep(DELAY_ENTRE_ENVIOS_MS);
            } catch (Exception e) {
                cobranca.setErrorMessage(e.getMessage());
                cobrancaRepository.save(cobranca);
            }
        }
        return reenviados;
    }

    @Transactional(readOnly = true)
    public List<CobrancaHistoricoItemDTO> listarHistoricoProcesso(Long processoId) {
        if (processoId == null || processoId <= 0) {
            return List.of();
        }
        return cobrancaRepository
                .findByProcessoIdAndStatusNotOrderByCreatedAtDesc(processoId, "CANCELADO")
                .stream()
                .map(this::toHistoricoItem)
                .toList();
    }

    public Page<CobrancaLoteResumoDTO> listarLotes(Pageable pageable) {
        return cobrancaRepository.findLotesResumo(pageable).map(this::toLoteResumo);
    }

    public List<CobrancaDTO> detalhesLote(String loteId) {
        List<CobrancaWhatsAppEntity> rows = cobrancaRepository.findByLoteIdOrderByPessoaNomeAsc(loteId);
        Map<Long, Integer> numeroPorProcesso = numerosInternosPorProcesso(rows);
        return rows.stream().map(e -> toDto(e, numeroPorProcesso.get(e.getProcessoId()))).toList();
    }

    public CobrancaStatsDTO statsDoMes() {
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        Instant inicioMes = inicioMesInstant(hoje.getYear(), hoje.getMonthValue());
        Instant fimMes = fimMesInstant(hoje.getYear(), hoje.getMonthValue());
        Object[] row = cobrancaRepository.statsDoMes(inicioMes, fimMes);
        long enviadas = 0L;
        long entregues = 0L;
        BigDecimal valor = BigDecimal.ZERO;
        if (row != null && row.length > 0 && row[0] instanceof Number n0) {
            enviadas = n0.longValue();
        }
        if (row != null && row.length > 1 && row[1] instanceof Number n1) {
            entregues = n1.longValue();
        }
        if (row != null && row.length > 2 && row[2] instanceof BigDecimal bd) {
            valor = bd;
        } else if (row != null && row.length > 2 && row[2] instanceof Number n2) {
            valor = BigDecimal.valueOf(n2.doubleValue());
        }
        double taxa = enviadas > 0 ? (entregues * 100.0 / enviadas) : 0.0;
        return new CobrancaStatsDTO(enviadas, entregues, valor, taxa);
    }

    public static String mapWebhookStatus(String webhookStatus) {
        if (!StringUtils.hasText(webhookStatus)) {
            return null;
        }
        return switch (webhookStatus.trim().toLowerCase(Locale.ROOT)) {
            case "sent" -> "ENVIADO";
            case "delivered" -> "ENTREGUE";
            case "read" -> "LIDO";
            case "failed" -> "FALHOU";
            default -> null;
        };
    }

    private Optional<String> motivoInelegivelEnvio(CobrancaItemDTO item) {
        if (item == null) {
            return Optional.empty();
        }
        return cobrancaWhatsAppElegibilidadeService.motivoInelegivelEnvio(
                item.imovelId(), item.processoId(), item.clienteId());
    }

    private void validarTemplateCobrancaAprovado() {
        var templates = whatsAppTemplateService.listarTemplates();
        var template = templates.stream()
                .filter(t -> TEMPLATE_COBRANCA.equals(t.name()))
                .findFirst();
        if (template.isEmpty()) {
            throw new IllegalStateException(
                    "Template \"" + TEMPLATE_COBRANCA + "\" não encontrado na Meta. "
                            + "Cadastre e aguarde aprovação antes de disparar cobranças.");
        }
        String status = template.get().status();
        if (!"APPROVED".equalsIgnoreCase(status)) {
            throw new IllegalStateException(
                    "Template \"" + TEMPLATE_COBRANCA + "\" ainda não foi aprovado pela Meta (status: "
                            + status + "). Envio só é possível após aprovação.");
        }
    }

    private void salvarFalha(
            String loteId,
            String loteDescricao,
            CobrancaItemDTO item,
            String createdBy,
            String error,
            String telefoneRaw) {
        salvarFalha(loteId, loteDescricao, item, createdBy, error, telefoneRaw, item.pessoaId(), item.clienteId());
    }

    private void salvarFalha(
            String loteId,
            String loteDescricao,
            CobrancaItemDTO item,
            String createdBy,
            String error,
            String telefoneRaw,
            Long pessoaId,
            Long clienteId) {
        CobrancaWhatsAppEntity cobranca = montarEntidade(loteId, loteDescricao, item, createdBy);
        cobranca.setPhoneNumber(telefoneSeguroParaRegistro(telefoneRaw, pessoaId, clienteId));
        cobranca.setStatus("FALHOU");
        cobranca.setErrorMessage(error);
        cobrancaRepository.save(cobranca);
    }

    private void salvarAgendamentoFalha(
            String loteId,
            String loteDescricao,
            CobrancaItemDTO item,
            String createdBy,
            Instant scheduledAt,
            String error,
            String telefoneRaw) {
        salvarAgendamentoFalha(
                loteId, loteDescricao, item, createdBy, scheduledAt, error, telefoneRaw, item.pessoaId(), item.clienteId());
    }

    private void salvarAgendamentoFalha(
            String loteId,
            String loteDescricao,
            CobrancaItemDTO item,
            String createdBy,
            Instant scheduledAt,
            String error,
            String telefoneRaw,
            Long pessoaId,
            Long clienteId) {
        CobrancaWhatsAppEntity cobranca = montarEntidade(loteId, loteDescricao, item, createdBy);
        cobranca.setScheduledAt(scheduledAt);
        cobranca.setStatus("FALHOU");
        cobranca.setErrorMessage(error);
        cobranca.setPhoneNumber(telefoneSeguroParaRegistro(telefoneRaw, pessoaId, clienteId));
        cobrancaRepository.save(cobranca);
    }

    private Optional<String> resolverTelefoneNormalizado(CobrancaItemDTO item) {
        return telefoneCadastroNormalizacaoService.normalizarParaWhatsAppEPersistir(
                item.pessoaId(), item.clienteId(), item.telefone());
    }

    private String telefoneSeguroParaRegistro(String telefoneRaw, Long pessoaId, Long clienteId) {
        return telefoneCadastroNormalizacaoService
                .normalizarParaWhatsAppEPersistir(pessoaId, clienteId, telefoneRaw)
                .orElse("00000000000");
    }

    private CobrancaWhatsAppEntity montarEntidade(
            String loteId, String loteDescricao, CobrancaItemDTO item, String createdBy) {
        CobrancaWhatsAppEntity cobranca = new CobrancaWhatsAppEntity();
        cobranca.setLoteId(loteId);
        cobranca.setLoteDescricao(loteDescricao);
        cobranca.setPessoaId(item.pessoaId());
        cobranca.setClienteId(resolverClienteIdVinculo(item));
        cobranca.setPessoaNome(item.pessoaNome());
        cobranca.setImovelId(item.imovelId());
        cobranca.setCondominioNome(item.condominioNome());
        cobranca.setUnidadeDescricao(item.unidadeDescricao());
        cobranca.setProcessoId(item.processoId());
        cobranca.setValorPendente(item.valorPendente());
        cobranca.setCreatedBy(createdBy);
        return cobranca;
    }

    /**
     * Cliente do escritório (cod+proc) vinculado ao processo; fallback para {@code item.clienteId()}.
     */
    private Long resolverClienteIdVinculo(CobrancaItemDTO item) {
        if (item == null || item.processoId() == null) {
            return item != null ? item.clienteId() : null;
        }
        return processoRepository
                .findById(item.processoId())
                .map(ProcessoEntity::getCliente)
                .filter(Objects::nonNull)
                .map(ClienteEntity::getId)
                .orElse(item.clienteId());
    }

    private String resolverTelefoneCliente(Long clienteId) {
        if (clienteId == null) {
            return null;
        }
        List<ClienteWhatsAppEntity> whatsappCadastro =
                clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(clienteId);
        for (ClienteWhatsAppEntity w : whatsappCadastro) {
            if (StringUtils.hasText(w.getNumero())) {
                return w.getNumero().trim();
            }
        }
        Long pessoaId = clienteRepository.findPessoaIdById(clienteId).orElse(null);
        return resolverTelefoneContatosPessoa(pessoaId);
    }

    /** Telefone WhatsApp de uma pessoa: cadastro do cliente vinculado → contatos → telefone base. */
    @Transactional(readOnly = true)
    public String resolverTelefonePessoa(Long pessoaId, Long clienteIdHint) {
        if (clienteIdHint != null) {
            String tel = resolverTelefoneCliente(clienteIdHint);
            if (StringUtils.hasText(tel)) {
                return tel;
            }
        }
        if (pessoaId == null) {
            return null;
        }
        List<ClienteEntity> clientes = clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId);
        for (ClienteEntity c : clientes) {
            String tel = resolverTelefoneCliente(c.getId());
            if (StringUtils.hasText(tel)) {
                return tel;
            }
        }
        return resolverTelefoneContatosPessoa(pessoaId);
    }

    private String resolverTelefoneContatosPessoa(Long pessoaId) {
        if (pessoaId == null) {
            return null;
        }
        List<PessoaContatoEntity> contatos = pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoaId);
        for (PessoaContatoEntity c : contatos) {
            if (c.getTipo() != null
                    && "telefone".equalsIgnoreCase(c.getTipo().trim())
                    && StringUtils.hasText(c.getValor())) {
                return c.getValor().trim();
            }
        }
        return pessoaRepository.findTelefoneById(pessoaId).filter(StringUtils::hasText).map(String::trim).orElse(null);
    }

    public static String montarUnidadeDescricao(String unidade) {
        if (!StringUtils.hasText(unidade)) {
            return "Unidade";
        }
        String u = unidade.trim();
        if (u.toLowerCase(Locale.ROOT).startsWith("unidade")) {
            return u;
        }
        return "Unidade " + u;
    }

    private static String extrairPrimeiroNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "Cliente";
        }
        return nome.trim().split("\\s+")[0];
    }

    private static String extractMessageId(WhatsAppSendResponse response) {
        if (response == null || response.messages() == null || response.messages().isEmpty()) {
            return null;
        }
        return response.messages().getFirst().id();
    }

    private List<CobrancaPreviewDTO> enriquecerPreviewComHistorico(List<CobrancaPreviewDTO> previews) {
        if (previews == null || previews.isEmpty()) {
            return List.of();
        }
        Set<Long> processoIds = previews.stream()
                .map(CobrancaPreviewDTO::processoId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Set<Long> imovelIds = previews.stream()
                .map(CobrancaPreviewDTO::imovelId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Long, List<CobrancaHistoricoItemDTO>> porProcesso = agruparHistoricoPorProcesso(processoIds);
        Map<Long, List<CobrancaHistoricoItemDTO>> porImovel = agruparHistoricoPorImovel(imovelIds);

        List<CobrancaPreviewDTO> out = new ArrayList<>(previews.size());
        for (CobrancaPreviewDTO p : previews) {
            List<CobrancaHistoricoItemDTO> historico = List.of();
            if (p.processoId() != null) {
                historico = porProcesso.getOrDefault(p.processoId(), List.of());
            } else if (p.imovelId() != null) {
                historico = porImovel.getOrDefault(p.imovelId(), List.of());
            }
            out.add(withHistorico(p, historico));
        }
        return out;
    }

    private Map<Long, List<CobrancaHistoricoItemDTO>> agruparHistoricoPorProcesso(Set<Long> processoIds) {
        if (processoIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<CobrancaHistoricoItemDTO>> out = new HashMap<>();
        for (CobrancaWhatsAppEntity e :
                cobrancaRepository.findByProcessoIdInAndStatusNotOrderByCreatedAtDesc(processoIds, "CANCELADO")) {
            if (e.getProcessoId() == null) {
                continue;
            }
            out.computeIfAbsent(e.getProcessoId(), k -> new ArrayList<>()).add(toHistoricoItem(e));
        }
        return out;
    }

    private Map<Long, List<CobrancaHistoricoItemDTO>> agruparHistoricoPorImovel(Set<Long> imovelIds) {
        if (imovelIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<CobrancaHistoricoItemDTO>> out = new HashMap<>();
        for (CobrancaWhatsAppEntity e :
                cobrancaRepository.findByImovelIdInAndStatusNotOrderByCreatedAtDesc(imovelIds, "CANCELADO")) {
            if (e.getImovelId() == null) {
                continue;
            }
            out.computeIfAbsent(e.getImovelId(), k -> new ArrayList<>()).add(toHistoricoItem(e));
        }
        return out;
    }

    private static CobrancaPreviewDTO withHistorico(CobrancaPreviewDTO p, List<CobrancaHistoricoItemDTO> historico) {
        return new CobrancaPreviewDTO(
                p.imovelId(),
                p.clienteId(),
                p.pessoaId(),
                p.pessoaNome(),
                p.telefone(),
                p.telefoneFormatado(),
                p.temTelefone(),
                p.condominioNome(),
                p.unidadeDescricao(),
                p.processoId(),
                p.valorPendente(),
                p.valorPendenteFormatado(),
                p.jaCobradoEsteMes(),
                p.origem(),
                p.processoNumeroInterno(),
                p.clienteEscritorioCodigo(),
                p.clienteEscritorioNome(),
                p.elegivelCobranca(),
                p.motivoInelegivel(),
                p.calculoDesatualizado(),
                p.dataCalculo(),
                p.debitosAbertos(),
                p.parcelasAbertas(),
                historico);
    }

    private CobrancaHistoricoItemDTO toHistoricoItem(CobrancaWhatsAppEntity e) {
        Instant quando = e.getEnviadoAt() != null
                ? e.getEnviadoAt()
                : e.getScheduledAt() != null ? e.getScheduledAt() : e.getCreatedAt();
        return new CobrancaHistoricoItemDTO(
                e.getId(),
                e.getStatus(),
                e.getLoteDescricao(),
                WhatsAppService.formatPhoneDisplay(e.getPhoneNumber()),
                quando,
                e.getEnviadoAt(),
                e.getScheduledAt(),
                e.getCreatedAt(),
                e.getCreatedBy(),
                e.getErrorMessage());
    }

    private Map<Long, Integer> numerosInternosPorProcesso(List<CobrancaWhatsAppEntity> rows) {
        Set<Long> ids = new HashSet<>();
        for (CobrancaWhatsAppEntity row : rows) {
            if (row.getProcessoId() != null) {
                ids.add(row.getProcessoId());
            }
        }
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Integer> out = new HashMap<>();
        for (ProcessoEntity p : processoRepository.findAllById(ids)) {
            out.put(p.getId(), p.getNumeroInterno());
        }
        return out;
    }

    private CobrancaLoteResumoDTO toLoteResumo(LoteResumoRow row) {
        return new CobrancaLoteResumoDTO(
                row.getLoteId(),
                row.getLoteDescricao(),
                row.getCreatedAt(),
                row.getCreatedBy(),
                row.getTotal() != null ? row.getTotal() : 0L,
                row.getEnviados() != null ? row.getEnviados() : 0L,
                row.getFalhos() != null ? row.getFalhos() : 0L,
                row.getPendentes() != null ? row.getPendentes() : 0L);
    }

    private CobrancaDTO toDto(CobrancaWhatsAppEntity e, Integer processoNumeroInterno) {
        return new CobrancaDTO(
                e.getId(),
                e.getLoteId(),
                e.getPessoaNome(),
                WhatsAppService.formatPhoneDisplay(e.getPhoneNumber()),
                e.getCondominioNome(),
                e.getUnidadeDescricao(),
                e.getProcessoId(),
                processoNumeroInterno,
                e.getValorPendente(),
                e.getStatus(),
                e.getErrorMessage(),
                e.getEnviadoAt(),
                e.getScheduledAt(),
                e.getCreatedAt());
    }
}
