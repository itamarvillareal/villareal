package br.com.vilareal.projudi.api;

import br.com.vilareal.processo.api.dto.AssinarAutomaticoResponse;
import br.com.vilareal.processo.api.dto.LoteAssinaturaStatusResponse;
import br.com.vilareal.processo.application.DiagnosticoAssinaturaAutomaticaService;
import br.com.vilareal.projudi.api.dto.InicialArquivoAssinadoResponse;
import br.com.vilareal.projudi.application.ProjudiInicialAssinaturaService;
import br.com.vilareal.projudi.ProjudiClasseProcessoInicial;
import br.com.vilareal.projudi.ProjudiInicialOpcoesPasso3;
import br.com.vilareal.projudi.ProjudiAssuntoCatalogoService;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    private final ProjudiInicialAssinaturaService inicialAssinaturaService;
    private final DiagnosticoAssinaturaAutomaticaService assinaturaAutomaticaService;

    public ProjudiInicialController(
            ProjudiParteResolverService parteResolverService,
            ProjudiDistribuicaoService distribuicaoService,
            ProjudiAssuntoCatalogoService assuntoCatalogoService,
            ProjudiInicialAssinaturaService inicialAssinaturaService,
            DiagnosticoAssinaturaAutomaticaService assinaturaAutomaticaService) {
        this.parteResolverService = parteResolverService;
        this.distribuicaoService = distribuicaoService;
        this.assuntoCatalogoService = assuntoCatalogoService;
        this.inicialAssinaturaService = inicialAssinaturaService;
        this.assinaturaAutomaticaService = assinaturaAutomaticaService;
    }

    @GetMapping("/resolver-parte")
    @Operation(summary = "Resolve pessoa do cadastro para formato PROJUDI (estado/cidade/bairro)")
    public ParteProjudiResolvida resolverParte(
            @RequestParam Long pessoaId,
            @RequestParam(defaultValue = "1") Long credencialId,
            @RequestParam(required = false) Long pessoaEnderecoId,
            @RequestParam(required = false) Long processoId) {
        log.info(
                "resolver-parte pessoaId={} credencialId={} pessoaEnderecoId={} processoId={}",
                pessoaId,
                credencialId,
                pessoaEnderecoId,
                processoId);
        Long enderecoId = pessoaEnderecoId;
        if (enderecoId == null && processoId != null) {
            enderecoId = distribuicaoService.enderecoIdDaParteNoProcesso(processoId, pessoaId);
        }
        return parteResolverService.resolver(pessoaId, credencialId, enderecoId);
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
            @RequestParam(defaultValue = "0") int quantidadeAnexos,
            @RequestParam(required = false) Long processoIdOrigem) {
        return distribuicaoService.validarProntidao(
                credencialId,
                valorCausa,
                parseIdAssuntosCsv(idAssuntos),
                pessoaIdAutor,
                normalizarPessoaIdsReu(pessoaIdReu, pessoaIdsReu, pessoaIdsReuList),
                quantidadeAnexos,
                processoIdOrigem);
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
            @RequestParam(required = false) Integer processoTipoCodigo,
            @RequestParam(required = false) Boolean segredoJustica,
            @RequestParam(required = false) Boolean naoMarcarAudiencia,
            @RequestParam(required = false) Boolean juizo100Digital,
            @RequestParam(required = false) Boolean prioridadeMaior60Anos,
            @RequestParam(required = false) Long processoIdOrigem)
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
                processoTipoCodigo,
                segredoJustica,
                naoMarcarAudiencia,
                juizo100Digital,
                prioridadeMaior60Anos,
                processoIdOrigem);
        log.info(
                "preparar-inicial credencialId={} processoIdOrigem={} assuntos={} autor={} reus={} arquivos={}",
                credencialId,
                processoIdOrigem,
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
            @RequestParam(required = false) Integer processoTipoCodigo,
            @RequestParam(required = false) Boolean segredoJustica,
            @RequestParam(required = false) Boolean naoMarcarAudiencia,
            @RequestParam(required = false) Boolean juizo100Digital,
            @RequestParam(required = false) Boolean prioridadeMaior60Anos)
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
                processoTipoCodigo,
                segredoJustica,
                naoMarcarAudiencia,
                juizo100Digital,
                prioridadeMaior60Anos,
                processoIdOrigem);
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

    @PostMapping("/assinar-automatico")
    @Operation(
            summary = "Assina automaticamente PDFs da pasta «Assinar» (inicial)",
            description =
                    "Enfileira lote PREPARANDO, busca PDFs no Drive da subpasta «Assinar» do processo "
                            + "e libera para o assinador Windows. Use GET lote-assinatura/{loteId} para polling.")
    public AssinarAutomaticoResponse assinarAutomatico(
            @RequestParam Long credencialId,
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno) {
        log.info(
                "assinar-automatico-inicial credencialId={} processo={}/{}",
                credencialId,
                codigoCliente,
                numeroInterno);
        return inicialAssinaturaService.assinarAutomatico(credencialId, codigoCliente, numeroInterno);
    }

    @PostMapping(value = "/assinar-automatico-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Assina PDFs enviados da máquina (inicial)",
            description =
                    "Enfileira lote PREPARANDO com PDF/JPG/MP4 enviados pelo navegador e libera para o assinador Windows.")
    public AssinarAutomaticoResponse assinarAutomaticoUpload(
            @RequestParam Long credencialId,
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno,
            @RequestParam("pdfs") List<MultipartFile> pdfs) {
        log.info(
                "assinar-automatico-upload-inicial credencialId={} processo={}/{} arquivos={}",
                credencialId,
                codigoCliente,
                numeroInterno,
                pdfs != null ? pdfs.size() : 0);
        return inicialAssinaturaService.assinarAutomaticoComPdfsLocais(
                credencialId, codigoCliente, numeroInterno, pdfs);
    }

    @GetMapping("/lote-assinatura/{loteId}")
    @Operation(summary = "Status do lote de assinatura automática (inicial)")
    public LoteAssinaturaStatusResponse statusLoteAssinatura(@PathVariable Long loteId) {
        return assinaturaAutomaticaService.consultarStatus(loteId);
    }

    @PostMapping("/lote-assinatura/{loteId}/reliberar")
    @Operation(summary = "Re-libera lote após TOKEN_OCUPADO (inicial)")
    public LoteAssinaturaStatusResponse reliberarLoteAssinatura(@PathVariable Long loteId) {
        return assinaturaAutomaticaService.reliberar(loteId);
    }

    @PostMapping("/lote-assinatura/{loteId}/cancelar")
    @Operation(summary = "Cancela preparo assíncrono do lote (inicial)")
    public LoteAssinaturaStatusResponse cancelarLoteAssinatura(@PathVariable Long loteId) {
        return assinaturaAutomaticaService.cancelar(loteId);
    }

    @GetMapping("/arquivos-assinados")
    @Operation(
            summary = "Lista .p7s assinados prontos para anexar na inicial",
            description = "Retorna arquivos da petição INICIAL-{cod}-{proc} com status ASSINADA.")
    public List<InicialArquivoAssinadoResponse> listarArquivosAssinados(
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno,
            @RequestParam(required = false) Long peticaoId) {
        return inicialAssinaturaService.listarArquivosAssinados(codigoCliente, numeroInterno, peticaoId);
    }

    @GetMapping(value = "/arquivos-assinados/{arquivoId}/p7s", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @Operation(summary = "Baixa .p7s assinado para anexar na inicial")
    public ResponseEntity<byte[]> baixarP7sAssinado(
            @PathVariable Long arquivoId,
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno) {
        byte[] bytes = inicialAssinaturaService.baixarP7s(arquivoId, codigoCliente, numeroInterno);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"documento.p7s\"")
                .body(bytes);
    }

    @DeleteMapping("/fila-peticao/{peticaoId}")
    @Operation(
            summary = "Exclui petição INICIAL-* da fila (inclusive PROTOCOLADA pelo fluxo errado)",
            description = "Libera nova assinatura automática na Distribuir Inicial PROJUDI.")
    public ResponseEntity<Void> excluirPeticaoFila(
            @PathVariable Long peticaoId,
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno) {
        inicialAssinaturaService.excluirPeticaoFila(peticaoId, codigoCliente, numeroInterno);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/fila-peticao/{peticaoId}/arquivos/{arquivoId}")
    @Operation(summary = "Exclui um arquivo da petição INICIAL-* na fila")
    public ResponseEntity<Void> excluirArquivoFila(
            @PathVariable Long peticaoId,
            @PathVariable Long arquivoId,
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno) {
        inicialAssinaturaService.excluirArquivoFila(peticaoId, arquivoId, codigoCliente, numeroInterno);
        return ResponseEntity.noContent().build();
    }

    private InicialRequest montarInicialRequest(
            String valorCausa,
            String idAssuntos,
            Long pessoaIdAutor,
            List<Long> pessoaIdsReu,
            List<MultipartFile> pdfs,
            List<Integer> idArquivoTipos,
            Integer idProcessoTipo,
            Integer processoTipoCodigo,
            Boolean segredoJustica,
            Boolean naoMarcarAudiencia,
            Boolean juizo100Digital,
            Boolean prioridadeMaior60Anos,
            Long processoIdOrigem)
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
        ProjudiInicialOpcoesPasso3 opcoesPasso3 =
                ProjudiInicialOpcoesPasso3.of(segredoJustica, naoMarcarAudiencia, juizo100Digital);
        Boolean prioridadeResolvida = prioridadeMaior60Anos;
        if (prioridadeResolvida == null) {
            prioridadeResolvida = parteResolverService.autorMaiorDe60Anos(pessoaIdAutor);
        }
        return new InicialRequest(
                valorCausa,
                assuntos,
                pessoaIdAutor,
                List.copyOf(pessoaIdsReu),
                arquivos,
                classe,
                opcoesPasso3,
                prioridadeResolvida,
                processoIdOrigem);
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
