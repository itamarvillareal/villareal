package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.monitoramento.api.dto.CadastroDescobertoResponse;
import br.com.vilareal.monitoramento.api.dto.CadastroDescobertoResponse.ClienteCandidato;
import br.com.vilareal.monitoramento.api.dto.ProcessoDescobertoResponse;
import br.com.vilareal.monitoramento.domain.PoloDaPessoa;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.api.dto.ProcessoParteWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoResponse;
import br.com.vilareal.processo.api.dto.ProcessoWriteRequest;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

/**
 * Cadastro de um clique (Parte 5, Bloco C): transforma um processo descoberto pela varredura
 * em processo do acervo, SEMPRE por ação humana (botão da tela após revisão — nunca automático).
 *
 * <p><b>Rede anti-duplicata:</b> antes de criar, procura no acervo processo com o MESMO
 * {@code numero_cnj_digitos}. Se existir, NÃO cria — vincula o descoberto ao existente e
 * responde "já cadastrado". O dedupe da varredura reduz esses casos, mas grafias divergentes
 * (caso Se77e/Sette) provam que escapam; esta checagem é a barreira final. Também é o que
 * torna o cadastro idempotente: a segunda chamada cai aqui e nunca cria o segundo processo.</p>
 */
@Service
public class MonitoramentoCadastroService {

    private static final Logger log = LoggerFactory.getLogger(MonitoramentoCadastroService.class);
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final ProcessoDescobertoRepository descobertoRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final MonitoramentoTriagemService triagemService;

    public MonitoramentoCadastroService(
            ProcessoDescobertoRepository descobertoRepository,
            ProcessoRepository processoRepository,
            ClienteRepository clienteRepository,
            ProcessoApplicationService processoApplicationService,
            MonitoramentoTriagemService triagemService) {
        this.descobertoRepository = descobertoRepository;
        this.processoRepository = processoRepository;
        this.clienteRepository = clienteRepository;
        this.processoApplicationService = processoApplicationService;
        this.triagemService = triagemService;
    }

    public CadastroDescobertoResponse cadastrar(Long descobertoId, Long clienteId, Integer numeroInterno) {
        ProcessoDescobertoEntity carregado = descobertoRepository.findByIdComPessoa(descobertoId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Processo descoberto não encontrado: " + descobertoId));

        // Idempotência rápida: descoberto já apontando para um processo do acervo. O processo
        // vem como proxy lazy (serviço sem transação) — recarrega inteiro antes de usar.
        if (carregado.getProcesso() != null) {
            ProcessoEntity existente =
                    processoRepository.findById(carregado.getProcesso().getId()).orElse(null);
            if (existente != null) {
                return vincularAoExistente(carregado, existente);
            }
            // Processo foi excluído do acervo depois do vínculo: limpa e segue o fluxo normal.
            carregado.setProcesso(null);
        }

        // Anti-duplicata ANTES de qualquer ida ao PROJUDI: se o CNJ já é conhecido e bate com o
        // acervo, o desfecho é vincular ao existente — classe/serventia são irrelevantes e o
        // enriquecimento seria uma viagem inútil (e um ponto de falha) ao robô.
        if (carregado.getNumeroCnj() != null) {
            CadastroDescobertoResponse vinculo = vincularSeJaNoAcervo(carregado);
            if (vinculo != null) {
                return vinculo;
            }
        }

        // Detalhe incompleto → enriquece (vai ao PROJUDI sob o gate) e recarrega.
        if (carregado.getNumeroCnj() == null || carregado.getClasse() == null
                || carregado.getServentia() == null) {
            triagemService.enriquecer(descobertoId);
            carregado = descobertoRepository.findByIdComPessoa(descobertoId).orElseThrow();
        }
        final ProcessoDescobertoEntity d = carregado;

        String digitos = d.getNumeroCnj() == null ? "" : d.getNumeroCnj().replaceAll("\\D", "");
        if (digitos.length() != 20) {
            throw new BusinessRuleException(
                    "CNJ do descoberto fora do padrão (20 dígitos): " + d.getNumeroCnj());
        }

        // Reaplica a rede anti-duplicata: o CNJ pode ter acabado de chegar pelo enriquecimento.
        CadastroDescobertoResponse vinculo = vincularSeJaNoAcervo(d);
        if (vinculo != null) {
            return vinculo;
        }

        return cadastrarNovo(d, clienteId, numeroInterno);
    }

    /** Rede anti-duplicata: vincula ao processo do acervo com o mesmo CNJ, se houver. */
    private CadastroDescobertoResponse vincularSeJaNoAcervo(ProcessoDescobertoEntity d) {
        String digitos = d.getNumeroCnj() == null ? "" : d.getNumeroCnj().replaceAll("\\D", "");
        if (digitos.length() != 20) {
            return null;
        }
        List<ProcessoEntity> existentes = processoRepository.findByNumeroCnjDigitos(digitos);
        if (existentes.isEmpty()) {
            return null;
        }
        if (existentes.size() > 1) {
            log.warn("Monitoramento: CNJ {} tem {} processos no acervo — vinculando ao primeiro (id={}).",
                    d.getNumeroCnj(), existentes.size(), existentes.get(0).getId());
        }
        return vincularAoExistente(d, existentes.get(0));
    }

    private CadastroDescobertoResponse cadastrarNovo(
            ProcessoDescobertoEntity d, Long clienteId, Integer numeroInterno) {
        // Resolução do cliente: nunca adivinhar.
        List<ClienteEntity> clientes = clienteRepository
                .findByPessoa_IdOrderByCodigoClienteAsc(d.getPessoa().getId()).stream()
                .filter(c -> !Boolean.TRUE.equals(c.getInativo()))
                .toList();
        ClienteEntity cliente;
        if (clienteId != null) {
            cliente = clientes.stream()
                    .filter(c -> c.getId().equals(clienteId))
                    .findFirst()
                    .orElseThrow(() -> new BusinessRuleException(
                            "Cliente " + clienteId + " não pertence à pessoa " + d.getPessoa().getId() + "."));
        } else if (clientes.size() == 1) {
            cliente = clientes.get(0);
        } else {
            String mensagem = clientes.isEmpty()
                    ? "A pessoa não tem cadastro de cliente — crie o cliente antes de cadastrar o processo."
                    : "A pessoa tem " + clientes.size() + " clientes — escolha em qual cadastrar.";
            return new CadastroDescobertoResponse(
                    "PENDENTE_CONFIRMACAO", mensagem, null, null, null,
                    clientes.stream()
                            .map(c -> new ClienteCandidato(c.getId(), c.getCodigoCliente(), rotuloCliente(c)))
                            .toList(),
                    null,
                    ProcessoDescobertoResponse.de(d));
        }

        // Número interno: nunca inventado — sem valor do usuário, devolve sugestão (ou vazio).
        if (numeroInterno == null) {
            Integer max = processoRepository.findMaxNumeroInternoDoCliente(cliente.getId());
            Integer sugestao = max == null ? null : max + 1;
            return new CadastroDescobertoResponse(
                    "PENDENTE_CONFIRMACAO",
                    "Confirme o número interno" + (sugestao == null
                            ? " (cliente sem sequência — preencha manualmente)."
                            : " (sugestão: " + sugestao + ")."),
                    null, null, cliente.getId(),
                    List.of(new ClienteCandidato(cliente.getId(), cliente.getCodigoCliente(), rotuloCliente(cliente))),
                    sugestao,
                    ProcessoDescobertoResponse.de(d));
        }

        ProcessoResponse criado = criarProcesso(d, cliente, numeroInterno);
        criarPartesOpostas(d, criado.getId());

        d.setProcesso(processoRepository.getReferenceById(criado.getId()));
        d.setSituacao(SituacaoProcessoDescoberto.VINCULADO);
        descobertoRepository.save(d);
        log.info("Monitoramento: descoberto {} cadastrado como processo {} (cliente {}, numeroInterno {}).",
                d.getId(), criado.getId(), cliente.getId(), numeroInterno);
        return new CadastroDescobertoResponse(
                "CRIADO",
                "Processo cadastrado (numeroInterno " + numeroInterno + ").",
                criado.getId(), numeroInterno, cliente.getId(), List.of(), null,
                ProcessoDescobertoResponse.de(d));
    }

    private CadastroDescobertoResponse vincularAoExistente(ProcessoDescobertoEntity d, ProcessoEntity p) {
        boolean mudou = d.getSituacao() != SituacaoProcessoDescoberto.VINCULADO
                || d.getProcesso() == null
                || !Objects.equals(d.getProcesso().getId(), p.getId());
        d.setProcesso(p);
        d.setSituacao(SituacaoProcessoDescoberto.VINCULADO);
        if (d.getNumeroCnj() == null) {
            d.setNumeroCnj(p.getNumeroCnj());
        }
        if (mudou) {
            descobertoRepository.save(d);
        }
        log.info("Monitoramento: descoberto {} vinculado ao processo existente {} (numeroInterno {}).",
                d.getId(), p.getId(), p.getNumeroInterno());
        return new CadastroDescobertoResponse(
                "JA_CADASTRADO",
                "Processo já cadastrado (numeroInterno " + p.getNumeroInterno() + ") — descoberto vinculado, nada criado.",
                p.getId(), p.getNumeroInterno(), null, List.of(), null,
                ProcessoDescobertoResponse.de(d));
    }

    private ProcessoResponse criarProcesso(ProcessoDescobertoEntity d, ClienteEntity cliente, int numeroInterno) {
        ProcessoWriteRequest req = new ProcessoWriteRequest();
        req.setClienteId(cliente.getId());
        req.setPessoaTitularId(d.getPessoa().getId());
        req.setNumeroInterno(numeroInterno);
        req.setNumeroCnj(d.getNumeroCnj());
        req.setTramitacao("Projudi");
        req.setDescricaoAcao(d.getClasse());
        req.setPapelCliente(papelCliente(d.getPoloDaPessoa()));
        req.setObservacao("Cadastrado a partir do monitoramento PROJUDI."
                + (d.getDataDistribuicao() == null
                        ? ""
                        : " Distribuição: " + DATA_BR.format(d.getDataDistribuicao()) + ".")
                + (d.getServentia() == null ? "" : " Serventia: " + d.getServentia() + "."));
        return processoApplicationService.criar(req);
    }

    /** Partes do polo OPOSTO à pessoa, como nome livre (a lista do PROJUDI só dá nomes). */
    private void criarPartesOpostas(ProcessoDescobertoEntity d, Long processoId) {
        List<String> nomes;
        String polo;
        if (d.getPoloDaPessoa() == PoloDaPessoa.PASSIVO) {
            nomes = separarNomes(d.getPartesAtivo());
            polo = "AUTOR";
        } else if (d.getPoloDaPessoa() == PoloDaPessoa.ATIVO) {
            nomes = separarNomes(d.getPartesPassivo());
            polo = "REU";
        } else {
            // AMBOS/INDETERMINADO: não dá para saber o lado oposto com segurança — não criar
            // partes erradas; o usuário completa na tela do processo.
            return;
        }
        int ordem = 0;
        for (String nome : nomes) {
            try {
                ProcessoParteWriteRequest parte = new ProcessoParteWriteRequest();
                parte.setNomeLivre(nome);
                parte.setPolo(polo);
                parte.setOrdem(ordem++);
                processoApplicationService.criarParte(processoId, parte);
            } catch (Exception e) {
                log.warn("Monitoramento: falha ao criar parte '{}' ({}) no processo {}: {}",
                        nome, polo, processoId, e.getMessage());
            }
        }
    }

    /** Inverso do juntar da varredura (nomes unidos por "; " no TEXT). */
    private static List<String> separarNomes(String texto) {
        if (texto == null || texto.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(texto.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private static String papelCliente(PoloDaPessoa polo) {
        return switch (polo) {
            case PASSIVO -> "REQUERIDO";
            case ATIVO -> "REQUERENTE";
            case AMBOS, INDETERMINADO -> null;
        };
    }

    private static String rotuloCliente(ClienteEntity c) {
        String nome = c.getNomeReferencia();
        if (nome == null || nome.isBlank()) {
            nome = c.getPessoa() != null ? c.getPessoa().getNome() : null;
        }
        return c.getCodigoCliente() + (nome == null ? "" : " — " + nome);
    }
}
