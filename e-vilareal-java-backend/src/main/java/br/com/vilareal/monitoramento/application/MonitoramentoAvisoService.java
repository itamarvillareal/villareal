package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateDTO;
import br.com.vilareal.whatsapp.service.ClienteEnvioTelefoneResolver;
import br.com.vilareal.whatsapp.service.ClienteEnvioTelefoneResolver.TelefoneEnvioDetalhe;
import br.com.vilareal.whatsapp.service.WhatsAppService;
import br.com.vilareal.whatsapp.service.WhatsAppTemplateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Aviso de processo novo ao cliente via WhatsApp (Parte 5, Bloco E). Reusa a MESMA infra dos
 * lembretes/cobrança ({@link WhatsAppService#sendTemplateMessage}) — nenhum canal paralelo.
 *
 * <p>Ordem deliberada das travas em {@link #avisar}:
 * <ol>
 *   <li><b>CONSENTIMENTO</b> ({@code pessoa.aceita_aviso_processo_novo}) — sem ele, 403 e
 *       NADA acontece. É a exigência central, verificada NO BACKEND: mesmo que a UI chame o
 *       endpoint indevidamente, o envio é recusado aqui.</li>
 *   <li>Dedupe — aviso já enviado para este descoberto nunca reenvia (409).</li>
 *   <li>Telefone — precisa estar entre os resolvidos do cadastro (422 se não houver).</li>
 *   <li>Template — {@code aviso_novo_processo} precisa estar APPROVED na Meta; pendente ou
 *       inconsultável bloqueia com mensagem clara em vez de falhar no meio do envio (409).</li>
 * </ol>
 */
@Service
public class MonitoramentoAvisoService {

    private static final Logger log = LoggerFactory.getLogger(MonitoramentoAvisoService.class);

    public static final String TEMPLATE_AVISO = "aviso_novo_processo";

    /** Corpo submetido à Meta — usado na prévia enquanto a consulta do template não responde. */
    static final String CORPO_TEMPLATE_LOCAL =
            "Olá, {{1}}. Em acompanhamento processual de rotina, identificamos um novo processo "
                    + "judicial em que seu nome consta como parte: processo nº {{2}}, em tramitação "
                    + "na {{3}}.\n\nEste é um aviso informativo do escritório {{4}}, que acompanha "
                    + "seus interesses jurídicos. Para entender do que se trata e alinhar os "
                    + "próximos passos, entre em contato conosco.";

    private final ProcessoDescobertoRepository descobertoRepository;
    private final ClienteRepository clienteRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final ClienteEnvioTelefoneResolver telefoneResolver;
    private final WhatsAppTemplateService templateService;
    private final WhatsAppService whatsAppService;
    private final String nomeEscritorio;

    public MonitoramentoAvisoService(
            ProcessoDescobertoRepository descobertoRepository,
            ClienteRepository clienteRepository,
            PessoaContatoRepository pessoaContatoRepository,
            ClienteEnvioTelefoneResolver telefoneResolver,
            WhatsAppTemplateService templateService,
            WhatsAppService whatsAppService,
            @Value("${vilareal.monitoramento.aviso.nome-escritorio:Villareal Advocacia}") String nomeEscritorio) {
        this.descobertoRepository = descobertoRepository;
        this.clienteRepository = clienteRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.telefoneResolver = telefoneResolver;
        this.templateService = templateService;
        this.whatsAppService = whatsAppService;
        this.nomeEscritorio = nomeEscritorio;
    }

    public record TelefoneAviso(String numero, String label) {}

    public record ContextoAviso(
            Long descobertoId,
            boolean consentimento,
            LocalDateTime consentimentoEm,
            String consentimentoOrigem,
            LocalDateTime avisoEnviadoEm,
            String avisoEnviadoPara,
            String templateStatus,
            boolean templateAprovado,
            List<TelefoneAviso> telefones,
            String corpoTemplate,
            List<String> parametrosSugeridos) {}

    public record ResultadoAviso(
            Long descobertoId, String telefone, LocalDateTime enviadoEm, String mensagem) {}

    /** Tudo que o modal precisa para decidir e pré-preencher — sem efeito colateral. */
    public ContextoAviso contexto(Long descobertoId) {
        ProcessoDescobertoEntity d = carregar(descobertoId);
        PessoaEntity pessoa = d.getPessoa();
        StatusTemplate template = consultarTemplate();
        return new ContextoAviso(
                d.getId(),
                Boolean.TRUE.equals(pessoa.getAceitaAvisoProcessoNovo()),
                pessoa.getAvisoConsentimentoEm(),
                pessoa.getAvisoConsentimentoOrigem(),
                d.getAvisoEnviadoEm(),
                d.getAvisoEnviadoPara(),
                template.status(),
                template.aprovado(),
                telefonesDaPessoa(pessoa),
                template.corpo() != null ? template.corpo() : CORPO_TEMPLATE_LOCAL,
                parametros(d));
    }

    /**
     * Envia o aviso — SÓ por clique humano no modal, nunca automático, nunca em lote.
     * Os parâmetros do template vêm do modal (editáveis); o corpo é fixo, aprovado pela Meta.
     */
    public ResultadoAviso avisar(Long descobertoId, String telefone, List<String> parametrosEditados) {
        ProcessoDescobertoEntity d = carregar(descobertoId);
        PessoaEntity pessoa = d.getPessoa();

        // TRAVA 1 — CONSENTIMENTO. Primeiro de tudo; sem ele nada abaixo executa.
        if (!Boolean.TRUE.equals(pessoa.getAceitaAvisoProcessoNovo())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "A pessoa " + pessoa.getNome() + " não registrou consentimento para receber "
                            + "aviso de processo novo. Registre o consentimento no cadastro da "
                            + "pessoa antes de enviar.");
        }

        // TRAVA 2 — dedupe: um aviso por descoberto.
        if (d.getAvisoEnviadoEm() != null) {
            throw new IllegalStateException(
                    "O aviso deste processo já foi enviado em " + d.getAvisoEnviadoEm()
                            + " para " + d.getAvisoEnviadoPara() + " — reenvio bloqueado.");
        }

        // TRAVA 3 — telefone precisa vir do cadastro (nunca número digitado livre).
        String telefoneCanonico = validarTelefone(pessoa, telefone);

        // TRAVA 4 — template aprovado na Meta; pendente/inconsultável bloqueia com clareza.
        StatusTemplate template = consultarTemplate();
        if (!template.aprovado()) {
            throw new IllegalStateException(template.motivoBloqueio());
        }

        List<String> parametros = parametrosEditados != null && parametrosEditados.size() == 4
                && parametrosEditados.stream().allMatch(StringUtils::hasText)
                        ? parametrosEditados.stream().map(String::trim).toList()
                        : parametros(d);

        Long clienteId = clientesAtivos(pessoa.getId()).stream()
                .findFirst()
                .map(ClienteEntity::getId)
                .orElse(null);
        Long processoId = d.getProcesso() != null ? d.getProcesso().getId() : null;

        whatsAppService.sendTemplateMessage(
                telefoneCanonico, TEMPLATE_AVISO, "pt_BR", parametros, clienteId, processoId);

        d.setAvisoEnviadoEm(LocalDateTime.now());
        d.setAvisoEnviadoPara(telefoneCanonico);
        descobertoRepository.save(d);
        log.info("Monitoramento: aviso de processo novo do descoberto {} enviado para {} (pessoa {}).",
                d.getId(), telefoneCanonico, pessoa.getId());
        return new ResultadoAviso(
                d.getId(), telefoneCanonico, d.getAvisoEnviadoEm(), "Aviso enviado.");
    }

    private ProcessoDescobertoEntity carregar(Long descobertoId) {
        return descobertoRepository.findByIdComPessoa(descobertoId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Processo descoberto não encontrado: " + descobertoId));
    }

    /** Parâmetros do template: {{1}} cliente, {{2}} processo, {{3}} serventia, {{4}} escritório. */
    private List<String> parametros(ProcessoDescobertoEntity d) {
        String numero = StringUtils.hasText(d.getNumeroCnj())
                ? d.getNumeroCnj()
                : d.getNumeroReduzido() + "/" + d.getAnoDistribuicao();
        String serventia = StringUtils.hasText(d.getServentia())
                ? d.getServentia()
                : "Justiça Estadual de Goiás";
        return List.of(d.getPessoa().getNome(), numero, serventia, nomeEscritorio);
    }

    /**
     * Telefones do cadastro: união dos resolvidos por cliente ativo (ClienteWhatsApp → contatos
     * → pessoa, via {@link ClienteEnvioTelefoneResolver}); pessoa sem cliente cai direto nos
     * contatos/telefone da própria pessoa.
     */
    private List<TelefoneAviso> telefonesDaPessoa(PessoaEntity pessoa) {
        Set<String> vistos = new LinkedHashSet<>();
        List<TelefoneAviso> out = new ArrayList<>();
        for (ClienteEntity cliente : clientesAtivos(pessoa.getId())) {
            for (TelefoneEnvioDetalhe t : telefoneResolver.resolverTelefonesDetalhados(cliente)) {
                if (vistos.add(t.numeroCanonico())) {
                    out.add(new TelefoneAviso(t.numeroCanonico(), t.label()));
                }
            }
        }
        if (out.isEmpty()) {
            for (PessoaContatoEntity c : pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId())) {
                if (c.getTipo() != null && "telefone".equalsIgnoreCase(c.getTipo().trim())) {
                    adicionar(out, vistos, c.getValor(), "Contato telefone");
                }
            }
            adicionar(out, vistos, pessoa.getTelefone(), "Telefone cadastro");
        }
        return out;
    }

    private List<ClienteEntity> clientesAtivos(Long pessoaId) {
        return clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId).stream()
                .filter(c -> !Boolean.TRUE.equals(c.getInativo()))
                .toList();
    }

    private static void adicionar(List<TelefoneAviso> out, Set<String> vistos, String raw, String label) {
        if (!StringUtils.hasText(raw)) {
            return;
        }
        try {
            String canonico = WhatsAppService.formatPhoneNumber(raw.trim());
            if (vistos.add(canonico)) {
                out.add(new TelefoneAviso(canonico, label));
            }
        } catch (IllegalArgumentException ignored) {
            // número inválido no cadastro não entra na lista
        }
    }

    private String validarTelefone(PessoaEntity pessoa, String telefone) {
        List<TelefoneAviso> telefones = telefonesDaPessoa(pessoa);
        if (telefones.isEmpty()) {
            throw new BusinessRuleException(
                    "Sem WhatsApp cadastrado para " + pessoa.getNome()
                            + " — cadastre um telefone antes de enviar o aviso.");
        }
        if (!StringUtils.hasText(telefone)) {
            throw new BusinessRuleException("Informe o telefone de envio (escolhido no modal).");
        }
        String canonico;
        try {
            canonico = WhatsAppService.formatPhoneNumber(telefone.trim());
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException("Telefone inválido: " + telefone);
        }
        boolean pertence = telefones.stream().anyMatch(t -> t.numero().equals(canonico));
        if (!pertence) {
            throw new BusinessRuleException(
                    "O telefone informado não está entre os cadastrados da pessoa/cliente — "
                            + "o aviso só sai para números do cadastro.");
        }
        return canonico;
    }

    private record StatusTemplate(String status, boolean aprovado, String corpo, String motivoBloqueio) {}

    private StatusTemplate consultarTemplate() {
        List<WhatsAppTemplateDTO> templates;
        try {
            templates = templateService.listarTemplates();
        } catch (Exception e) {
            log.warn("Monitoramento: não foi possível consultar templates na Meta: {}", e.getMessage());
            return new StatusTemplate(
                    "INDISPONIVEL", false, null,
                    "Não foi possível verificar o status do template \"" + TEMPLATE_AVISO
                            + "\" na Meta — envio bloqueado por segurança. Tente novamente mais tarde.");
        }
        WhatsAppTemplateDTO template = templates.stream()
                .filter(t -> TEMPLATE_AVISO.equals(t.name()))
                .findFirst()
                .orElse(null);
        if (template == null) {
            return new StatusTemplate(
                    "NAO_ENCONTRADO", false, null,
                    "Template \"" + TEMPLATE_AVISO + "\" não encontrado na Meta. Cadastre-o no "
                            + "WhatsApp Manager e aguarde a aprovação antes de enviar.");
        }
        boolean aprovado = "APPROVED".equalsIgnoreCase(template.status());
        return new StatusTemplate(
                template.status(),
                aprovado,
                template.bodyText(),
                aprovado ? null
                        : "Template \"" + TEMPLATE_AVISO + "\" ainda pendente de aprovação na Meta "
                                + "(status: " + template.status() + "). Envio será liberado após a aprovação.");
    }
}
