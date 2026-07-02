package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoItemDto;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoRequest;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoResumoDto;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoResponse;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioLegadoProcDto;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.PlanilhaPessoaDto;
import br.com.vilareal.condominio.api.dto.UnidadePlanilhaLinhaDto;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CobrancaProprietarioDiagnosticoService {

    public static final String CLASSE_MESMO_REU = "MESMO_REU";
    public static final String CLASSE_TROCA_DONO = "TROCA_DONO";
    public static final String CLASSE_EX_DONO_LEGADO = "EX_DONO_LEGADO";
    public static final String CLASSE_CPF_CORRIGIDO = "CPF_CORRIGIDO";
    public static final String CLASSE_COPROPRIETARIOS = "COPROPRIETARIOS";
    public static final String CLASSE_SEM_PROPRIETARIO = "SEM_PROPRIETARIO";
    public static final String CLASSE_SEM_LEGADO = "SEM_LEGADO";

    private final ProcessoUnidadeClienteLookupService processoUnidadeLookup;
    private final ProcessoParteRepository processoParteRepository;
    private final PessoaRepository pessoaRepository;
    private final CalculoRodadaRepository calculoRodadaRepository;

    public CobrancaProprietarioDiagnosticoService(
            ProcessoUnidadeClienteLookupService processoUnidadeLookup,
            ProcessoParteRepository processoParteRepository,
            PessoaRepository pessoaRepository,
            CalculoRodadaRepository calculoRodadaRepository) {
        this.processoUnidadeLookup = processoUnidadeLookup;
        this.processoParteRepository = processoParteRepository;
        this.pessoaRepository = pessoaRepository;
        this.calculoRodadaRepository = calculoRodadaRepository;
    }

    @Transactional(readOnly = true)
    public CobrancaProprietarioDiagnosticoResponse diagnosticar(long clienteId, String codigoCliente8, CobrancaProprietarioDiagnosticoRequest request) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente8);
        Map<String, UnidadePlanilhaLinhaDto> planilhaPorUnidade = indexarPlanilha(request.planilhaUnidades());

        List<CobrancaProprietarioDiagnosticoItemDto> itens = new ArrayList<>();
        int mesmoReu = 0;
        int trocaDono = 0;
        int exDonoLegado = 0;
        int coproprietarios = 0;
        int semProprietario = 0;
        int semLegado = 0;
        int cpfCorrigido = 0;

        for (CobrancaUnidadeRequestDto unidade : request.unidades()) {
            CobrancaProprietarioDiagnosticoItemDto item = diagnosticarUnidade(clienteId, cod8, unidade, planilhaPorUnidade);
            itens.add(item);
            switch (item.classe()) {
                case CLASSE_MESMO_REU -> mesmoReu++;
                case CLASSE_TROCA_DONO -> trocaDono++;
                case CLASSE_EX_DONO_LEGADO -> exDonoLegado++;
                case CLASSE_CPF_CORRIGIDO -> cpfCorrigido++;
                case CLASSE_COPROPRIETARIOS -> coproprietarios++;
                case CLASSE_SEM_PROPRIETARIO -> semProprietario++;
                case CLASSE_SEM_LEGADO -> semLegado++;
                default -> {}
            }
        }

        CobrancaProprietarioDiagnosticoResumoDto resumo = new CobrancaProprietarioDiagnosticoResumoDto(
                itens.size(), mesmoReu, trocaDono, exDonoLegado, coproprietarios, semProprietario, semLegado, cpfCorrigido);
        return new CobrancaProprietarioDiagnosticoResponse(itens, resumo);
    }

    private CobrancaProprietarioDiagnosticoItemDto diagnosticarUnidade(
            long clienteId,
            String cod8,
            CobrancaUnidadeRequestDto unidade,
            Map<String, UnidadePlanilhaLinhaDto> planilhaPorUnidade) {
        String cod = CobrancaUnidadeFormatUtil.normalizarCodigoUnidade(unidade.codigoUnidadeNormalizada());
        UnidadePlanilhaLinhaDto linPlan = planilhaPorUnidade.get(cod);

        PlanilhaPessoaDto propPlan = linPlan != null ? linPlan.proprietario() : null;

        String legadoNome = trim(unidade.proprietarioLegadoNome());
        String legadoDoc = CobrancaProprietarioEfetivoUtil.somenteDigitos(unidade.proprietarioLegadoDocDigitos());

        CobrancaProprietarioEfetivoUtil.ProprietarioEfetivo efetivo;
        if (propPlan != null && CobrancaProprietarioEfetivoUtil.docValido(propPlan.cpfCnpjNormalizado())) {
            efetivo = CobrancaProprietarioEfetivoUtil.fromPlanilhaPessoa(propPlan);
        } else if (CobrancaProprietarioEfetivoUtil.docValido(unidade.proprietarioDocDigitos())) {
            efetivo = new CobrancaProprietarioEfetivoUtil.ProprietarioEfetivo(
                    trim(unidade.proprietarioNome()),
                    CobrancaProprietarioEfetivoUtil.somenteDigitos(unidade.proprietarioDocDigitos()),
                    CobrancaProprietarioEfetivoUtil.FonteProprietario.PLANILHA);
        } else {
            efetivo = CobrancaProprietarioEfetivoUtil.resolver(null, null, legadoNome, legadoDoc);
        }

        List<ProcessoEntity> procs = processoUnidadeLookup.listarTodosPorCodigoUnidade(clienteId, cod);
        List<CobrancaProprietarioLegadoProcDto> legadoProcs = montarLegadoProcs(cod8, procs);

        List<String> coprop = new ArrayList<>();
        if (linPlan != null && linPlan.coproprietarios() != null) {
            for (PlanilhaPessoaDto p : linPlan.coproprietarios()) {
                if (p != null && StringUtils.hasText(p.nome())) {
                    coprop.add(p.nome().trim());
                }
            }
        }

        boolean temCoprop = !coprop.isEmpty();
        String classe;
        String mensagem;
        boolean acaoOk;

        if (!efetivo.valido()) {
            classe = CLASSE_SEM_PROPRIETARIO;
            mensagem = "Sem proprietário válido (planilha ou legado).";
            acaoOk = false;
        } else if (legadoProcs.isEmpty()) {
            classe = CLASSE_SEM_LEGADO;
            mensagem = "Unidade sem processo legado — criará processo novo.";
            acaoOk = true;
        } else {
            boolean matchExato = legadoProcs.stream()
                    .anyMatch(lp -> CobrancaProprietarioEfetivoUtil.cpfEquivalente(lp.reuDoc(), efetivo.docDigitos()));
            boolean cpfCorrigidoProvavel = !matchExato && legadoProcs.stream().anyMatch(lp ->
                    nomesSimilares(lp.reuNome(), efetivo.nome())
                            && !CobrancaProprietarioEfetivoUtil.somenteDigitos(lp.reuDoc()).isEmpty());

            boolean exDonoNaPlanilha = linPlan != null && legadoProcs.stream()
                    .anyMatch(lp -> !cpfNaPlanilhaUnidade(linPlan, lp.reuDoc()));

            if (matchExato && !temCoprop) {
                classe = CLASSE_MESMO_REU;
                mensagem = "Réu da planilha coincide com processo legado — merge de débitos.";
                acaoOk = true;
            } else if (cpfCorrigidoProvavel) {
                classe = CLASSE_CPF_CORRIGIDO;
                mensagem = "Mesmo réu com CPF divergente no cadastro — revisar unificação de pessoa.";
                acaoOk = true;
            } else if (temCoprop) {
                classe = CLASSE_COPROPRIETARIOS;
                mensagem = "Planilha com co-proprietários — confirmar réu: " + efetivo.nome() + ".";
                acaoOk = matchExato;
            } else if (exDonoNaPlanilha || !matchExato) {
                classe = CLASSE_TROCA_DONO;
                mensagem = "Planilha indica dono diferente do legado — novo processo (troca de dono).";
                acaoOk = true;
            } else {
                classe = CLASSE_EX_DONO_LEGADO;
                mensagem = "Réu legado ausente da planilha atual — não mergear taxas novas no legado.";
                acaoOk = true;
            }
        }

        String legadoResumoNome = legadoProcs.isEmpty() ? trim(legadoNome) : legadoProcs.getFirst().reuNome();
        String legadoResumoDoc = legadoProcs.isEmpty() ? CobrancaProprietarioEfetivoUtil.somenteDigitos(legadoDoc) : legadoProcs.getFirst().reuDoc();

        return new CobrancaProprietarioDiagnosticoItemDto(
                cod,
                classe,
                efetivo.nome(),
                efetivo.docDigitos(),
                efetivo.fonte().name(),
                legadoResumoNome,
                legadoResumoDoc,
                legadoProcs,
                List.copyOf(coprop),
                mensagem,
                acaoOk);
    }

    private List<CobrancaProprietarioLegadoProcDto> montarLegadoProcs(String cod8, List<ProcessoEntity> procs) {
        List<CobrancaProprietarioLegadoProcDto> out = new ArrayList<>();
        for (ProcessoEntity proc : procs) {
            for (ProcessoParteEntity pp :
                    processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(proc.getId())) {
                if (pp.getPessoa() == null) {
                    continue;
                }
                PessoaEntity pessoa = pessoaRepository.findById(pp.getPessoa().getId()).orElse(pp.getPessoa());
                String doc = CobrancaProprietarioEfetivoUtil.somenteDigitos(pessoa.getCpf());
                if (!StringUtils.hasText(pessoa.getNome()) || !CobrancaProprietarioEfetivoUtil.docValido(doc)) {
                    continue;
                }
                boolean aceito = calculoRodadaRepository
                        .findByCodigoClienteAndNumeroProcessoAndDimensao(cod8, proc.getNumeroInterno(), 0)
                        .map(r -> r.isParcelamentoAceito())
                        .orElse(false);
                out.add(new CobrancaProprietarioLegadoProcDto(
                        proc.getNumeroInterno(),
                        proc.getId(),
                        pessoa.getNome().trim(),
                        doc,
                        aceito));
            }
        }
        return out;
    }

    private static Map<String, UnidadePlanilhaLinhaDto> indexarPlanilha(List<UnidadePlanilhaLinhaDto> linhas) {
        Map<String, UnidadePlanilhaLinhaDto> out = new LinkedHashMap<>();
        if (linhas == null) {
            return out;
        }
        for (UnidadePlanilhaLinhaDto lin : linhas) {
            if (lin == null || !StringUtils.hasText(lin.codigoUnidade())) {
                continue;
            }
            String cod = CobrancaUnidadeFormatUtil.normalizarCodigoUnidade(lin.codigoUnidade());
            out.put(cod, lin);
        }
        return out;
    }

    private static boolean cpfNaPlanilhaUnidade(UnidadePlanilhaLinhaDto lin, String legadoDoc) {
        if (lin.proprietario() != null
                && CobrancaProprietarioEfetivoUtil.cpfEquivalente(lin.proprietario().cpfCnpjNormalizado(), legadoDoc)) {
            return true;
        }
        if (lin.coproprietarios() != null) {
            for (PlanilhaPessoaDto p : lin.coproprietarios()) {
                if (CobrancaProprietarioEfetivoUtil.cpfEquivalente(p.cpfCnpjNormalizado(), legadoDoc)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean nomesSimilares(String a, String b) {
        if (!StringUtils.hasText(a) || !StringUtils.hasText(b)) {
            return false;
        }
        String na = normalizarNome(a);
        String nb = normalizarNome(b);
        return na.equals(nb);
    }

    private static String normalizarNome(String s) {
        return s.trim()
                .toUpperCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
    }

    private static String trim(String s) {
        return s != null ? s.trim() : "";
    }
}
