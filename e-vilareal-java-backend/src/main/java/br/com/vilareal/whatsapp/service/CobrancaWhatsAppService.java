package br.com.vilareal.whatsapp.service;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaItemDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResultDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResumoDTO;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class CobrancaWhatsAppService {

    public static final String TEMPLATE_COBRANCA = "cobranca_pagamento";

    private static final Logger log = LoggerFactory.getLogger(CobrancaWhatsAppService.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final NumberFormat MOEDA_BR = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
    private static final long DELAY_ENTRE_ENVIOS_MS = 200L;

    private final CobrancaWhatsAppRepository cobrancaRepository;
    private final ImovelRepository imovelRepository;
    private final PagamentoRepository pagamentoRepository;
    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final WhatsAppService whatsAppService;
    private final WhatsAppTemplateService whatsAppTemplateService;

    public CobrancaWhatsAppService(
            CobrancaWhatsAppRepository cobrancaRepository,
            ImovelRepository imovelRepository,
            PagamentoRepository pagamentoRepository,
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            PessoaContatoRepository pessoaContatoRepository,
            WhatsAppService whatsAppService,
            WhatsAppTemplateService whatsAppTemplateService) {
        this.cobrancaRepository = cobrancaRepository;
        this.imovelRepository = imovelRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.whatsAppService = whatsAppService;
        this.whatsAppTemplateService = whatsAppTemplateService;
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

    public List<CobrancaPreviewDTO> buscarImoveisParaCobranca(String condominioNome, Long clienteId) {
        String condominioFiltro = StringUtils.hasText(condominioNome) ? condominioNome.trim() : null;
        List<ImovelEntity> imoveis = imovelRepository.findForCobrancaPreview(condominioFiltro, clienteId);
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        int ano = hoje.getYear();
        int mes = hoje.getMonthValue();

        List<CobrancaPreviewDTO> previews = new ArrayList<>();
        for (ImovelEntity imovel : imoveis) {
            ClienteEntity cliente = imovel.getCliente();
            if (cliente == null) {
                continue;
            }
            Long imovelId = imovel.getId();
            Long cid = cliente.getId();
            List<PagamentoEntity> abertos = pagamentoRepository.findReceberAbertosPorImovelOuCliente(imovelId, cid);
            BigDecimal valorPendente = abertos.stream()
                    .map(PagamentoEntity::getValor)
                    .filter(v -> v != null)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (valorPendente.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            PessoaEntity pessoa = cliente.getPessoa();
            String pessoaNome = pessoa != null && StringUtils.hasText(pessoa.getNome())
                    ? pessoa.getNome().trim()
                    : "Cliente";
            Long pessoaId = pessoa != null ? pessoa.getId() : null;
            String telefone = resolverTelefoneCliente(cliente);
            boolean temTelefone = StringUtils.hasText(telefone);
            String telefoneFormatado = temTelefone ? WhatsAppService.formatPhoneDisplay(telefone) : null;
            String condominio = StringUtils.hasText(imovel.getCondominio()) ? imovel.getCondominio().trim() : "";
            String unidadeDescricao = montarUnidadeDescricao(imovel.getUnidade());
            ProcessoEntity processo = imovel.getProcesso();
            Long processoId = processo != null ? processo.getId() : null;
            boolean jaCobrado = cobrancaRepository.existsCobrancaNoMes(imovelId, ano, mes);

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
                    jaCobrado));
        }
        return previews;
    }

    @Transactional
    public CobrancaLoteResultDTO dispararLote(List<CobrancaItemDTO> itens, String loteDescricao, String createdBy) {
        validarTemplateCobrancaAprovado();
        if (itens == null || itens.isEmpty()) {
            throw new IllegalArgumentException("Selecione ao menos uma unidade para cobrança.");
        }

        String loteId = UUID.randomUUID().toString();
        int enviados = 0;
        int falhos = 0;
        int semTelefone = 0;
        int jaCobrados = 0;

        for (CobrancaItemDTO item : itens) {
            if (item == null) {
                continue;
            }
            if (!StringUtils.hasText(item.telefone())) {
                semTelefone++;
                salvarFalha(loteId, loteDescricao, item, createdBy, "Sem telefone cadastrado", null);
                continue;
            }

            try {
                String phone = WhatsAppService.formatPhoneNumber(item.telefone());
                String primeiroNome = extrairPrimeiroNome(item.pessoaNome());
                WhatsAppSendResponse response = whatsAppService.sendTemplateMessage(
                        phone,
                        TEMPLATE_COBRANCA,
                        "pt_BR",
                        List.of(primeiroNome, item.unidadeDescricao(), item.condominioNome()));

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
                salvarFalha(loteId, loteDescricao, item, createdBy, msg, item.telefone());
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

        return new CobrancaLoteResultDTO(loteId, itens.size(), enviados, falhos, semTelefone, jaCobrados);
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
                                cobranca.getCondominioNome()));
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

    public Page<CobrancaLoteResumoDTO> listarLotes(Pageable pageable) {
        return cobrancaRepository.findLotesResumo(pageable).map(this::toLoteResumo);
    }

    public List<CobrancaDTO> detalhesLote(String loteId) {
        return cobrancaRepository.findByLoteIdOrderByPessoaNomeAsc(loteId).stream()
                .map(this::toDto)
                .toList();
    }

    public CobrancaStatsDTO statsDoMes() {
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        Object[] row = cobrancaRepository.statsDoMes(hoje.getYear(), hoje.getMonthValue());
        long enviadas = row[0] instanceof Number n0 ? n0.longValue() : 0L;
        long entregues = row[1] instanceof Number n1 ? n1.longValue() : 0L;
        BigDecimal valor = row[2] instanceof BigDecimal bd ? bd : BigDecimal.ZERO;
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
        CobrancaWhatsAppEntity cobranca = montarEntidade(loteId, loteDescricao, item, createdBy);
        if (StringUtils.hasText(telefoneRaw)) {
            try {
                cobranca.setPhoneNumber(WhatsAppService.formatPhoneNumber(telefoneRaw));
            } catch (Exception e) {
                cobranca.setPhoneNumber(telefoneRaw);
            }
        } else {
            cobranca.setPhoneNumber("00000000000");
        }
        cobranca.setStatus("FALHOU");
        cobranca.setErrorMessage(error);
        cobrancaRepository.save(cobranca);
    }

    private CobrancaWhatsAppEntity montarEntidade(
            String loteId, String loteDescricao, CobrancaItemDTO item, String createdBy) {
        CobrancaWhatsAppEntity cobranca = new CobrancaWhatsAppEntity();
        cobranca.setLoteId(loteId);
        cobranca.setLoteDescricao(loteDescricao);
        cobranca.setPessoaId(item.pessoaId());
        cobranca.setClienteId(item.clienteId());
        cobranca.setPessoaNome(item.pessoaNome());
        cobranca.setImovelId(item.imovelId());
        cobranca.setCondominioNome(item.condominioNome());
        cobranca.setUnidadeDescricao(item.unidadeDescricao());
        cobranca.setProcessoId(item.processoId());
        cobranca.setValorPendente(item.valorPendente());
        cobranca.setCreatedBy(createdBy);
        return cobranca;
    }

    private String resolverTelefoneCliente(ClienteEntity cliente) {
        List<ClienteWhatsAppEntity> whatsappCadastro =
                clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(cliente.getId());
        for (ClienteWhatsAppEntity w : whatsappCadastro) {
            if (StringUtils.hasText(w.getNumero())) {
                return w.getNumero().trim();
            }
        }
        PessoaEntity pessoa = cliente.getPessoa();
        if (pessoa == null) {
            return null;
        }
        List<PessoaContatoEntity> contatos = pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId());
        for (PessoaContatoEntity c : contatos) {
            if (c.getTipo() != null
                    && "telefone".equalsIgnoreCase(c.getTipo().trim())
                    && StringUtils.hasText(c.getValor())) {
                return c.getValor().trim();
            }
        }
        if (StringUtils.hasText(pessoa.getTelefone())) {
            return pessoa.getTelefone().trim();
        }
        return null;
    }

    static String montarUnidadeDescricao(String unidade) {
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

    private CobrancaDTO toDto(CobrancaWhatsAppEntity e) {
        return new CobrancaDTO(
                e.getId(),
                e.getLoteId(),
                e.getPessoaNome(),
                WhatsAppService.formatPhoneDisplay(e.getPhoneNumber()),
                e.getCondominioNome(),
                e.getUnidadeDescricao(),
                e.getValorPendente(),
                e.getStatus(),
                e.getErrorMessage(),
                e.getEnviadoAt(),
                e.getCreatedAt());
    }
}
