package br.com.vilareal.condominio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.condominio.api.dto.InadimplenciaExtracaoResponse;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportErroDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportItemResultadoDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportRequest;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportResponse;
import br.com.vilareal.condominio.api.dto.InadimplenciaUnidadeDto;
import br.com.vilareal.condominio.pdf.InadimplenciaPdfParser;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class CondominioInadimplenciaApplicationService {

    private final ClienteRepository clienteRepository;
    private final CondominioInadimplenciaUnidadeTransactionalService unidadeTransactionalService;

    public CondominioInadimplenciaApplicationService(
            ClienteRepository clienteRepository,
            CondominioInadimplenciaUnidadeTransactionalService unidadeTransactionalService) {
        this.clienteRepository = clienteRepository;
        this.unidadeTransactionalService = unidadeTransactionalService;
    }

    public InadimplenciaExtracaoResponse extrair(String clienteCodigoRaw, MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new BusinessRuleException("Arquivo PDF é obrigatório.");
        }
        String ct = arquivo.getContentType();
        String nomeArquivo = arquivo.getOriginalFilename() != null ? arquivo.getOriginalFilename() : "";
        if (ct != null && !ct.contains("pdf") && !nomeArquivo.toLowerCase().endsWith(".pdf")) {
            throw new BusinessRuleException("Envie um arquivo PDF.");
        }
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clienteCodigoRaw);
        ClienteEntity cliente =
                clienteRepository.findByCodigoClienteFetchPessoa(cod8).orElseThrow(() -> new BusinessRuleException(
                        "Cliente não encontrado para o código: " + cod8));
        String nome = Utf8MojibakeUtil.corrigir(cliente.getPessoa().getNome());

        byte[] bytes;
        try {
            bytes = arquivo.getBytes();
        } catch (IOException e) {
            throw new BusinessRuleException("Não foi possível ler o arquivo enviado: " + e.getMessage());
        }
        InadimplenciaPdfParser.InadimplenciaPdfParseResult parsed;
        try {
            parsed = InadimplenciaPdfParser.parse(bytes);
        } catch (IOException e) {
            throw new BusinessRuleException(
                    "Não foi possível ler o PDF. Confirme que o arquivo é um PDF válido: " + e.getMessage());
        }

        return new InadimplenciaExtracaoResponse(
                cod8,
                nome,
                parsed.condominioNome(),
                parsed.dataReferenciaPdf(),
                parsed.unidades(),
                parsed.resumo());
    }

    public InadimplenciaImportResponse importar(InadimplenciaImportRequest request) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(request.clienteCodigo());
        ClienteEntity cliente =
                clienteRepository.findByCodigoClienteFetchPessoa(cod8).orElseThrow(() -> new BusinessRuleException(
                        "Cliente não encontrado para o código: " + cod8));
        long pessoaId = cliente.getPessoa().getId();
        boolean autorMesmaPessoaCliente =
                request.autorMesmaPessoaCliente() == null || Boolean.TRUE.equals(request.autorMesmaPessoaCliente());
        String nomeAutorParaCalculo =
                autorMesmaPessoaCliente ? Utf8MojibakeUtil.corrigir(cliente.getPessoa().getNome()) : "";

        List<InadimplenciaImportItemResultadoDto> itens = new ArrayList<>();
        List<InadimplenciaImportErroDto> erros = new ArrayList<>();
        int criados = 0;
        int cobTotal = 0;
        String importacaoId = UUID.randomUUID().toString();

        for (InadimplenciaUnidadeDto u : request.unidades()) {
            try {
                InadimplenciaImportItemResultadoDto r = unidadeTransactionalService.importarUmaUnidade(
                        pessoaId, cod8, u, autorMesmaPessoaCliente, nomeAutorParaCalculo, importacaoId);
                itens.add(r);
                if (r.processoCriado()) {
                    criados++;
                }
                cobTotal += r.cobrancasLancadas();
            } catch (Exception e) {
                String cod = u.codigoUnidade() != null ? u.codigoUnidade() : "?";
                erros.add(new InadimplenciaImportErroDto(cod, e.getMessage() != null ? e.getMessage() : e.toString()));
            }
        }
        return new InadimplenciaImportResponse(importacaoId, criados, cobTotal, itens, erros);
    }
}
