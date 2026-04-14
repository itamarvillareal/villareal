package br.com.vilareal.condominio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.condominio.api.dto.PlanilhaEnderecoDto;
import br.com.vilareal.condominio.api.dto.PlanilhaPessoaDto;
import br.com.vilareal.condominio.api.dto.UnidadePlanilhaLinhaDto;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasExtracaoResumoDto;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasExtracaoResponse;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasImportErroDto;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasImportRequest;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasImportResponse;
import br.com.vilareal.condominio.planilha.UnidadesProprietariosPlanilhaSupport;
import br.com.vilareal.condominio.planilha.UnidadesProprietariosXlsReader;
import br.com.vilareal.pessoa.application.PessoaMergeService;
import br.com.vilareal.pessoa.application.PessoaMergeService.ContatoPar;
import br.com.vilareal.pessoa.application.PessoaMergeService.EnderecoMergeLinha;
import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImportSupport;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.ProcessoParteWriteRequest;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class CondominioUnidadesPessoasPlanilhaApplicationService {

    private static final String POLO_PROPRIETARIO = "REU";
    private static final String QUAL_PROPRIETARIO = "Proprietário";

    private final ClienteRepository clienteRepository;
    private final PessoaRepository pessoaRepository;
    private final PessoaMergeService pessoaMergeService;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final ProcessoApplicationService processoApplicationService;

    public CondominioUnidadesPessoasPlanilhaApplicationService(
            ClienteRepository clienteRepository,
            PessoaRepository pessoaRepository,
            PessoaMergeService pessoaMergeService,
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            ProcessoApplicationService processoApplicationService) {
        this.clienteRepository = clienteRepository;
        this.pessoaRepository = pessoaRepository;
        this.pessoaMergeService = pessoaMergeService;
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.processoApplicationService = processoApplicationService;
    }

    public UnidadesPessoasExtracaoResponse extrairPessoas(String clienteCodigoRaw, MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new BusinessRuleException("Arquivo da planilha é obrigatório.");
        }
        String nomeArquivo = arquivo.getOriginalFilename() != null ? arquivo.getOriginalFilename() : "";
        String lower = nomeArquivo.toLowerCase();
        if (!lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
            throw new BusinessRuleException("Envie um arquivo .xls ou .xlsx.");
        }
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clienteCodigoRaw);
        ClienteEntity cliente =
                clienteRepository.findByCodigoClienteFetchPessoa(cod8).orElseThrow(() -> new BusinessRuleException(
                        "Cliente não encontrado para o código: " + cod8));
        String nomeCliente = Utf8MojibakeUtil.corrigir(cliente.getPessoa().getNome());

        List<UnidadePlanilhaLinhaDto> linhas;
        try {
            linhas = UnidadesProprietariosXlsReader.lerLinhas(arquivo.getInputStream());
        } catch (IOException e) {
            throw new BusinessRuleException("Não foi possível ler a planilha: " + e.getMessage());
        }

        List<UnidadePlanilhaLinhaDto> enriquecidas = new ArrayList<>();
        Set<String> distUnidades = new HashSet<>();
        Set<String> distCpfProp = new HashSet<>();
        Set<String> distCpfInq = new HashSet<>();
        int linhasComPropCpf = 0;
        int linhasComInqCpf = 0;
        int propExiste = 0;
        int propNovo = 0;
        int inqExiste = 0;
        int inqNovo = 0;

        for (UnidadePlanilhaLinhaDto raw : linhas) {
            distUnidades.add(raw.codigoUnidade());
            PlanilhaPessoaDto pr = normalizarPlanilhaPessoa(raw.proprietario());
            PlanilhaPessoaDto iq = normalizarPlanilhaPessoa(raw.inquilino());

            String sitProp = situacaoCpf(pr.cpfCnpjNormalizado());
            if (!pr.cpfCnpjNormalizado().isBlank()) {
                linhasComPropCpf++;
                distCpfProp.add(pr.cpfCnpjNormalizado());
                if ("EXISTE".equals(sitProp)) {
                    propExiste++;
                } else {
                    propNovo++;
                }
            }

            String sitInq = situacaoInquilino(iq.cpfCnpjNormalizado());
            if (!iq.cpfCnpjNormalizado().isBlank()) {
                linhasComInqCpf++;
                distCpfInq.add(iq.cpfCnpjNormalizado());
                if ("EXISTE".equals(sitInq)) {
                    inqExiste++;
                } else if ("NOVO".equals(sitInq)) {
                    inqNovo++;
                }
            }

            enriquecidas.add(new UnidadePlanilhaLinhaDto(
                    raw.codigoUnidade(), pr, iq, raw.endereco(), sitProp, sitInq));
        }

        UnidadesPessoasExtracaoResumoDto resumo = new UnidadesPessoasExtracaoResumoDto(
                linhas.size(),
                distUnidades.size(),
                linhasComPropCpf,
                linhasComInqCpf,
                distCpfProp.size(),
                distCpfInq.size(),
                propExiste,
                propNovo,
                inqExiste,
                inqNovo);

        return new UnidadesPessoasExtracaoResponse(cod8, nomeCliente, resumo, enriquecidas);
    }

    private String situacaoCpf(String cpfNorm) {
        if (cpfNorm == null || cpfNorm.isBlank()) {
            return "SEM_CPF";
        }
        return pessoaRepository.findByCpf(cpfNorm).isPresent() ? "EXISTE" : "NOVO";
    }

    private String situacaoInquilino(String cpfNorm) {
        if (cpfNorm == null || cpfNorm.isBlank()) {
            return "VAZIO";
        }
        return pessoaRepository.findByCpf(cpfNorm).isPresent() ? "EXISTE" : "NOVO";
    }

    @Transactional
    public UnidadesPessoasImportResponse importarPessoas(UnidadesPessoasImportRequest request) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(request.clienteCodigo());
        ClienteEntity cliente =
                clienteRepository.findByCodigoClienteFetchPessoa(cod8).orElseThrow(() -> new BusinessRuleException(
                        "Cliente não encontrado para o código: " + cod8));
        long pessoaClienteId = cliente.getPessoa().getId();

        int pessoasCriadas = 0;
        int pessoasReutilizadas = 0;
        int contatosAdicionados = 0;
        int enderecosAdicionados = 0;
        int processosEncontrados = 0;
        int partesCriadas = 0;
        int partesJaExistentes = 0;
        int inquilinosMesclados = 0;
        List<UnidadesPessoasImportErroDto> erros = new ArrayList<>();
        // Mesmo importacaoId da importação PDF (fluxo unificado): nunca gerar outro UUID quando vier no body.
        String importacaoId =
                StringUtils.hasText(request.importacaoId()) ? request.importacaoId().trim() : UUID.randomUUID().toString();

        for (UnidadePlanilhaLinhaDto linha : request.unidades()) {
            String codU =
                    linha.codigoUnidade() == null
                            ? ""
                            : UnidadesProprietariosPlanilhaSupport.normalizarCodigoUnidade(linha.codigoUnidade());
            try {
                if (!StringUtils.hasText(codU)) {
                    String exibir =
                            linha.codigoUnidade() != null && !linha.codigoUnidade().isBlank()
                                    ? linha.codigoUnidade().trim()
                                    : "(?)";
                    erros.add(new UnidadesPessoasImportErroDto(exibir, "Código de unidade em branco ou inválido."));
                    continue;
                }
                PlanilhaPessoaDto pr = normalizarPlanilhaPessoa(linha.proprietario());
                if (pr.cpfCnpjNormalizado() == null || pr.cpfCnpjNormalizado().isBlank()) {
                    erros.add(new UnidadesPessoasImportErroDto(codU, "Proprietário sem CPF/CNPJ válido (11 ou 14 dígitos)."));
                    continue;
                }
                if (pr.nome() == null || pr.nome().isBlank()) {
                    erros.add(new UnidadesPessoasImportErroDto(codU, "Proprietário sem nome."));
                    continue;
                }

                Optional<PessoaEntity> opProp = pessoaRepository.findByCpf(pr.cpfCnpjNormalizado());
                PessoaEntity prop;
                if (opProp.isPresent()) {
                    prop = opProp.get();
                    pessoasReutilizadas++;
                } else {
                    prop = criarNovaPessoa(pr, importacaoId);
                    pessoasCriadas++;
                }

                pessoaMergeService.mergeRgSeVazio(prop, pr.rg());
                contatosAdicionados += pessoaMergeService.mergeContatos(prop, contatosDePlanilha(pr), importacaoId);
                enderecosAdicionados +=
                        pessoaMergeService.mergeEnderecos(prop, enderecosDePlanilha(linha.endereco()), importacaoId);

                PlanilhaPessoaDto iq = normalizarPlanilhaPessoa(linha.inquilino());
                if (iq.cpfCnpjNormalizado() != null && !iq.cpfCnpjNormalizado().isBlank()) {
                    if (iq.nome() == null || iq.nome().isBlank()) {
                        erros.add(new UnidadesPessoasImportErroDto(codU, "Inquilino com CPF mas sem nome — ignorado."));
                    } else {
                        Optional<PessoaEntity> opInq = pessoaRepository.findByCpf(iq.cpfCnpjNormalizado());
                        PessoaEntity inq;
                        if (opInq.isPresent()) {
                            inq = opInq.get();
                            pessoasReutilizadas++;
                        } else {
                            inq = criarNovaPessoa(iq, importacaoId);
                            pessoasCriadas++;
                        }
                        pessoaMergeService.mergeRgSeVazio(inq, iq.rg());
                        contatosAdicionados += pessoaMergeService.mergeContatos(inq, contatosDePlanilha(iq), importacaoId);
                        enderecosAdicionados +=
                                pessoaMergeService.mergeEnderecos(inq, enderecosDePlanilha(linha.endereco()), importacaoId);
                        inquilinosMesclados++;
                    }
                }

                Optional<ProcessoEntity> procOpt = processoRepository.findByPessoa_IdAndUnidade(pessoaClienteId, codU);
                if (procOpt.isEmpty()) {
                    erros.add(
                            new UnidadesPessoasImportErroDto(
                                    codU,
                                    "Não existe processo para esta unidade e cliente. A importação do PDF cria um processo"
                                            + " só para unidades que aparecem no relatório com cobrança; as demais precisam de"
                                            + " processo manual ou de um PDF que as inclua."));
                    continue;
                }
                processosEncontrados++;
                ProcessoEntity proc = procOpt.get();

                Optional<ProcessoParteEntity> parteOpt = processoParteRepository
                        .findFirstByProcesso_IdAndPoloIgnoreCaseAndQualificacaoIgnoreCaseOrderByIdAsc(
                                proc.getId(), POLO_PROPRIETARIO, QUAL_PROPRIETARIO);
                if (parteOpt.isEmpty()) {
                    ProcessoParteWriteRequest wr = new ProcessoParteWriteRequest();
                    wr.setPessoaId(prop.getId());
                    wr.setPolo(POLO_PROPRIETARIO);
                    wr.setQualificacao(QUAL_PROPRIETARIO);
                    wr.setOrdem(0);
                    wr.setImportacaoId(importacaoId);
                    processoApplicationService.criarParte(proc.getId(), wr);
                    partesCriadas++;
                } else {
                    ProcessoParteEntity pp = parteOpt.get();
                    if (pp.getPessoa() == null) {
                        pp.setPessoa(prop);
                        if (StringUtils.hasText(importacaoId)) {
                            pp.setImportacaoId(importacaoId);
                        }
                        processoParteRepository.save(pp);
                        partesCriadas++;
                    } else if (pp.getPessoa().getId().equals(prop.getId())) {
                        partesJaExistentes++;
                    } else {
                        erros.add(new UnidadesPessoasImportErroDto(
                                codU,
                                "Já existe parte «Proprietário» (RÉU) vinculada a outra pessoa (id "
                                        + pp.getPessoa().getId()
                                        + ")."));
                    }
                }
            } catch (Exception e) {
                erros.add(new UnidadesPessoasImportErroDto(codU, e.getMessage() != null ? e.getMessage() : e.toString()));
            }
        }

        return new UnidadesPessoasImportResponse(
                importacaoId,
                pessoasCriadas,
                pessoasReutilizadas,
                contatosAdicionados,
                enderecosAdicionados,
                processosEncontrados,
                partesCriadas,
                partesJaExistentes,
                inquilinosMesclados,
                erros);
    }

    private static PlanilhaPessoaDto normalizarPlanilhaPessoa(PlanilhaPessoaDto p) {
        if (p == null) {
            return new PlanilhaPessoaDto("", "", "", "", List.of(), List.of());
        }
        String cpf =
                CadastroPessoasPlanilhaImportSupport.resolveCpfCnpjDigitosPlanilha(
                        p.cpfCnpjBruto(), p.cpfCnpjNormalizado());
        String nome = CadastroPessoasPlanilhaImportSupport.normalizeNomeCadastro(p.nome());
        return new PlanilhaPessoaDto(nome, p.cpfCnpjBruto(), cpf, p.rg(), p.emails(), p.telefones());
    }

    private PessoaEntity criarNovaPessoa(PlanilhaPessoaDto dto, String importacaoId) {
        PessoaEntity n = new PessoaEntity();
        n.setNome(CadastroPessoasPlanilhaImportSupport.normalizeNomeCadastro(dto.nome()));
        n.setCpf(dto.cpfCnpjNormalizado());
        n.setEmail(null);
        String tel0 = dto.telefones().isEmpty()
                ? null
                : CadastroPessoasPlanilhaImportSupport.truncate(dto.telefones().getFirst(), 40);
        n.setTelefone(tel0);
        n.setAtivo(true);
        n.setMarcadoMonitoramento(false);
        if (importacaoId != null && !importacaoId.isBlank()) {
            n.setImportacaoId(importacaoId);
        }
        return pessoaRepository.save(n);
    }

    private List<ContatoPar> contatosDePlanilha(PlanilhaPessoaDto p) {
        List<ContatoPar> list = new ArrayList<>();
        for (String em : p.emails()) {
            list.add(new ContatoPar(PessoaMergeService.TIPO_CONTATO_EMAIL, em));
        }
        for (String tel : p.telefones()) {
            list.add(new ContatoPar(PessoaMergeService.TIPO_CONTATO_TELEFONE, tel));
        }
        return list;
    }

    private List<EnderecoMergeLinha> enderecosDePlanilha(PlanilhaEnderecoDto e) {
        String rua = UnidadesProprietariosPlanilhaSupport.montarRuaParaPersistencia(e);
        String cep = e.cep() != null && !e.cep().isBlank() ? e.cep() : null;
        if ((rua == null || rua.isBlank()) && (cep == null || cep.isBlank())) {
            return List.of();
        }
        String comp = e.complemento() != null && !e.complemento().isBlank() ? e.complemento().trim() : null;
        return List.of(new EnderecoMergeLinha(
                rua,
                e.bairro(),
                e.uf(),
                e.cidade(),
                cep,
                comp));
    }
}
