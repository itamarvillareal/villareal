package br.com.vilareal.projudi.api;

import br.com.vilareal.projudi.ProjudiAssuntoCatalogoService;
import br.com.vilareal.projudi.ProjudiClasseProcessoInicial;
import br.com.vilareal.projudi.ProjudiAssuntoCatalogoService.ClasseItem;
import br.com.vilareal.projudi.ProjudiAssuntoCatalogoService.ModalidadeSugeridaResponse;
import br.com.vilareal.projudi.ProjudiDistribuicaoService;
import br.com.vilareal.projudi.ProjudiDistribuicaoService.InicialRequest;
import br.com.vilareal.projudi.ProjudiDistribuicaoService.ResultadoDistribuicaoInicial;
import br.com.vilareal.projudi.ProjudiDistribuicaoService.ResultadoPreparacaoInicial;
import br.com.vilareal.projudi.ProjudiDistribuicaoService.ValidacaoProntidaoInicial;
import br.com.vilareal.projudi.ProjudiParteResolverService;
import br.com.vilareal.projudi.ProjudiParteResolverService.ParteProjudiResolvida;
import br.com.vilareal.projudi.ProjudiPeticaoService.ArquivoPeticao;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/projudi/iniciais")
@Tag(name = "PROJUDI — iniciais", description = "Preparação de distribuição de inicial até revisão (sem distribuir)")
public class ProjudiInicialController {

    private static final Logger log = LoggerFactory.getLogger(ProjudiInicialController.class);

    private final ProjudiParteResolverService parteResolverService;
    private final ProjudiDistribuicaoService distribuicaoService;
    private final ProjudiAssuntoCatalogoService assuntoCatalogoService;

    public ProjudiInicialController(
            ProjudiParteResolverService parteResolverService,
            ProjudiDistribuicaoService distribuicaoService,
            ProjudiAssuntoCatalogoService assuntoCatalogoService) {
        this.parteResolverService = parteResolverService;
        this.distribuicaoService = distribuicaoService;
        this.assuntoCatalogoService = assuntoCatalogoService;
    }

    @GetMapping("/resolver-parte")
    @Operation(summary = "Resolve pessoa do cadastro para formato PROJUDI (estado/cidade/bairro)")
    public ParteProjudiResolvida resolverParte(
            @RequestParam Long pessoaId, @RequestParam(defaultValue = "1") Long credencialId) {
        log.info("resolver-parte pessoaId={} credencialId={}", pessoaId, credencialId);
        return parteResolverService.resolver(pessoaId, credencialId);
    }

    @GetMapping("/classes")
    @Operation(summary = "Catálogo de classes processuais PROJUDI conhecidas")
    public List<ClasseItem> listarClasses() {
        return assuntoCatalogoService.listarClasses();
    }

    @GetMapping("/assunto-sugerido")
    @Operation(summary = "Sugere assunto e classe com base na natureza da ação do processo")
    public ModalidadeSugeridaResponse assuntoSugerido(@RequestParam(required = false) String naturezaAcao) {
        return assuntoCatalogoService.sugerirModalidade(naturezaAcao);
    }

    @GetMapping("/modalidade-sugerida")
    @Operation(summary = "Alias de /assunto-sugerido — retorna modalidade (classe + assunto) sugerida")
    public ModalidadeSugeridaResponse modalidadeSugerida(@RequestParam(required = false) String naturezaAcao) {
        return assuntoCatalogoService.sugerirModalidade(naturezaAcao);
    }

    @GetMapping("/validar-prontidao")
    @Operation(
            summary = "Lista motivos que impedem preparar/distribuir a inicial",
            description = "Validação local + resolução de partes no PROJUDI. Não executa o fluxo ProcessoCivel.")
    public ValidacaoProntidaoInicial validarProntidao(
            @RequestParam Long credencialId,
            @RequestParam(required = false) String valorCausa,
            @RequestParam(required = false) String idAssuntos,
            @RequestParam(required = false) Long pessoaIdAutor,
            @RequestParam(required = false) Long pessoaIdReu,
            @RequestParam(required = false) String pessoaIdsReu,
            @RequestParam(required = false) List<Long> pessoaIdsReuList,
            @RequestParam(defaultValue = "0") int quantidadeAnexos) {
        return distribuicaoService.validarProntidao(
                credencialId,
                valorCausa,
                parseIdAssuntosCsv(idAssuntos),
                pessoaIdAutor,
                normalizarPessoaIdsReu(pessoaIdReu, pessoaIdsReu, pessoaIdsReuList),
                quantidadeAnexos);
    }

    /**
     * PREPARA até a revisão (Passo 3) do fluxo {@code /ProcessoCivel}; NÃO distribui.
     */
    @PostMapping(value = "/preparar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Prepara inicial no PROJUDI até a revisão",
            description = "Monta o fluxo /ProcessoCivel até o Passo 3 (revisão). "
                    + "Não envia o POST final de distribuição — o usuário confere e distribui manualmente no PROJUDI.")
    public ResultadoPreparacaoInicial preparar(
            @RequestParam Long credencialId,
            @RequestParam String valorCausa,
            @RequestParam String idAssuntos,
            @RequestParam Long pessoaIdAutor,
            @RequestParam(required = false) Long pessoaIdReu,
            @RequestParam(required = false) List<Long> pessoaIdsReu,
            @RequestParam("pdfs") List<MultipartFile> pdfs,
            @RequestParam(value = "idArquivoTipos", required = false) List<Integer> idArquivoTipos,
            @RequestParam(required = false) Integer idProcessoTipo,
            @RequestParam(required = false) Integer processoTipoCodigo)
            throws IOException {
        List<Long> idsReu = normalizarPessoaIdsReu(pessoaIdReu, null, pessoaIdsReu);
        InicialRequest request = montarInicialRequest(
                valorCausa,
                idAssuntos,
                pessoaIdAutor,
                idsReu,
                pdfs,
                idArquivoTipos,
                idProcessoTipo,
                processoTipoCodigo);
        log.info(
                "preparar-inicial credencialId={} assuntos={} autor={} reus={} arquivos={}",
                credencialId,
                request.idAssuntos(),
                pessoaIdAutor,
                idsReu,
                request.arquivos().size());
        return distribuicaoService.prepararInicial(credencialId, request);
    }

    /**
     * Prepara até REVISAO; com {@code confirmar=true} envia o POST final (irreversível) e extrai o número gerado.
     */
    @PostMapping(value = "/distribuir", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Distribui inicial no PROJUDI (Passo 3)",
            description = "Executa prepararInicial e, se confirmar=true, envia o POST de distribuição. "
                    + "Irreversível — cria o processo no PROJUDI. Use confirmar=false para dry-run até REVISAO.")
    public ResultadoDistribuicaoInicial distribuir(
            @RequestParam Long credencialId,
            @RequestParam String valorCausa,
            @RequestParam String idAssuntos,
            @RequestParam Long pessoaIdAutor,
            @RequestParam(required = false) Long pessoaIdReu,
            @RequestParam(required = false) List<Long> pessoaIdsReu,
            @RequestParam("pdfs") List<MultipartFile> pdfs,
            @RequestParam(value = "idArquivoTipos", required = false) List<Integer> idArquivoTipos,
            @RequestParam(defaultValue = "false") boolean confirmar,
            @RequestParam(required = false) Long processoIdOrigem,
            @RequestParam(required = false) Integer idProcessoTipo,
            @RequestParam(required = false) Integer processoTipoCodigo)
            throws IOException {
        List<Long> idsReu = normalizarPessoaIdsReu(pessoaIdReu, null, pessoaIdsReu);
        InicialRequest request = montarInicialRequest(
                valorCausa,
                idAssuntos,
                pessoaIdAutor,
                idsReu,
                pdfs,
                idArquivoTipos,
                idProcessoTipo,
                processoTipoCodigo);
        log.info(
                "distribuir-inicial credencialId={} confirmar={} processoIdOrigem={} assuntos={} reus={} arquivos={}",
                credencialId,
                confirmar,
                processoIdOrigem,
                request.idAssuntos(),
                idsReu,
                request.arquivos().size());
        return distribuicaoService.distribuirInicial(credencialId, request, confirmar, processoIdOrigem);
    }

    private InicialRequest montarInicialRequest(
            String valorCausa,
            String idAssuntos,
            Long pessoaIdAutor,
            List<Long> pessoaIdsReu,
            List<MultipartFile> pdfs,
            List<Integer> idArquivoTipos,
            Integer idProcessoTipo,
            Integer processoTipoCodigo)
            throws IOException {
        if (pessoaIdsReu == null || pessoaIdsReu.isEmpty()) {
            throw new IllegalArgumentException("pessoaIdsReu é obrigatório (ao menos um réu).");
        }
        if (pdfs == null || pdfs.isEmpty()) {
            throw new IllegalArgumentException("pdfs é obrigatório (ao menos um arquivo .p7s).");
        }
        if (idArquivoTipos != null && !idArquivoTipos.isEmpty() && idArquivoTipos.size() != pdfs.size()) {
            throw new IllegalArgumentException(
                    "idArquivoTipos deve ter o mesmo tamanho de pdfs (ou ficar vazio).");
        }
        List<Integer> assuntos = parseIdAssuntosCsv(idAssuntos);
        if (assuntos.isEmpty()) {
            throw new IllegalArgumentException("idAssuntos é obrigatório (CSV com ao menos um id).");
        }
        List<ArquivoPeticao> arquivos = new ArrayList<>(pdfs.size());
        for (int i = 0; i < pdfs.size(); i++) {
            int idTipo = resolverIdArquivoTipo(i, idArquivoTipos);
            arquivos.add(new ArquivoPeticao(
                    pdfs.get(i).getBytes(), idTipo, pdfs.get(i).getOriginalFilename()));
        }
        ProjudiClasseProcessoInicial classe = assuntoCatalogoService.resolverClasse(idProcessoTipo, processoTipoCodigo);
        return new InicialRequest(valorCausa, assuntos, pessoaIdAutor, List.copyOf(pessoaIdsReu), arquivos, classe);
    }

    private static List<Long> normalizarPessoaIdsReu(
            Long pessoaIdReuLegado, String pessoaIdsReuCsv, List<Long> pessoaIdsReuList) {
        List<Long> out = new ArrayList<>();
        if (pessoaIdsReuList != null) {
            for (Long id : pessoaIdsReuList) {
                if (id != null && id > 0 && !out.contains(id)) {
                    out.add(id);
                }
            }
        }
        if (out.isEmpty() && StringUtils.hasText(pessoaIdsReuCsv)) {
            for (String parte : pessoaIdsReuCsv.split("[,;\\s]+")) {
                if (!StringUtils.hasText(parte)) {
                    continue;
                }
                long id = Long.parseLong(parte.trim());
                if (id > 0 && !out.contains(id)) {
                    out.add(id);
                }
            }
        }
        if (out.isEmpty() && pessoaIdReuLegado != null && pessoaIdReuLegado > 0) {
            out.add(pessoaIdReuLegado);
        }
        return List.copyOf(out);
    }

    private static List<Integer> parseIdAssuntosCsv(String csv) {
        if (!StringUtils.hasText(csv)) {
            return List.of();
        }
        List<Integer> out = new ArrayList<>();
        for (String parte : csv.split("[,;\\s]+")) {
            if (!StringUtils.hasText(parte)) {
                continue;
            }
            out.add(Integer.parseInt(parte.trim()));
        }
        return out;
    }

    private static int resolverIdArquivoTipo(int indice, List<Integer> idArquivoTipos) {
        if (idArquivoTipos != null && !idArquivoTipos.isEmpty()) {
            return idArquivoTipos.get(indice);
        }
        return indice == 0 ? 16 : 1;
    }
}
