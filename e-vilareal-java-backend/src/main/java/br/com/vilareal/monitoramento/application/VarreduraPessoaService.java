package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.jobrun.application.JobRunContext;
import br.com.vilareal.monitoramento.domain.PoloDaPessoa;
import br.com.vilareal.monitoramento.domain.PoloDaPessoaMatcher;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.domain.StatusVarredura;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.SegredoJusticaContagemEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.VarreduraPessoaEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.SegredoJusticaContagemRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.VarreduraPessoaRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiBuscaParteService;
import br.com.vilareal.projudi.ProjudiEstruturaInesperadaException;
import br.com.vilareal.projudi.ProjudiBuscaParteService.LinhaLista;
import br.com.vilareal.projudi.ProjudiBuscaParteService.PaginaLista;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Varredura PROJUDI de uma pessoa monitorada (descoberta de processos novos por CPF/CNPJ).
 *
 * <p><b>Atomicidade sob o gate:</b> toda a varredura — POST da busca, GETs de paginação e
 * aberturas de detalhe — roda numa ÚNICA posse do {@link ProjudiOrquestradorGate}
 * ({@code tryExecutar}). Motivo: o resultado da busca vive NA SESSÃO do PROJUDI e a
 * paginação navega sobre ele; o {@code ConsultaPeriodicaMonitorScheduler} usa o MESMO POST
 * na MESMA credencial — se rodasse no meio, sobrescreveria nosso resultado. Por isso a
 * varredura NÃO cede o gate no meio; {@code haPrioridadeAguardando()} é checado ANTES de
 * começar (se houver operação de utilizador aguardando, nem inicia).</p>
 *
 * <p><b>Baseline vs incremental:</b> sem {@code pessoa.baselineEm}, lê TODAS as páginas e
 * grava tudo como {@code BASELINE} (sem abrir detalhe, sem alertar); {@code baselineEm} só
 * é setado ao FINAL com sucesso — erro no meio deixa a próxima execução refazer (o UNIQUE
 * de (pessoa, reduzido, ano) torna a regravação idempotente). Com baseline feita, faz o
 * scan REVERSO: da última página (mais recente) para trás, parando na primeira página em
 * que todas as linhas não-opacas já são conhecidas, com limite de segurança de
 * {@value #LIMITE_PAGINAS_INCREMENTAL} páginas por varredura (estourou → {@code PARCIAL},
 * continua na próxima execução).</p>
 */
@Service
public class VarreduraPessoaService {

    private static final Logger log = LoggerFactory.getLogger(VarreduraPessoaService.class);

    /** Máximo de páginas navegadas num scan incremental (não vale para baseline). */
    static final int LIMITE_PAGINAS_INCREMENTAL = 5;

    private final ProjudiOrquestradorGate gate;
    private final ProjudiBuscaParteService buscaService;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoDescobertoRepository descobertoRepository;
    private final VarreduraPessoaRepository varreduraRepository;
    private final SegredoJusticaContagemRepository segredoRepository;

    public VarreduraPessoaService(
            ProjudiOrquestradorGate gate,
            ProjudiBuscaParteService buscaService,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ProcessoDescobertoRepository descobertoRepository,
            VarreduraPessoaRepository varreduraRepository,
            SegredoJusticaContagemRepository segredoRepository) {
        this.gate = gate;
        this.buscaService = buscaService;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.descobertoRepository = descobertoRepository;
        this.varreduraRepository = varreduraRepository;
        this.segredoRepository = segredoRepository;
    }

    // ------------------------------------------------------------------
    // API
    // ------------------------------------------------------------------

    public enum MotivoNaoExecutada {
        /** Operação prioritária do utilizador aguardando/ativa — nem tentou o lock. */
        PRIORIDADE_USUARIO,
        /** Robô PROJUDI ocupado com outra rotina. */
        ROBO_OCUPADO
    }

    public record ResultadoVarredura(
            boolean executada,
            MotivoNaoExecutada motivoNaoExecutada,
            Long varreduraId,
            StatusVarredura status,
            int paginasLidas,
            int encontrados,
            int novos,
            int qtdSegredo,
            List<String> alertasSegredo) {

        static ResultadoVarredura pulada(MotivoNaoExecutada motivo) {
            return new ResultadoVarredura(false, motivo, null, null, 0, 0, 0, 0, List.of());
        }
    }

    /**
     * Varre uma pessoa monitorada. Retorna sem executar (sem bloquear) se houver operação
     * prioritária de utilizador ou se o robô estiver ocupado.
     *
     * @param ctx contexto do JobRun para heartbeat/progresso (nullable em chamadas manuais).
     */
    public ResultadoVarredura varrerPessoa(Long pessoaId, Long credencialId, JobRunContext ctx) {
        PessoaEntity pessoa = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));
        String docDigitos = pessoa.getCpf() == null ? "" : pessoa.getCpf().replaceAll("\\D", "");
        if (docDigitos.length() != 11 && docDigitos.length() != 14) {
            throw new BusinessRuleException(
                    "Pessoa " + pessoaId + " sem CPF/CNPJ válido para varredura (encontrado: '"
                            + pessoa.getCpf() + "').");
        }
        if (!Boolean.TRUE.equals(pessoa.getMarcadoMonitoramento())) {
            throw new BusinessRuleException("Pessoa " + pessoaId + " não está marcada para monitoramento.");
        }

        // Checagem ANTES de iniciar: se o utilizador está esperando o robô, nem começamos —
        // uma vez iniciada, a varredura NÃO cede no meio (o resultado paginado vive na sessão).
        if (gate.haPrioridadeAguardando()) {
            log.info("Varredura pessoa {}: pulada — operação prioritária do utilizador aguardando.", pessoaId);
            return ResultadoVarredura.pulada(MotivoNaoExecutada.PRIORIDADE_USUARIO);
        }

        Optional<ResultadoVarredura> resultado = gate.tryExecutarComRetorno(
                "varredura monitoramento pessoa " + pessoaId,
                () -> executarSobPosseDoGate(pessoa, docDigitos, credencialId, ctx));
        return resultado.orElseGet(() -> ResultadoVarredura.pulada(MotivoNaoExecutada.ROBO_OCUPADO));
    }

    // ------------------------------------------------------------------
    // Execução (sempre com o gate em mãos)
    // ------------------------------------------------------------------

    private ResultadoVarredura executarSobPosseDoGate(
            PessoaEntity pessoa, String docDigitos, Long credencialId, JobRunContext ctx) {
        boolean baseline = pessoa.getBaselineEm() == null;
        VarreduraPessoaEntity varredura = new VarreduraPessoaEntity();
        varredura.setPessoa(pessoa);
        varredura.setInicio(LocalDateTime.now());
        varredura.setStatus(StatusVarredura.EXECUTANDO);
        varredura = varreduraRepository.save(varredura);

        Contadores cont = new Contadores();
        try {
            List<String> alertas;
            StatusVarredura statusFinal;
            if (baseline) {
                alertas = executarBaseline(pessoa, docDigitos, credencialId, cont, ctx);
                statusFinal = StatusVarredura.SUCESSO;
            } else {
                IncrementalOutcome outcome =
                        executarIncremental(pessoa, docDigitos, credencialId, cont, ctx);
                alertas = outcome.alertasSegredo();
                statusFinal = outcome.completa() ? StatusVarredura.SUCESSO : StatusVarredura.PARCIAL;
            }
            finalizar(varredura, statusFinal, cont, null, null);
            log.info(
                    "Varredura pessoa {} ({}): status={}, paginas={}, encontrados={}, novos={}, segredo={}.",
                    pessoa.getId(), baseline ? "baseline" : "incremental", statusFinal,
                    cont.paginasLidas, cont.encontrados, cont.novos, cont.qtdSegredo);
            return new ResultadoVarredura(
                    true, null, varredura.getId(), statusFinal,
                    cont.paginasLidas, cont.encontrados, cont.novos, cont.qtdSegredo, alertas);
        } catch (Exception ex) {
            // Erro vira registro em varredura_pessoa, NUNCA exceção para o chamador: uma
            // pessoa que quebra não pode derrubar o tick do scheduler.
            log.error("Varredura pessoa {} falhou: {}", pessoa.getId(), ex.getMessage(), ex);
            finalizar(varredura, StatusVarredura.ERRO, cont, codigoDoErro(ex), ex.getMessage());
            return new ResultadoVarredura(
                    true, null, varredura.getId(), StatusVarredura.ERRO,
                    cont.paginasLidas, cont.encontrados, cont.novos, cont.qtdSegredo, List.of());
        }
    }

    /**
     * BASELINE: lê TODAS as páginas (0..última), grava tudo como {@code BASELINE}, não abre
     * detalhe de nada e não alerta. {@code baselineEm} só é setado ao final com sucesso.
     * A contagem de segredo por serventia é estabelecida aqui (leitura completa).
     */
    private List<String> executarBaseline(
            PessoaEntity pessoa, String docDigitos, Long credencialId,
            Contadores cont, JobRunContext ctx) {
        PaginaLista primeira = buscaService.primeiraPagina(credencialId, docDigitos);
        int ultima = primeira.posicaoUltimaPagina();
        Map<String, Integer> segredoPorServentia = new HashMap<>();

        for (int pos = 0; pos <= ultima; pos++) {
            PaginaLista pagina = pos == 0 ? primeira : buscaService.paginaEm(credencialId, pos);
            cont.paginasLidas++;
            for (LinhaLista linha : pagina.linhas()) {
                if (linha.segredo()) {
                    cont.qtdSegredo++;
                    segredoPorServentia.merge(chaveServentia(linha.serventiaSegredo()), 1, Integer::sum);
                    continue;
                }
                gravarLinha(pessoa, linha, SituacaoProcessoDescoberto.BASELINE, cont);
            }
            if (ctx != null) {
                ctx.heartbeat();
                ctx.putMetadata("baseline_pessoa_" + pessoa.getId(),
                        "página " + (pos + 1) + "/" + (ultima + 1));
            }
        }

        // Leitura completa: define/atualiza a contagem de segredo. Na baseline não alertamos —
        // o acervo em segredo pré-existente não é "novo".
        List<String> alertas = atualizarContagemSegredo(pessoa.getId(), segredoPorServentia, false);

        pessoa.setBaselineEm(LocalDateTime.now());
        pessoaRepository.save(pessoa);
        return alertas;
    }

    private record IncrementalOutcome(boolean completa, List<String> alertasSegredo) {}

    /**
     * INCREMENTAL (scan reverso): a lista é ordenada por distribuição CRESCENTE, então o que
     * é novo está no FIM. Lê da última página para trás e para na primeira página em que
     * todas as linhas não-opacas já são conhecidas — as páginas anteriores só podem conter
     * linhas mais antigas, já vistas pela baseline.
     *
     * <p>Linhas de segredo NÃO participam do critério de parada (são opacas, nunca ficam
     * "conhecidas" — participassem, a varredura regrediria 5 páginas a cada execução).</p>
     */
    private IncrementalOutcome executarIncremental(
            PessoaEntity pessoa, String docDigitos, Long credencialId,
            Contadores cont, JobRunContext ctx) {
        PaginaLista primeira = buscaService.primeiraPagina(credencialId, docDigitos);
        int ultima = primeira.posicaoUltimaPagina();
        Map<String, Integer> segredoPorServentia = new HashMap<>();
        List<Candidato> candidatos = new ArrayList<>();

        boolean fronteiraEncontrada = false;
        int pos = ultima;
        int paginasProcessadas = 0;
        while (pos >= 0 && paginasProcessadas < LIMITE_PAGINAS_INCREMENTAL) {
            PaginaLista pagina = pos == 0 ? primeira : buscaService.paginaEm(credencialId, pos);
            cont.paginasLidas++;
            paginasProcessadas++;

            boolean todasConhecidas = true;
            for (LinhaLista linha : pagina.linhas()) {
                if (linha.segredo()) {
                    cont.qtdSegredo++;
                    segredoPorServentia.merge(chaveServentia(linha.serventiaSegredo()), 1, Integer::sum);
                    continue;
                }
                boolean conhecida = deduplicar(pessoa, linha, candidatos, cont);
                if (!conhecida) {
                    todasConhecidas = false;
                }
            }
            if (ctx != null) {
                ctx.heartbeat();
            }
            if (todasConhecidas) {
                fronteiraEncontrada = true;
                break;
            }
            pos--;
        }
        boolean completa = fronteiraEncontrada || pos < 0;
        if (!completa) {
            log.warn(
                    "Varredura pessoa {}: limite de {} páginas atingido sem achar a fronteira de "
                            + "conhecidos — marcada PARCIAL, continua na próxima execução.",
                    pessoa.getId(), LIMITE_PAGINAS_INCREMENTAL);
        }

        // Detalhes SÓ DEPOIS de terminar a paginação: o GET de detalhe pode substituir o
        // estado de busca da sessão. Ainda na mesma posse do gate e na mesma sessão (os
        // tokens Id_Processo colhidos acima são válidos apenas nela).
        for (Candidato candidato : candidatos) {
            abrirDetalheEGravar(pessoa, candidato, credencialId, cont);
            if (ctx != null) {
                ctx.heartbeat();
            }
        }

        // Contagem de segredo: comparação por contagem só é válida quando TODA a lista foi
        // lida (a incremental parcial vê só a cauda). Chegar à página 0 — por fronteira ou por
        // exaustão — significa leitura completa. Para a maioria das pessoas (lista de 1-2
        // páginas) toda varredura é naturalmente completa e o alerta funciona a cada execução.
        // Acervos grandes NÃO têm rastreio de segredo no dia a dia — decisão deliberada (sem
        // re-scan periódico): processo em segredo é inacessível de qualquer modo; se um dia
        // for preciso, será varredura completa MANUAL sob demanda.
        boolean leuTodaLista = pos <= 0;
        List<String> alertas = leuTodaLista
                ? atualizarContagemSegredo(pessoa.getId(), segredoPorServentia, true)
                : List.of();
        return new IncrementalOutcome(completa, alertas);
    }

    // ------------------------------------------------------------------
    // Dedupe
    // ------------------------------------------------------------------

    /** Linha candidata a NOVO, com o token de sessão para abrir o detalhe ao final. */
    private record Candidato(LinhaLista linha, int anoDistribuicao) {}

    /**
     * Dedupe de uma linha, na ordem definida:
     * (a) já existe processo_descoberto (pessoa, reduzido, ano) → conhecida;
     * (b) existe processo no acervo com CNJ casando sequencial+dv+ano → conhecida, grava VINCULADO;
     * (c) senão → candidata (detalhe aberto ao final da paginação).
     *
     * @return true se a linha já era conhecida (a/b), false se virou candidata (c).
     */
    private boolean deduplicar(
            PessoaEntity pessoa, LinhaLista linha, List<Candidato> candidatos, Contadores cont) {
        cont.encontrados++;
        Integer ano = anoDaLinha(linha);
        if (linha.numeroReduzido() == null || ano == null) {
            log.warn("Varredura pessoa {}: linha sem número reduzido ou sem data de distribuição "
                            + "(reduzido='{}') — tratada como candidata sem dedupe.",
                    pessoa.getId(), linha.numeroReduzido());
            candidatos.add(new Candidato(linha, ano == null ? 0 : ano));
            return false;
        }

        // (a) já descoberta para esta pessoa
        Optional<ProcessoDescobertoEntity> existente =
                descobertoRepository.findByPessoaIdAndNumeroReduzidoAndAnoDistribuicao(
                        pessoa.getId(), linha.numeroReduzido(), ano);
        if (existente.isPresent()) {
            enriquecerSeFaltando(existente.get(), linha);
            return true;
        }

        // (b) já no acervo (dedupe por CNJ só-dígitos)
        ProcessoEntity doAcervo = localizarNoAcervo(linha.numeroReduzido(), ano);
        if (doAcervo != null) {
            ProcessoDescobertoEntity vinculado =
                    novaDescoberta(pessoa, linha, ano, SituacaoProcessoDescoberto.VINCULADO);
            vinculado.setProcesso(doAcervo);
            vinculado.setNumeroCnj(doAcervo.getNumeroCnj());
            salvarComAssertivaDeSufixo(vinculado);
            log.info("Varredura pessoa {}: linha {}-{} casou com processo {} do acervo (VINCULADO).",
                    pessoa.getId(), linha.numeroReduzido(), ano, doAcervo.getId());
            return true;
        }

        // (c) candidata a NOVO
        candidatos.add(new Candidato(linha, ano));
        return false;
    }

    /**
     * Abre o detalhe do candidato (na MESMA sessão em que o token foi colhido) para obter
     * CNJ/classe/serventia, decide o polo e grava como NOVO — ou IGNORADO quando a regra
     * assimétrica autoriza o descarte.
     */
    private void abrirDetalheEGravar(
            PessoaEntity pessoa, Candidato candidato, Long credencialId, Contadores cont) {
        LinhaLista linha = candidato.linha();
        ProjudiBuscaParteService.DetalheProcesso detalhe = null;
        if (linha.idProcessoToken() != null) {
            try {
                detalhe = buscaService.abrirDetalhe(credencialId, linha.idProcessoToken());
            } catch (Exception ex) {
                // Falha no detalhe não descarta a descoberta: grava sem CNJ/classe/serventia.
                log.warn("Varredura pessoa {}: falha ao abrir detalhe da linha {} ({}) — gravando sem detalhe.",
                        pessoa.getId(), linha.numeroReduzido(), ex.getMessage());
            }
        }

        int ano = candidato.anoDistribuicao();
        if (ano == 0 && detalhe != null && detalhe.numeroCnj() != null) {
            ano = anoDoCnj(detalhe.numeroCnj());
        }
        if (linha.numeroReduzido() == null || ano == 0) {
            log.warn("Varredura pessoa {}: candidato sem chave natural (reduzido='{}', ano={}) — descartado do "
                    + "registro (será reavaliado na próxima varredura).", pessoa.getId(), linha.numeroReduzido(), ano);
            return;
        }

        PoloDaPessoa polo = PoloDaPessoaMatcher.determinar(
                pessoa.getNome(), linha.partesAtivo(), linha.partesPassivo());
        boolean descartar = PoloDaPessoaMatcher.descartarAutomaticamente(pessoa.getPoloMonitorado(), polo);
        SituacaoProcessoDescoberto situacao = descartar
                ? SituacaoProcessoDescoberto.IGNORADO
                : SituacaoProcessoDescoberto.NOVO;
        if (descartar) {
            log.info("Varredura pessoa {}: linha {}-{} descartada automaticamente — regra: "
                            + "polo_monitorado=PASSIVO e polo detectado=ATIVO (partes ativo={}, passivo={}).",
                    pessoa.getId(), linha.numeroReduzido(), ano, linha.partesAtivo(), linha.partesPassivo());
        }

        ProcessoDescobertoEntity nova = novaDescoberta(pessoa, linha, ano, situacao);
        nova.setPoloDaPessoa(polo);
        if (detalhe != null) {
            nova.setNumeroCnj(detalhe.numeroCnj());
            nova.setClasse(detalhe.classe());
            nova.setServentia(detalhe.serventia());
        }
        salvarComAssertivaDeSufixo(nova);
        if (situacao == SituacaoProcessoDescoberto.NOVO) {
            cont.novos++;
        }
    }

    private ProcessoEntity localizarNoAcervo(String numeroReduzido, int ano) {
        String seqDv = sequencialDv(numeroReduzido);
        if (seqDv == null) {
            return null;
        }
        List<ProcessoEntity> casados = processoRepository.findByCnjSequencialDvAno(seqDv + ano);
        if (casados.isEmpty()) {
            return null;
        }
        if (casados.size() > 1) {
            log.warn("Dedupe por CNJ ambíguo para reduzido {} ano {}: {} processos no acervo — usando o primeiro.",
                    numeroReduzido, ano, casados.size());
        }
        return casados.get(0);
    }

    /**
     * "5432153-35" → "543215335"; sequencial com menos de 7 dígitos é completado com zeros à
     * esquerda ("18743-97" → "001874397"), como no CNJ canônico.
     */
    static String sequencialDv(String numeroReduzido) {
        if (numeroReduzido == null) {
            return null;
        }
        String[] partes = numeroReduzido.trim().split("-");
        if (partes.length != 2) {
            return null;
        }
        String seq = partes[0].replaceAll("\\D", "");
        String dv = partes[1].replaceAll("\\D", "");
        if (seq.isEmpty() || seq.length() > 7 || dv.length() != 2) {
            return null;
        }
        return "0".repeat(7 - seq.length()) + seq + dv;
    }

    private static Integer anoDaLinha(LinhaLista linha) {
        return linha.dataDistribuicao() == null ? null : linha.dataDistribuicao().getYear();
    }

    static int anoDoCnj(String numeroCnj) {
        String digitos = numeroCnj == null ? "" : numeroCnj.replaceAll("\\D", "");
        if (digitos.length() != 20) {
            return 0;
        }
        return Integer.parseInt(digitos.substring(9, 13));
    }

    // ------------------------------------------------------------------
    // Persistência
    // ------------------------------------------------------------------

    private ProcessoDescobertoEntity novaDescoberta(
            PessoaEntity pessoa, LinhaLista linha, int ano, SituacaoProcessoDescoberto situacao) {
        ProcessoDescobertoEntity e = new ProcessoDescobertoEntity();
        e.setPessoa(pessoa);
        e.setNumeroReduzido(linha.numeroReduzido());
        e.setAnoDistribuicao(ano);
        e.setDataDistribuicao(linha.dataDistribuicao());
        e.setIdProcessoSufixo(linha.idProcessoSufixo());
        e.setPartesAtivo(juntar(linha.partesAtivo()));
        e.setPartesPassivo(juntar(linha.partesPassivo()));
        e.setPoloDaPessoa(PoloDaPessoaMatcher.determinar(
                // Polo calculado também na baseline (custo zero — as partes já vieram na lista).
                pessoa.getNome(), linha.partesAtivo(), linha.partesPassivo()));
        e.setSituacao(situacao);
        return e;
    }

    private void gravarLinha(
            PessoaEntity pessoa, LinhaLista linha, SituacaoProcessoDescoberto situacao, Contadores cont) {
        cont.encontrados++;
        Integer ano = anoDaLinha(linha);
        if (linha.numeroReduzido() == null || ano == null) {
            log.warn("Baseline pessoa {}: linha sem reduzido/data ignorada (reduzido='{}').",
                    pessoa.getId(), linha.numeroReduzido());
            return;
        }
        Optional<ProcessoDescobertoEntity> existente =
                descobertoRepository.findByPessoaIdAndNumeroReduzidoAndAnoDistribuicao(
                        pessoa.getId(), linha.numeroReduzido(), ano);
        if (existente.isPresent()) {
            // Regravação idempotente (baseline reexecutada após erro no meio).
            enriquecerSeFaltando(existente.get(), linha);
            return;
        }
        ProcessoDescobertoEntity nova = novaDescoberta(pessoa, linha, ano, situacao);
        // Metadado gratuito: se a linha da baseline já casa com o acervo, registra o vínculo
        // (a situação permanece BASELINE — baseline não alerta nem re-rotula).
        ProcessoEntity doAcervo = localizarNoAcervo(linha.numeroReduzido(), ano);
        if (doAcervo != null) {
            nova.setProcesso(doAcervo);
            nova.setNumeroCnj(doAcervo.getNumeroCnj());
        }
        salvarComAssertivaDeSufixo(nova);
    }

    private void enriquecerSeFaltando(ProcessoDescobertoEntity existente, LinhaLista linha) {
        boolean mudou = false;
        if (existente.getIdProcessoSufixo() == null && linha.idProcessoSufixo() != null) {
            existente.setIdProcessoSufixo(linha.idProcessoSufixo());
            mudou = true;
        }
        if (existente.getDataDistribuicao() == null && linha.dataDistribuicao() != null) {
            existente.setDataDistribuicao(linha.dataDistribuicao());
            mudou = true;
        }
        if (mudou) {
            salvarComAssertivaDeSufixo(existente);
        }
    }

    /**
     * Grava e verifica a hipótese de unicidade do sufixo do Id_Processo: se outro
     * processo_descoberto (de qualquer pessoa) tiver o MESMO sufixo, loga WARN — queremos
     * descobrir se ele é único de verdade antes de algum dia promovê-lo a chave de dedupe.
     */
    private void salvarComAssertivaDeSufixo(ProcessoDescobertoEntity e) {
        descobertoRepository.save(e);
        if (e.getIdProcessoSufixo() == null) {
            return;
        }
        List<ProcessoDescobertoEntity> mesmos = descobertoRepository.findByIdProcessoSufixo(e.getIdProcessoSufixo());
        for (ProcessoDescobertoEntity outro : mesmos) {
            boolean mesmoRegistro = outro.getId().equals(e.getId());
            boolean mesmoProcesso = outro.getNumeroReduzido().equals(e.getNumeroReduzido())
                    && outro.getAnoDistribuicao().equals(e.getAnoDistribuicao());
            if (!mesmoRegistro && !mesmoProcesso) {
                log.warn("ASSERTIVA sufixo Id_Processo VIOLADA: sufixo {} compartilhado por descobertas id={} "
                                + "({}-{}) e id={} ({}-{}) — sufixo NÃO é identificador único.",
                        e.getIdProcessoSufixo(), e.getId(), e.getNumeroReduzido(), e.getAnoDistribuicao(),
                        outro.getId(), outro.getNumeroReduzido(), outro.getAnoDistribuicao());
            }
        }
    }

    /**
     * Atualiza segredo_justica_contagem com a contagem observada (só chamada em leitura
     * COMPLETA da lista). Se {@code alertarAumento} e a contagem de alguma serventia subiu,
     * gera alerta "novo processo em segredo — verifique manualmente".
     */
    private List<String> atualizarContagemSegredo(
            Long pessoaId, Map<String, Integer> observado, boolean alertarAumento) {
        List<String> alertas = new ArrayList<>();
        Map<String, SegredoJusticaContagemEntity> atuais = new HashMap<>();
        for (SegredoJusticaContagemEntity e : segredoRepository.findByPessoaId(pessoaId)) {
            atuais.put(e.getServentia(), e);
        }
        for (Map.Entry<String, Integer> entry : observado.entrySet()) {
            SegredoJusticaContagemEntity atual = atuais.remove(entry.getKey());
            int anterior = atual == null ? 0 : atual.getQtd();
            if (alertarAumento && entry.getValue() > anterior) {
                String alerta = "Novo processo em segredo de justiça na serventia \"" + entry.getKey()
                        + "\" (contagem " + anterior + " → " + entry.getValue() + ") — verifique manualmente.";
                alertas.add(alerta);
                log.warn("Varredura pessoa {}: {}", pessoaId, alerta);
            }
            if (atual == null) {
                atual = new SegredoJusticaContagemEntity();
                atual.setPessoaId(pessoaId);
                atual.setServentia(entry.getKey());
            }
            atual.setQtd(entry.getValue());
            segredoRepository.save(atual);
        }
        // Serventias que sumiram da lista (contagem caiu a zero): atualiza sem alertar.
        for (SegredoJusticaContagemEntity restante : atuais.values()) {
            if (restante.getQtd() != 0) {
                restante.setQtd(0);
                segredoRepository.save(restante);
            }
        }
        return alertas;
    }

    /** Código estável para varredura_pessoa.erro_codigo (parser tem código próprio). */
    static String codigoDoErro(Exception ex) {
        if (ex instanceof ProjudiEstruturaInesperadaException) {
            return ProjudiEstruturaInesperadaException.CODIGO;
        }
        return ex.getClass().getSimpleName();
    }

    private static String chaveServentia(String serventia) {
        return serventia == null || serventia.isBlank() ? "(serventia não identificada)" : serventia.trim();
    }

    private static String juntar(List<String> nomes) {
        return nomes == null || nomes.isEmpty() ? null : String.join("; ", nomes);
    }

    private void finalizar(
            VarreduraPessoaEntity varredura, StatusVarredura status, Contadores cont,
            String erroCodigo, String erroMensagem) {
        try {
            varredura.setFim(LocalDateTime.now());
            varredura.setStatus(status);
            varredura.setPaginasLidas(cont.paginasLidas);
            varredura.setEncontrados(cont.encontrados);
            varredura.setNovos(cont.novos);
            varredura.setQtdSegredo(cont.qtdSegredo);
            varredura.setErroCodigo(erroCodigo);
            varredura.setErroMensagem(erroMensagem);
            varreduraRepository.save(varredura);
        } catch (Exception e) {
            log.error("Falha ao finalizar registro de varredura {}: {}", varredura.getId(), e.getMessage());
        }
    }

    private static final class Contadores {
        int paginasLidas;
        int encontrados;
        int novos;
        int qtdSegredo;
    }
}
