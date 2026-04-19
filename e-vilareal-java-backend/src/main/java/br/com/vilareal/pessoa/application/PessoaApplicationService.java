package br.com.vilareal.pessoa.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.api.dto.*;
import br.com.vilareal.pessoa.infrastructure.persistence.PessoaSpecifications;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.*;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.*;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PessoaApplicationService {

    private final PessoaRepository pessoaRepository;
    private final PessoaComplementarRepository complementarRepository;
    private final PessoaEnderecoRepository enderecoRepository;
    private final PessoaContatoRepository contatoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;

    public PessoaApplicationService(
            PessoaRepository pessoaRepository,
            PessoaComplementarRepository complementarRepository,
            PessoaEnderecoRepository enderecoRepository,
            PessoaContatoRepository contatoRepository,
            UsuarioRepository usuarioRepository,
            ClienteRepository clienteRepository) {
        this.pessoaRepository = pessoaRepository;
        this.complementarRepository = complementarRepository;
        this.enderecoRepository = enderecoRepository;
        this.contatoRepository = contatoRepository;
        this.usuarioRepository = usuarioRepository;
        this.clienteRepository = clienteRepository;
    }

    @Transactional(readOnly = true)
    public List<PessoaCadastroResponse> listar(
            boolean apenasAtivos,
            String nome,
            String cpf,
            Long codigo,
            String cpfAdicional) {
        Specification<PessoaEntity> spec = PessoaSpecifications.comFiltros(
                apenasAtivos ? true : null,
                nome,
                cpf,
                codigo,
                cpfAdicional);
        return pessoaRepository.findAll(spec).stream()
                .map(this::toResponseBasico)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<PessoaCadastroResponse> listarPaginado(
            boolean apenasAtivos,
            String nome,
            String cpf,
            Long codigo,
            String cpfAdicional,
            Pageable pageable) {
        Specification<PessoaEntity> spec = PessoaSpecifications.comFiltros(
                apenasAtivos ? true : null,
                nome,
                cpf,
                codigo,
                cpfAdicional);
        return pessoaRepository.findAll(spec, pageable).map(this::toResponseBasico);
    }

    @Transactional(readOnly = true)
    public long proximoId() {
        return pessoaRepository.calcularProximoId();
    }

    @Transactional(readOnly = true)
    public PessoaCadastroResponse buscar(Long id) {
        PessoaEntity p = pessoaRepository.findDetailById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + id));
        return toResponseCompleto(p);
    }

    @Transactional
    public PessoaCadastroResponse criar(PessoaCadastroRequest req) {
        String cpf = normalizarCpf(req.getCpf());
        validarUnicidadeCpf(cpf, null);
        validarUnicidadeEmail(req.getEmail(), null);
        validarResponsavel(null, req.getResponsavelId());

        PessoaEntity p = new PessoaEntity();
        aplicarNucleo(p, req, cpf);
        p = pessoaRepository.save(p);
        garantirClienteParaPessoa(p);
        return toResponseCompleto(pessoaRepository.findDetailById(p.getId()).orElse(p));
    }

    @Transactional
    public PessoaCadastroResponse atualizar(Long id, PessoaCadastroRequest req) {
        PessoaEntity p = pessoaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + id));
        String cpf = normalizarCpf(req.getCpf());
        validarUnicidadeCpf(cpf, id);
        validarUnicidadeEmail(req.getEmail(), id);
        validarResponsavel(id, req.getResponsavelId());

        aplicarNucleo(p, req, cpf);
        p = pessoaRepository.save(p);
        garantirClienteParaPessoa(p);
        return toResponseCompleto(pessoaRepository.findDetailById(p.getId()).orElse(p));
    }

    @Transactional
    public void patchAtivo(Long id, boolean ativo) {
        PessoaEntity p = pessoaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + id));
        p.setAtivo(ativo);
        pessoaRepository.save(p);
    }

    @Transactional
    public void excluir(Long id) {
        if (usuarioRepository.existsByPessoa_Id(id)) {
            throw new BusinessRuleException("Não é possível excluir: existe usuário vinculado a esta pessoa.");
        }
        PessoaEntity p = pessoaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + id));
        pessoaRepository.delete(p);
    }

    @Transactional(readOnly = true)
    public PessoaComplementarPayload obterComplementar(Long pessoaId) {
        garantirPessoaExiste(pessoaId);
        return complementarRepository.findById(pessoaId)
                .map(this::toComplementarPayload)
                .orElseGet(PessoaComplementarPayload::new);
    }

    @Transactional
    public PessoaComplementarPayload salvarComplementar(Long pessoaId, PessoaComplementarPayload payload) {
        PessoaEntity p = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));
        PessoaComplementarEntity e = complementarRepository.findById(pessoaId).orElseGet(() -> {
            PessoaComplementarEntity x = new PessoaComplementarEntity();
            x.setPessoa(p);
            return x;
        });
        e.setRg(payload.getRg());
        e.setOrgaoExpedidor(payload.getOrgaoExpedidor());
        e.setProfissao(payload.getProfissao());
        e.setNacionalidade(payload.getNacionalidade());
        e.setEstadoCivil(payload.getEstadoCivil());
        e.setGenero(payload.getGenero());
        complementarRepository.save(e);
        return toComplementarPayload(e);
    }

    @Transactional(readOnly = true)
    public List<PessoaEnderecoItemResponse> listarEnderecos(Long pessoaId) {
        garantirPessoaExiste(pessoaId);
        return enderecoRepository.findByPessoa_IdOrderByNumeroOrdemAsc(pessoaId).stream()
                .map(this::toEnderecoResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<PessoaEnderecoItemResponse> substituirEnderecos(Long pessoaId, List<PessoaEnderecoItemRequest> itens) {
        PessoaEntity p = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));
        enderecoRepository.deleteByPessoa_Id(pessoaId);
        for (PessoaEnderecoItemRequest r : itens) {
            PessoaEnderecoEntity e = new PessoaEnderecoEntity();
            e.setPessoa(p);
            e.setNumeroOrdem(r.getNumero());
            e.setRua(r.getRua());
            e.setBairro(r.getBairro());
            e.setEstado(r.getEstado());
            e.setCidade(r.getCidade());
            e.setCep(r.getCep() != null ? r.getCep().replaceAll("\\D", "") : null);
            e.setAutoPreenchido(Boolean.TRUE.equals(r.getAutoPreenchido()));
            enderecoRepository.save(e);
        }
        return listarEnderecos(pessoaId);
    }

    @Transactional(readOnly = true)
    public List<PessoaContatoItemResponse> listarContatos(Long pessoaId) {
        garantirPessoaExiste(pessoaId);
        return contatoRepository.findByPessoa_IdOrderByIdAsc(pessoaId).stream()
                .map(this::toContatoResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<PessoaContatoItemResponse> substituirContatos(Long pessoaId, List<PessoaContatoItemRequest> itens) {
        PessoaEntity p = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));
        contatoRepository.deleteByPessoa_Id(pessoaId);
        Instant now = Instant.now();
        for (PessoaContatoItemRequest r : itens) {
            PessoaContatoEntity c = new PessoaContatoEntity();
            c.setPessoa(p);
            c.setTipo(r.getTipo());
            c.setValor(r.getValor());
            c.setDataLancamento(r.getDataLancamento() != null ? r.getDataLancamento() : now);
            c.setDataAlteracao(r.getDataAlteracao() != null ? r.getDataAlteracao() : now);
            c.setUsuarioLancamento(r.getUsuario());
            contatoRepository.save(c);
        }
        return listarContatos(pessoaId);
    }

    private void garantirPessoaExiste(Long id) {
        if (!pessoaRepository.existsById(id)) {
            throw new ResourceNotFoundException("Pessoa não encontrada: " + id);
        }
    }

    private void validarUnicidadeCpf(String cpf, Long idExcluir) {
        if (idExcluir == null) {
            if (pessoaRepository.existsByCpf(cpf)) {
                throw new BusinessRuleException("Já existe cadastro com o CPF informado.");
            }
        } else if (pessoaRepository.existsByCpfAndIdNot(cpf, idExcluir)) {
            throw new BusinessRuleException("Já existe cadastro com o CPF informado.");
        }
    }

    private void validarUnicidadeEmail(String email, Long idExcluir) {
        if (email == null || email.isBlank()) return;
        if (idExcluir == null) {
            if (pessoaRepository.existsByEmail(email)) {
                throw new BusinessRuleException("Já existe cadastro com o e-mail informado.");
            }
        } else if (pessoaRepository.existsByEmailAndIdNot(email, idExcluir)) {
            throw new BusinessRuleException("Já existe cadastro com o e-mail informado.");
        }
    }

    private void validarResponsavel(Long pessoaId, Long responsavelId) {
        if (responsavelId == null) return;
        if (pessoaId != null && responsavelId.equals(pessoaId)) {
            throw new BusinessRuleException("A pessoa não pode ser responsável por si mesma.");
        }
        if (!pessoaRepository.existsById(responsavelId)) {
            throw new BusinessRuleException("Responsável não encontrado: " + responsavelId);
        }
    }

    private static String normalizarCpf(String cpf) {
        return cpf == null ? "" : cpf.replaceAll("\\D", "");
    }

    private void aplicarNucleo(PessoaEntity p, PessoaCadastroRequest req, String cpfDigits) {
        p.setNome(req.getNome().trim());
        p.setCpf(cpfDigits);
        p.setEmail(req.getEmail());
        p.setTelefone(StringUtils.hasText(req.getTelefone()) ? req.getTelefone().trim() : null);
        p.setDataNascimento(req.getDataNascimento());
        p.setAtivo(req.getAtivo() != null ? req.getAtivo() : true);
        p.setMarcadoMonitoramento(Boolean.TRUE.equals(req.getMarcadoMonitoramento()));
        if (req.getResponsavelId() != null) {
            PessoaEntity ref = pessoaRepository.getReferenceById(req.getResponsavelId());
            p.setResponsavel(ref);
        } else {
            p.setResponsavel(null);
        }
    }

    private PessoaCadastroResponse toResponseBasico(PessoaEntity p) {
        PessoaCadastroResponse r = new PessoaCadastroResponse();
        r.setId(p.getId());
        r.setNome(Utf8MojibakeUtil.corrigir(p.getNome()));
        r.setEmail(Utf8MojibakeUtil.corrigir(p.getEmail()));
        r.setCpf(p.getCpf());
        r.setTelefone(Utf8MojibakeUtil.corrigir(p.getTelefone()));
        r.setDataNascimento(p.getDataNascimento());
        r.setAtivo(p.getAtivo());
        r.setMarcadoMonitoramento(p.getMarcadoMonitoramento());
        if (p.getResponsavel() != null) {
            r.setResponsavelId(p.getResponsavel().getId());
        } else {
            r.setResponsavelId(null);
        }
        r.setResponsavel(null);
        return r;
    }

    private PessoaCadastroResponse toResponseCompleto(PessoaEntity p) {
        PessoaCadastroResponse r = toResponseBasico(p);
        if (p.getResponsavel() != null) {
            r.setResponsavel(new PessoaResponsavelResumo(
                    p.getResponsavel().getId(),
                    Utf8MojibakeUtil.corrigir(p.getResponsavel().getNome())));
        }
        return r;
    }

    private PessoaComplementarPayload toComplementarPayload(PessoaComplementarEntity e) {
        PessoaComplementarPayload p = new PessoaComplementarPayload();
        p.setRg(Utf8MojibakeUtil.corrigir(e.getRg()));
        p.setOrgaoExpedidor(Utf8MojibakeUtil.corrigir(e.getOrgaoExpedidor()));
        p.setProfissao(Utf8MojibakeUtil.corrigir(e.getProfissao()));
        p.setNacionalidade(Utf8MojibakeUtil.corrigir(e.getNacionalidade()));
        p.setEstadoCivil(Utf8MojibakeUtil.corrigir(e.getEstadoCivil()));
        p.setGenero(Utf8MojibakeUtil.corrigir(e.getGenero()));
        return p;
    }

    private PessoaEnderecoItemResponse toEnderecoResponse(PessoaEnderecoEntity e) {
        PessoaEnderecoItemResponse r = new PessoaEnderecoItemResponse();
        r.setId(e.getId());
        r.setNumero(e.getNumeroOrdem());
        r.setRua(Utf8MojibakeUtil.corrigir(e.getRua()));
        r.setBairro(Utf8MojibakeUtil.corrigir(e.getBairro()));
        r.setEstado(Utf8MojibakeUtil.corrigir(e.getEstado()));
        r.setCidade(Utf8MojibakeUtil.corrigir(e.getCidade()));
        r.setCep(Utf8MojibakeUtil.corrigir(e.getCep()));
        r.setAutoPreenchido(e.getAutoPreenchido());
        return r;
    }

    private PessoaContatoItemResponse toContatoResponse(PessoaContatoEntity c) {
        PessoaContatoItemResponse r = new PessoaContatoItemResponse();
        r.setId(c.getId());
        r.setTipo(Utf8MojibakeUtil.corrigir(c.getTipo()));
        r.setValor(Utf8MojibakeUtil.corrigir(c.getValor()));
        r.setDataLancamento(c.getDataLancamento());
        r.setDataAlteracao(c.getDataAlteracao());
        r.setUsuario(Utf8MojibakeUtil.corrigir(c.getUsuarioLancamento()));
        return r;
    }

    /** Garante linha em {@code cliente} após criar pessoa (tabela criada em {@code V10__cliente.sql}). */
    private void garantirClienteParaPessoa(PessoaEntity p) {
        if (clienteRepository.existsByPessoa_Id(p.getId())) {
            return;
        }
        long pid = p.getId();
        // CHAR(8): ids > 99_999_999 não cabem em LPAD de 8 dígitos — usa prefixo "9" + 7 dígitos (compatível com codigo_cliente).
        String canonico =
                pid <= 99_999_999L
                        ? String.format("%08d", pid)
                        : "9" + String.format("%07d", pid % 10_000_000L);
        if (!clienteRepository.existsByCodigoCliente(canonico)) {
            ClienteEntity c = new ClienteEntity();
            c.setPessoa(p);
            c.setCodigoCliente(canonico);
            c.setInativo(false);
            clienteRepository.save(c);
            return;
        }
        String fallback = "9" + String.format("%07d", p.getId() % 10_000_000L);
        if (clienteRepository.existsByCodigoCliente(fallback)) {
            throw new BusinessRuleException(
                    "Não foi possível gerar código de cliente único para a pessoa " + p.getId() + ".");
        }
        ClienteEntity c = new ClienteEntity();
        c.setPessoa(p);
        c.setCodigoCliente(fallback);
        c.setInativo(false);
        clienteRepository.save(c);
    }
}
