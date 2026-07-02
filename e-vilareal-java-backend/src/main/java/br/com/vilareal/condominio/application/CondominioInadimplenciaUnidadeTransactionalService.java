package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.CalculoCobrancaMergeService;
import br.com.vilareal.calculo.application.DebitoNovo;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportItemResultadoDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaUnidadeDto;
import br.com.vilareal.processo.api.dto.ProcessoParteWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoWriteRequest;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Importação unitária de inadimplência (Atividades em Lote) — alinhada a {@link CobrancaImportRegras}:
 * busca por {@code cliente_id + unidade} normalizada e merge via {@link CalculoCobrancaMergeService}.
 */
@Service
public class CondominioInadimplenciaUnidadeTransactionalService {

    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final ProcessoUnidadeClienteLookupService processoUnidadeLookup;
    private final CalculoCobrancaMergeService mergeService;

    public CondominioInadimplenciaUnidadeTransactionalService(
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService,
            ProcessoUnidadeClienteLookupService processoUnidadeLookup,
            CalculoCobrancaMergeService mergeService) {
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
        this.processoUnidadeLookup = processoUnidadeLookup;
        this.mergeService = mergeService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public InadimplenciaImportItemResultadoDto importarUmaUnidade(
            long clienteId,
            long pessoaId,
            String codigoCliente8,
            InadimplenciaUnidadeDto unidade,
            boolean autorMesmaPessoaCliente,
            String nomeAutorParaCabecalhoCalculo,
            String importacaoId) {
        String codU = CobrancaUnidadeFormatUtil.normalizarCodigoUnidade(unidade.codigoUnidade());
        if (codU.isEmpty()) {
            throw new IllegalArgumentException("Código de unidade vazio.");
        }
        List<InadimplenciaCobrancaDto> cobrancas = unidade.cobrancas();
        if (cobrancas == null || cobrancas.isEmpty()) {
            throw new IllegalArgumentException("Sem cobranças para a unidade " + codU);
        }

        String unidadeProcesso = CobrancaUnidadeFormatUtil.codigoParaUnidadeProcesso(codU);
        ProcessoEntity proc = processoUnidadeLookup.buscarPorCodigoUnidade(clienteId, codU).orElse(null);
        boolean criado = false;
        if (proc == null) {
            int ni = menorNumeroInternoDisponivel(clienteId);
            ProcessoWriteRequest req = new ProcessoWriteRequest();
            req.setClienteId(clienteId);
            req.setPessoaTitularId(pessoaId);
            req.setNumeroInterno(ni);
            req.setUnidade(unidadeProcesso);
            if (importacaoId != null && !importacaoId.isBlank()) {
                req.setImportacaoId(importacaoId);
            }
            processoApplicationService.criar(req);
            proc = processoRepository
                    .findByPessoa_IdAndNumeroInterno(pessoaId, ni)
                    .orElseThrow(() -> new ResourceNotFoundException("Processo recém-criado não encontrado."));
            criado = true;
            if (autorMesmaPessoaCliente) {
                ProcessoParteWriteRequest parteAutor = new ProcessoParteWriteRequest();
                parteAutor.setPessoaId(pessoaId);
                parteAutor.setPolo("AUTOR");
                parteAutor.setOrdem(1);
                if (importacaoId != null && !importacaoId.isBlank()) {
                    parteAutor.setImportacaoId(importacaoId);
                }
                processoApplicationService.criarParte(proc.getId(), parteAutor);
            }
        }

        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente8);
        List<DebitoNovo> debitos = toDebitosNovos(cobrancas);
        mergeService.mesclarDebitos(cod8, proc.getNumeroInterno(), debitos, importacaoId);

        return new InadimplenciaImportItemResultadoDto(
                codU, proc.getNumeroInterno(), proc.getId(), criado, cobrancas.size());
    }

    private static List<DebitoNovo> toDebitosNovos(List<InadimplenciaCobrancaDto> cobrancas) {
        List<DebitoNovo> out = new ArrayList<>();
        for (InadimplenciaCobrancaDto c : cobrancas) {
            if (c == null) {
                continue;
            }
            String venc = c.vencimento() != null ? c.vencimento().trim() : "";
            String desc = c.receita() != null ? c.receita().trim() : "";
            if (!StringUtils.hasText(venc)) {
                continue;
            }
            out.add(new DebitoNovo(venc, c.valorCentavos(), desc));
        }
        return out;
    }

    private int menorNumeroInternoDisponivel(long clienteId) {
        List<ProcessoEntity> lista = processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(clienteId);
        Set<Integer> usados = new HashSet<>();
        for (ProcessoEntity p : lista) {
            usados.add(p.getNumeroInterno());
        }
        int n = 1;
        while (usados.contains(n)) {
            n++;
        }
        return n;
    }
}
