package br.com.vilareal.importacao;

import br.com.vilareal.importacao.dto.Pasta1ClientePessoaItemResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaListaResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaPersistLinhaDetalhe;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaPersistResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaPersistStatus;
import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.file.Path;

@Service
public class Pasta1ClientePessoaImportService {

    private static final int CHAVE_MAX = 128;

    private final Pasta1ClientePessoaReader reader;
    private final PlanilhaPasta1ClienteRepository mapeamentoRepository;
    private final PessoaRepository pessoaRepository;
    private final ClienteRepository clienteRepository;

    public Pasta1ClientePessoaImportService(
            Pasta1ClientePessoaReader reader,
            PlanilhaPasta1ClienteRepository mapeamentoRepository,
            PessoaRepository pessoaRepository,
            ClienteRepository clienteRepository) {
        this.reader = reader;
        this.mapeamentoRepository = mapeamentoRepository;
        this.pessoaRepository = pessoaRepository;
        this.clienteRepository = clienteRepository;
    }

    @Transactional
    public Pasta1ClientePessoaPersistResponse aplicarArquivo(Path path) {
        Pasta1ClientePessoaListaResponse lido = reader.lerArquivo(path);
        return aplicarLista(lido);
    }

    @Transactional
    public Pasta1ClientePessoaPersistResponse aplicarLista(Pasta1ClientePessoaListaResponse lido) {
        Pasta1ClientePessoaPersistResponse out = new Pasta1ClientePessoaPersistResponse();
        out.setArquivo(lido.getArquivo());
        out.setTotalLinhasLidas(lido.getTotalLinhasLidas());
        int ins = 0;
        int upd = 0;
        int ign = 0;
        for (Pasta1ClientePessoaItemResponse item : lido.getItens()) {
            Pasta1ClientePessoaPersistLinhaDetalhe d = new Pasta1ClientePessoaPersistLinhaDetalhe();
            d.setLinhaExcel(item.getLinhaExcel());
            String chave = item.getClienteColunaA();
            d.setChaveCliente(chave);
            Long pid = item.getPessoaId();
            d.setPessoaId(pid);

            if (!StringUtils.hasText(chave)) {
                d.setStatus(Pasta1ClientePessoaPersistStatus.IGNORADO);
                d.setMensagem("Chave cliente vazia.");
                ign++;
                out.getDetalhes().add(d);
                continue;
            }
            if (chave.length() > CHAVE_MAX) {
                d.setStatus(Pasta1ClientePessoaPersistStatus.IGNORADO);
                d.setMensagem("Chave excede " + CHAVE_MAX + " caracteres.");
                ign++;
                out.getDetalhes().add(d);
                continue;
            }
            if (pid == null) {
                d.setStatus(Pasta1ClientePessoaPersistStatus.IGNORADO);
                d.setMensagem(StringUtils.hasText(item.getAviso()) ? item.getAviso() : "Id de pessoa inválido.");
                ign++;
                out.getDetalhes().add(d);
                continue;
            }
            if (!pessoaRepository.existsById(pid)) {
                d.setStatus(Pasta1ClientePessoaPersistStatus.IGNORADO);
                d.setMensagem("Pessoa não existe: id=" + pid);
                ign++;
                out.getDetalhes().add(d);
                continue;
            }

            var existente = mapeamentoRepository.findById(chave);
            if (existente.isEmpty()) {
                PlanilhaPasta1ClienteEntity e = new PlanilhaPasta1ClienteEntity();
                e.setChaveCliente(chave);
                e.setPessoaId(pid);
                mapeamentoRepository.save(e);
                sincronizarClienteDaChave(chave, pid);
                d.setStatus(Pasta1ClientePessoaPersistStatus.INSERIDO);
                d.setMensagem(null);
                ins++;
            } else {
                PlanilhaPasta1ClienteEntity e = existente.get();
                Long pessoaAnterior = e.getPessoaId();
                if (pessoaAnterior.equals(pid)) {
                    d.setStatus(Pasta1ClientePessoaPersistStatus.IGNORADO);
                    d.setMensagem("Sem alteração (já associado a esta pessoa).");
                    ign++;
                } else {
                    e.setPessoaId(pid);
                    mapeamentoRepository.save(e);
                    sincronizarClienteDaChave(chave, pid);
                    d.setStatus(Pasta1ClientePessoaPersistStatus.ATUALIZADO);
                    d.setMensagem("Pessoa anterior: " + pessoaAnterior);
                    upd++;
                }
            }
            out.getDetalhes().add(d);
        }
        out.setLinhasInseridas(ins);
        out.setLinhasAtualizadas(upd);
        out.setLinhasIgnoradas(ign);
        return out;
    }

    private void sincronizarClienteDaChave(String chave, long pessoaId) {
        String cod8 = PlanilhaPasta1MapeamentoUtil.codigoClienteExibicaoParaChavePlanilha(chave);
        if (cod8 == null) {
            return;
        }
        PessoaEntity pessoa = pessoaRepository.getReferenceById(pessoaId);
        clienteRepository
                .findByCodigoCliente(cod8)
                .ifPresentOrElse(
                        c -> {
                            c.setPessoa(pessoa);
                            clienteRepository.save(c);
                        },
                        () -> {
                            ClienteEntity c = new ClienteEntity();
                            c.setCodigoCliente(cod8);
                            c.setPessoa(pessoa);
                            c.setInativo(false);
                            clienteRepository.save(c);
                        });
    }
}
