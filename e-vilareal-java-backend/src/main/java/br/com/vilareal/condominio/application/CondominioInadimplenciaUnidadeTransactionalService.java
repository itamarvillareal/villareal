package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.CalculoApplicationService;
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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class CondominioInadimplenciaUnidadeTransactionalService {

    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final CalculoApplicationService calculoApplicationService;
    private final ObjectMapper objectMapper;

    public CondominioInadimplenciaUnidadeTransactionalService(
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService,
            CalculoApplicationService calculoApplicationService,
            ObjectMapper objectMapper) {
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
        this.calculoApplicationService = calculoApplicationService;
        this.objectMapper = objectMapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public InadimplenciaImportItemResultadoDto importarUmaUnidade(
            long pessoaId,
            String codigoCliente8,
            InadimplenciaUnidadeDto unidade,
            boolean autorMesmaPessoaCliente,
            String nomeAutorParaCabecalhoCalculo,
            String importacaoId) {
        String codU = unidade.codigoUnidade() == null ? "" : unidade.codigoUnidade().trim().toUpperCase(Locale.ROOT);
        if (codU.isEmpty()) {
            throw new IllegalArgumentException("Código de unidade vazio.");
        }
        List<InadimplenciaCobrancaDto> cobrancas = unidade.cobrancas();
        if (cobrancas == null || cobrancas.isEmpty()) {
            throw new IllegalArgumentException("Sem cobranças para a unidade " + codU);
        }

        ProcessoEntity proc =
                processoRepository.findByPessoa_IdAndUnidade(pessoaId, codU).orElse(null);
        boolean criado = false;
        if (proc == null) {
            int ni = menorNumeroInternoDisponivel(pessoaId);
            ProcessoWriteRequest req = new ProcessoWriteRequest();
            req.setClienteId(pessoaId);
            req.setNumeroInterno(ni);
            req.setUnidade(codU);
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

        ObjectNode payload =
                montarPayloadCalculo(cobrancas, nomeAutorParaCabecalhoCalculo != null ? nomeAutorParaCabecalhoCalculo : "");
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente8);
        calculoApplicationService.salvarRodada(cod8, proc.getNumeroInterno(), 0, payload, importacaoId);

        return new InadimplenciaImportItemResultadoDto(
                codU, proc.getNumeroInterno(), proc.getId(), criado, cobrancas.size());
    }

    private int menorNumeroInternoDisponivel(long pessoaId) {
        List<ProcessoEntity> lista = processoRepository.findByPessoa_IdOrderByNumeroInternoAsc(pessoaId);
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

    private ObjectNode montarPayloadCalculo(List<InadimplenciaCobrancaDto> cobrancas, String textoAutorCabecalho) {
        int n = cobrancas.size();
        String qtd = n <= 99 ? String.format("%02d", n) : String.valueOf(n);

        ArrayNode titulos = objectMapper.createArrayNode();
        ArrayNode parcelas = objectMapper.createArrayNode();
        for (InadimplenciaCobrancaDto c : cobrancas) {
            String brl = formatBrl(c.valorCentavos());
            String desc = c.receita().trim() + " — " + c.periodo().trim();
            ObjectNode t = objectMapper.createObjectNode();
            t.put("dataVencimento", c.vencimento());
            t.put("valorInicial", brl);
            t.put("atualizacaoMonetaria", "");
            t.put("diasAtraso", "");
            t.put("juros", "");
            t.put("multa", "");
            t.put("honorarios", "");
            t.put("total", brl);
            t.put("descricaoValor", desc);
            t.putNull("datasEspeciais");
            titulos.add(t);

            ObjectNode p = objectMapper.createObjectNode();
            p.put("dataVencimento", c.vencimento());
            p.put("valorParcela", brl);
            p.put("honorariosParcela", "");
            p.put("observacao", "");
            p.put("dataPagamento", c.vencimento());
            parcelas.add(p);
        }

        ObjectNode root = objectMapper.createObjectNode();
        root.put("pagina", 1);
        root.put("paginaParcelamento", 1);
        root.put("parcelamentoAceito", false);
        root.put("quantidadeParcelasInformada", qtd);
        root.put("taxaJurosParcelamento", "0,00");
        root.put("limpezaAtiva", false);
        root.putNull("snapshotAntesLimpeza");
        ObjectNode cab = objectMapper.createObjectNode();
        cab.put("autor", textoAutorCabecalho == null ? "" : textoAutorCabecalho);
        cab.put("reu", "");
        root.set("cabecalho", cab);
        root.set("honorariosDataRecebimento", objectMapper.createObjectNode());
        root.set("titulos", titulos);
        root.set("parcelas", parcelas);
        root.putNull("panelConfig");
        return root;
    }

    private static String formatBrl(long centavos) {
        BigDecimal bd = BigDecimal.valueOf(centavos, 2);
        DecimalFormatSymbols sym = new DecimalFormatSymbols(Locale.of("pt", "BR"));
        DecimalFormat df = new DecimalFormat("#,##0.00", sym);
        return "R$ " + df.format(bd);
    }
}
