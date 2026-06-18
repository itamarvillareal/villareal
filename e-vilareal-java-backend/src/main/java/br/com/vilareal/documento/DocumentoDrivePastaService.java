package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.ProcessoCanonicalLookup;
import br.com.vilareal.processo.application.ProcessoPartesVinculoTextoResolver;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class DocumentoDrivePastaService {

    private static final Logger log = LoggerFactory.getLogger(DocumentoDrivePastaService.class);

    private static final Set<String> PASTAS_TIPO_DOCUMENTO = Set.of(
            TipoDocumento.PETICAO.getPasta(),
            TipoDocumento.PROCURACAO.getPasta(),
            TipoDocumento.CONTRATO.getPasta(),
            TipoDocumento.DECLARACAO.getPasta(),
            TipoDocumento.DOCUMENTO.getPasta());

    private final ClienteResolverService clienteResolverService;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final GoogleDriveService googleDriveService;

    public DocumentoDrivePastaService(
            ClienteResolverService clienteResolverService,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            GoogleDriveService googleDriveService) {
        this.clienteResolverService = clienteResolverService;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.googleDriveService = googleDriveService;
    }

    @Transactional(readOnly = true)
    public String resolverPastaDestino(
            GoogleDriveService driveService,
            String codigoCliente,
            Integer numeroInterno,
            Long pessoaIdFallback,
            TipoDocumento tipoDocumento) throws Exception {
        ContextoDrive contexto = resolverContextoDrive(codigoCliente, numeroInterno, pessoaIdFallback);
        return obterPastaDestino(
                driveService,
                contexto.codigoCliente(),
                contexto.nomeCliente(),
                contexto.numeroInterno(),
                contexto.parteOposta(),
                tipoDocumento);
    }

    @Transactional(readOnly = true)
    public ContextoDrive resolverContextoDrive(String codigoCliente, Integer numeroInterno, Long pessoaIdFallback) {
        DadosClienteDrive cliente;
        int numInterno = numeroInterno != null ? numeroInterno : 0;
        String parteOposta = "Sem Parte Oposta";

        if (StringUtils.hasText(codigoCliente)) {
            cliente = resolverDadosCliente(null, codigoCliente.trim());
            if (numeroInterno != null && numeroInterno >= 0) {
                Optional<ProcessoEntity> processo = buscarProcessoEntity(codigoCliente.trim(), numeroInterno);
                if (processo.isPresent()) {
                    parteOposta = resolverNomePartesOpostas(processo.get().getId());
                }
            }
        } else if (pessoaIdFallback != null) {
            cliente = resolverDadosCliente(pessoaIdFallback, null);
        } else {
            cliente = new DadosClienteDrive("00000000", "Sem Cliente");
        }

        return new ContextoDrive(cliente.codigoCliente(), cliente.nomeCliente(), numInterno, parteOposta);
    }

    @Transactional(readOnly = true)
    public DrivePastaProcessoDto resolverPastaRaizProcesso(
            GoogleDriveService driveService, String codigoCliente, Integer numeroInterno)
            throws Exception {
        if (!driveService.isConfigurado()) {
            return null;
        }
        ContextoDrive contexto = resolverContextoDrive(codigoCliente, numeroInterno, null);
        String nomePastaCliente = formatarNomePastaCliente(contexto.codigoCliente(), contexto.nomeCliente());
        String pastaClienteId = driveService.encontrarOuCriarPastaPublic(
                nomePastaCliente, driveService.getClientesFolderId());

        String nomePastaProcesso = formatarNomePastaProcesso(contexto.numeroInterno());
        String pastaProcessoId = driveService.encontrarOuCriarPastaPublic(
                nomePastaProcesso, pastaClienteId);

        String pastaRaizId = pastaProcessoId;
        String nomePasta = nomePastaProcesso;
        StringBuilder caminho = new StringBuilder(nomePastaCliente).append(" / ").append(nomePastaProcesso);
        if (StringUtils.hasText(contexto.parteOposta())) {
            nomePasta = formatarNomePastaParteOposta(contexto.parteOposta());
            pastaRaizId = driveService.encontrarOuCriarPastaPublic(nomePasta, pastaProcessoId);
            caminho.append(" / ").append(nomePasta);
        }

        String webViewLink = driveService.obterWebViewLink(pastaRaizId);
        return new DrivePastaProcessoDto(pastaRaizId, webViewLink, nomePasta, caminho.toString());
    }

    /**
     * Resolve o ID da pasta {@code Proc. NN} do processo no Drive (Clientes → cliente → Proc.).
     * Reutiliza a mesma lógica de {@link #resolverPastaRaizProcesso} até o nível do processo,
     * sem descer à pasta de parte oposta.
     */
    @Transactional(readOnly = true)
    public Optional<String> resolverIdPastaProcesso(ProcessoEntity processo) {
        if (!googleDriveService.isConfigurado() || processo == null) {
            return Optional.empty();
        }
        try {
            String codigoCliente = resolverCodigoClienteDoProcesso(processo);
            Integer numeroInterno = processo.getNumeroInterno();
            if (!StringUtils.hasText(codigoCliente) || numeroInterno == null) {
                return Optional.empty();
            }
            DadosClienteDrive cliente = resolverDadosCliente(null, codigoCliente.trim());
            String pastaClienteId = googleDriveService.encontrarOuCriarPastaPublic(
                    formatarNomePastaCliente(cliente.codigoCliente(), cliente.nomeCliente()),
                    googleDriveService.getClientesFolderId());
            String pastaProcessoId = googleDriveService.encontrarOuCriarPastaPublic(
                    formatarNomePastaProcesso(numeroInterno), pastaClienteId);
            return Optional.of(pastaProcessoId);
        } catch (Exception e) {
            log.warn("Erro ao resolver pasta do processo no Drive (processoId={}): {}",
                    processo.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    public String obterPastaDestino(
            GoogleDriveService driveService,
            String codigoCliente,
            String nomeCliente,
            Integer numeroInterno,
            String parteOposta,
            TipoDocumento tipoDocumento) throws Exception {
        String nomeClientes = formatarNomePastaCliente(codigoCliente, nomeCliente);
        String pastaClienteId = driveService.encontrarOuCriarPastaPublic(
                nomeClientes, driveService.getClientesFolderId());

        String nomeProcesso = formatarNomePastaProcesso(numeroInterno);
        String pastaProcessoId = driveService.encontrarOuCriarPastaPublic(
                nomeProcesso, pastaClienteId);

        String pastaParenteId = pastaProcessoId;
        if (StringUtils.hasText(parteOposta)) {
            String nomeParteOposta = formatarNomePastaParteOposta(parteOposta);
            pastaParenteId = driveService.encontrarOuCriarPastaPublic(
                    nomeParteOposta, pastaProcessoId);
        }

        return driveService.encontrarOuCriarPastaPublic(tipoDocumento.getPasta(), pastaParenteId);
    }

    public void atualizarPastaDriveAposAlteracaoPartes(Long processoId) {
        if (!googleDriveService.isConfigurado() || processoId == null) {
            return;
        }
        try {
            ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
            if (processo == null) {
                return;
            }
            String codigoCliente = resolverCodigoClienteDoProcesso(processo);
            Integer numeroInterno = processo.getNumeroInterno();
            if (!StringUtils.hasText(codigoCliente) || numeroInterno == null) {
                return;
            }
            atualizarPastaDriveAposAlteracaoPartes(codigoCliente, numeroInterno);
        } catch (Exception e) {
            log.warn("Erro ao atualizar pasta no Drive: {}", e.getMessage());
        }
    }

    public void atualizarPastaDriveAposAlteracaoPartes(String codigoCliente, Integer numeroInterno) {
        if (!googleDriveService.isConfigurado()
                || !StringUtils.hasText(codigoCliente)
                || numeroInterno == null) {
            return;
        }
        try {
            Optional<ProcessoEntity> processoOpt = buscarProcessoEntity(codigoCliente.trim(), numeroInterno);
            if (processoOpt.isEmpty()) {
                return;
            }
            String nomeAtualizado = resolverNomePartesOpostas(processoOpt.get().getId());
            DadosClienteDrive cliente = resolverDadosCliente(null, codigoCliente.trim());

            String pastaClienteId = googleDriveService.encontrarPastaExistente(
                    formatarNomePastaCliente(cliente.codigoCliente(), cliente.nomeCliente()),
                    googleDriveService.getClientesFolderId());
            if (pastaClienteId == null) {
                return;
            }

            String pastaProcessoId = googleDriveService.encontrarPastaExistente(
                    formatarNomePastaProcesso(numeroInterno), pastaClienteId);
            if (pastaProcessoId == null) {
                return;
            }

            String nomeParteOpostaSanitizado = formatarNomePastaParteOposta(nomeAtualizado);
            List<com.google.api.services.drive.model.File> subpastas =
                    googleDriveService.listarSubpastas(pastaProcessoId);

            com.google.api.services.drive.model.File pastaParteOposta = subpastas.stream()
                    .filter(f -> !PASTAS_TIPO_DOCUMENTO.contains(f.getName()))
                    .findFirst()
                    .orElse(null);

            if (pastaParteOposta != null
                    && !nomeParteOpostaSanitizado.equals(pastaParteOposta.getName())) {
                googleDriveService.renomearPasta(pastaParteOposta.getId(), nomeParteOpostaSanitizado);
                log.info(
                        "Pasta de parte oposta renomeada no Drive: {} → {}",
                        pastaParteOposta.getName(),
                        nomeParteOpostaSanitizado);
            }
        } catch (Exception e) {
            log.warn("Erro ao atualizar pasta no Drive: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public String resolverNomePartesOpostas(Long processoId) {
        if (processoId == null) {
            return "Sem Parte Oposta";
        }
        ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
        if (processo == null) {
            return "Sem Parte Oposta";
        }
        List<ProcessoParteEntity> partes =
                processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId);
        String texto = ProcessoPartesVinculoTextoResolver.parteOpostaParaNomePasta(processo, partes);
        if (!StringUtils.hasText(texto)) {
            return "Sem Parte Oposta";
        }
        return QualificacaoPessoaUtil.normalizarNome(texto.trim());
    }

    @Transactional(readOnly = true)
    public DadosClienteDrive resolverDadosCliente(Long pessoaId, String codigoClienteInformado) {
        if (StringUtils.hasText(codigoClienteInformado)) {
            return clienteResolverService
                    .encontrarClientePorCodigo(codigoClienteInformado.trim())
                    .map(this::toDadosCliente)
                    .orElse(new DadosClienteDrive(
                            codigoClienteInformado.trim(),
                            "Cliente"));
        }
        if (pessoaId == null) {
            return new DadosClienteDrive("00000000", "Sem Cliente");
        }
        try {
            ClienteEntity cliente = clienteResolverService.resolverClienteParaTitular(pessoaId);
            return toDadosCliente(cliente);
        } catch (ResourceNotFoundException ex) {
            return pessoaRepository.findById(pessoaId)
                    .map(this::toDadosPessoa)
                    .orElse(new DadosClienteDrive(String.format("%08d", pessoaId), "Sem Cliente"));
        }
    }

    @Transactional(readOnly = true)
    public String resolverNomePessoa(Long pessoaId) {
        if (pessoaId == null) {
            return "Sem Nome";
        }
        return pessoaRepository.findById(pessoaId)
                .map(PessoaEntity::getNome)
                .filter(StringUtils::hasText)
                .map(nome -> QualificacaoPessoaUtil.normalizarNome(nome.trim()))
                .orElse("Sem Nome");
    }

    @Transactional(readOnly = true)
    Optional<ProcessoEntity> buscarProcessoEntity(String codigoCliente, int numeroInterno) {
        if (numeroInterno < 0 || !StringUtils.hasText(codigoCliente)) {
            return Optional.empty();
        }
        Optional<ClienteEntity> clienteOpt = clienteResolverService.encontrarClientePorCodigo(codigoCliente.trim());
        if (clienteOpt.isPresent()) {
            ClienteEntity cliente = clienteOpt.get();
            Optional<ProcessoEntity> porCliente = ProcessoCanonicalLookup.escolher(
                    processoRepository.findAllByCliente_IdAndNumeroInternoOrderByIdDesc(
                            cliente.getId(), numeroInterno),
                    cliente.getPessoa().getId());
            if (porCliente.isPresent()) {
                return porCliente;
            }
            return processoRepository.findByPessoa_IdAndNumeroInterno(
                    cliente.getPessoa().getId(), numeroInterno);
        }
        Optional<Long> resolved = clienteCodigoPessoaResolver.resolverPessoaIdComFallbackCliente(codigoCliente.trim());
        if (resolved.isEmpty()) {
            return Optional.empty();
        }
        return processoRepository.findByPessoa_IdAndNumeroInterno(resolved.get(), numeroInterno);
    }

    static String formatarNomePastaCliente(String codigoCliente, String nomeCliente) {
        String codigo = StringUtils.hasText(codigoCliente) ? codigoCliente.trim() : "00000000";
        String nome = StringUtils.hasText(nomeCliente)
                ? QualificacaoPessoaUtil.normalizarNome(nomeCliente.trim())
                : "Sem Cliente";
        return GoogleDriveService.sanitizarNomePasta(codigo + " - " + nome);
    }

    static String formatarNomePastaProcesso(Integer numeroInterno) {
        int numero = numeroInterno != null ? numeroInterno : 0;
        return String.format("Proc. %02d", numero);
    }

    static String formatarNomePastaParteOposta(String parteOposta) {
        return GoogleDriveService.sanitizarNomePasta(
                QualificacaoPessoaUtil.normalizarNome(parteOposta.trim()));
    }

    static String formatarNomeArquivoProcuracao(String nomePessoa, java.time.LocalDate data) {
        String nome = StringUtils.hasText(nomePessoa)
                ? QualificacaoPessoaUtil.normalizarNome(nomePessoa.trim())
                : "Sem Nome";
        java.time.LocalDate dataArquivo = data != null ? data : java.time.LocalDate.now();
        return GoogleDriveService.sanitizarNomeArquivo(
                "Procuracao - " + nome + " - " + dataArquivo);
    }

    static String formatarNomeArquivoPeticao(String tipoPeca, java.time.LocalDate data) {
        String tipo = StringUtils.hasText(tipoPeca) ? tipoPeca.trim() : "Peticao";
        java.time.LocalDate dataArquivo = data != null ? data : java.time.LocalDate.now();
        return GoogleDriveService.sanitizarNomeArquivo(
                "Peticao - " + tipo + " - " + dataArquivo);
    }

    public String resolverCodigoClienteDoProcesso(ProcessoEntity processo) {
        ClienteEntity cliente = processo.getCliente();
        if (cliente != null && StringUtils.hasText(cliente.getCodigoCliente())) {
            return cliente.getCodigoCliente().trim();
        }
        if (processo.getPessoa() != null) {
            return clienteCodigoPessoaResolver.codigoClienteExibicaoParaPessoaId(processo.getPessoa().getId());
        }
        return null;
    }

    private DadosClienteDrive toDadosCliente(ClienteEntity cliente) {
        String codigo = cliente.getCodigoCliente() != null
                ? cliente.getCodigoCliente().trim()
                : "00000000";
        return new DadosClienteDrive(codigo, nomeExibicaoCliente(cliente));
    }

    private DadosClienteDrive toDadosPessoa(PessoaEntity pessoa) {
        String codigo = String.format("%08d", pessoa.getId());
        String nome = pessoa.getNome() != null
                ? QualificacaoPessoaUtil.normalizarNome(pessoa.getNome().trim())
                : "Pessoa " + pessoa.getId();
        return new DadosClienteDrive(codigo, nome);
    }

    private String nomeExibicaoCliente(ClienteEntity cliente) {
        if (StringUtils.hasText(cliente.getNomeReferencia())) {
            return QualificacaoPessoaUtil.normalizarNome(cliente.getNomeReferencia().trim());
        }
        PessoaEntity pessoa = cliente.getPessoa();
        if (pessoa != null && StringUtils.hasText(pessoa.getNome())) {
            return QualificacaoPessoaUtil.normalizarNome(pessoa.getNome().trim());
        }
        return "Cliente";
    }

    public record DadosClienteDrive(String codigoCliente, String nomeCliente) {}

    public record ContextoDrive(
            String codigoCliente, String nomeCliente, Integer numeroInterno, String parteOposta) {}
}
