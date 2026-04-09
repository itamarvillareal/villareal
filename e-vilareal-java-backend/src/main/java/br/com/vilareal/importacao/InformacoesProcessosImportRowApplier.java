package br.com.vilareal.importacao;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaComplementarEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaComplementarRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * Uma transação por linha da planilha (commit isolado).
 */
@Service
public class InformacoesProcessosImportRowApplier {

    private static final Logger log = LoggerFactory.getLogger(InformacoesProcessosImportRowApplier.class);

    public static final String POLO_AUTOR = "AUTOR";
    public static final String POLO_REU = "REU";

    private final PessoaRepository pessoaRepository;
    private final PessoaComplementarRepository complementarRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository parteRepository;

    public InformacoesProcessosImportRowApplier(
            PessoaRepository pessoaRepository,
            PessoaComplementarRepository complementarRepository,
            ProcessoRepository processoRepository,
            ProcessoParteRepository parteRepository) {
        this.pessoaRepository = pessoaRepository;
        this.complementarRepository = complementarRepository;
        this.processoRepository = processoRepository;
        this.parteRepository = parteRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public ResultadoAplicacao aplicar(DadosImportacaoLinha dados) {
        PessoaEntity cliente = pessoaRepository.getReferenceById(dados.clientePessoaId());

        ProcessoEntity processo = processoRepository
                .findByPessoa_IdAndNumeroInterno(dados.clientePessoaId(), dados.numeroInterno())
                .orElseGet(ProcessoEntity::new);

        boolean criado = processo.getId() == null;
        processo.setPessoa(cliente);
        processo.setNumeroInterno(dados.numeroInterno());
        if (dados.faseOpcional().isPresent()) {
            processo.setFase(dados.faseOpcional().get());
        } else if (dados.usarFaseEmAndamentoQuandoFaseVazia()) {
            processo.setFase("Em Andamento");
        } else {
            processo.setFase(null);
        }
        processo.setNumeroCnj(emptyToNull(dados.numeroCnjOuNull()));
        String descricaoAcaoCorrigida = Utf8MojibakeUtil.corrigir(dados.descricaoAcaoOuNull());
        processo.setDescricaoAcao(emptyToNull(descricaoAcaoCorrigida));
        if (dados.controleAtivoOpcional().isPresent()) {
            processo.setAtivo(dados.controleAtivoOpcional().get());
        } else if (criado) {
            processo.setAtivo(true);
        }
        if (criado) {
            processo.setConsultaAutomatica(false);
        }
        processo = processoRepository.save(processo);
        log.info(
                "[import-informacoes-processos] linha={} cliente={} proc={} processo {} id={}",
                dados.linhaExcel(),
                dados.clientePessoaId(),
                dados.numeroInterno(),
                criado ? "criado" : "atualizado",
                processo.getId());

        if (dados.atualizarComplementarDescricaoAcao()) {
            atualizarDescricaoAcaoComplementar(dados.clientePessoaId(), descricaoAcaoCorrigida);
        }

        parteRepository.deleteByProcesso_IdAndPolo(processo.getId(), POLO_AUTOR);
        parteRepository.deleteByProcesso_IdAndPolo(processo.getId(), POLO_REU);

        List<DadosImportacaoLinha.ParteSlot> partes =
                DadosImportacaoLinha.deduplicarPorPoloEPessoa(dados.partes());
        partes.sort(Comparator.comparing(DadosImportacaoLinha.ParteSlot::polo).thenComparingInt(DadosImportacaoLinha.ParteSlot::ordem));

        int autores = 0;
        int reus = 0;
        for (DadosImportacaoLinha.ParteSlot slot : partes) {
            PessoaEntity pessoa = pessoaRepository.getReferenceById(slot.pessoaId());
            ProcessoParteEntity parte = new ProcessoParteEntity();
            parte.setProcesso(processo);
            parte.setPessoa(pessoa);
            parte.setPolo(slot.polo());
            parte.setOrdem(slot.ordem());
            parte.setNomeLivre(null);
            parte.setQualificacao(null);
            parteRepository.save(parte);
            if (POLO_AUTOR.equals(slot.polo())) {
                autores++;
            } else if (POLO_REU.equals(slot.polo())) {
                reus++;
            }
        }
        log.info(
                "[import-informacoes-processos] linha={} partes autores={} reus={}",
                dados.linhaExcel(),
                autores,
                reus);

        return new ResultadoAplicacao(processo.getId(), criado, autores, reus);
    }

    private void atualizarDescricaoAcaoComplementar(long pessoaId, String descricaoBruta) {
        PessoaEntity p = pessoaRepository.findById(pessoaId).orElseThrow();
        PessoaComplementarEntity e = complementarRepository.findById(pessoaId).orElseGet(() -> {
            PessoaComplementarEntity x = new PessoaComplementarEntity();
            x.setPessoa(p);
            return x;
        });
        e.setDescricaoAcao(emptyToNull(descricaoBruta));
        complementarRepository.save(e);
    }

    private static String emptyToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }

    public record ResultadoAplicacao(Long processoId, boolean processoCriado, int autoresVinculados, int reusVinculados) {}
}
