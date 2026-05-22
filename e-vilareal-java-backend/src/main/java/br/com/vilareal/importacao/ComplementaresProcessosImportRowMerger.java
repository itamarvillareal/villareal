package br.com.vilareal.importacao;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;

@Service
public class ComplementaresProcessosImportRowMerger {

    private static final Logger log = LoggerFactory.getLogger(ComplementaresProcessosImportRowMerger.class);

    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteResolverService clienteResolverService;

    public ComplementaresProcessosImportRowMerger(
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ClienteResolverService clienteResolverService) {
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.clienteResolverService = clienteResolverService;
    }

    public record MergeResult(long processoId, boolean criado) {}

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public MergeResult aplicar(String codigoClienteColA, int numeroInterno, int linhaExcel, LinhaParsed linha) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoClienteColA.trim());
        ClienteEntity cliente = clienteResolverService.resolverClientePorCodigo(cod8);
        long titularPessoaId = cliente.getPessoa().getId();

        PessoaEntity titular = pessoaRepository.getReferenceById(titularPessoaId);
        ProcessoEntity p = processoRepository
                .findByCliente_IdAndNumeroInterno(cliente.getId(), numeroInterno)
                .orElse(null);
        boolean criado = p == null;
        if (p == null) {
            p = new ProcessoEntity();
            p.setCliente(cliente);
            p.setPessoa(titular);
            p.setNumeroInterno(numeroInterno);
            p.setAtivo(true);
            p.setConsultaAutomatica(false);
        }

        if (StringUtils.hasText(linha.observacaoProcesso())) {
            String t = Utf8MojibakeUtil.corrigir(linha.observacaoProcesso().trim());
            p.setObservacao(t);
            p.setDescricaoAcao(t);
        }
        if (StringUtils.hasText(linha.cidade())) {
            p.setCidade(Utf8MojibakeUtil.corrigir(linha.cidade().trim()));
        }
        if (StringUtils.hasText(linha.uf())) {
            String u = linha.uf().trim().toUpperCase();
            p.setUf(u.length() > 2 ? u.substring(0, 2) : u);
        }
        if (StringUtils.hasText(linha.competencia())) {
            p.setCompetencia(Utf8MojibakeUtil.corrigir(linha.competencia().trim()));
        }
        if (linha.dataProtocolo() != null) {
            p.setDataProtocolo(linha.dataProtocolo());
        }
        if (StringUtils.hasText(linha.procedimento())) {
            p.setTramitacao(Utf8MojibakeUtil.corrigir(linha.procedimento().trim()));
        }
        if (StringUtils.hasText(linha.responsavel())) {
            p.setConsultor(Utf8MojibakeUtil.corrigir(linha.responsavel().trim()));
        }
        if (linha.valorCausa() != null) {
            p.setValorCausa(linha.valorCausa());
        }
        if (StringUtils.hasText(linha.observacaoFase())) {
            p.setObservacaoFase(Utf8MojibakeUtil.corrigir(linha.observacaoFase().trim()));
        }
        if (linha.prazoFatal() != null) {
            p.setPrazoFatal(linha.prazoFatal());
        }

        p.setCliente(cliente);

        p = processoRepository.save(p);
        log.info(
                "[import-complementares-processos] linha={} clientePk={} proc={} {} id={}",
                linhaExcel,
                cliente.getId(),
                numeroInterno,
                criado ? "criado" : "atualizado",
                p.getId());
        return new MergeResult(p.getId(), criado);
    }

    public record LinhaParsed(
            String observacaoProcesso,
            String cidade,
            String uf,
            String competencia,
            LocalDate dataProtocolo,
            String procedimento,
            String responsavel,
            BigDecimal valorCausa,
            String observacaoFase,
            LocalDate prazoFatal) {}
}
