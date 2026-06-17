package br.com.vilareal.documento;

import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PeticaoAiService {

    private final ClaudeApiService claudeApi;
    private final ObjectMapper objectMapper;

    public PeticaoAiService(ClaudeApiService claudeApi, ObjectMapper objectMapper) {
        this.claudeApi = claudeApi;
        this.objectMapper = objectMapper;
    }

    public DocumentoGerarRequest gerarConteudoPeticao(PeticaoAiRequest request) {
        validarRequest(request);

        String systemPrompt = montarSystemPrompt(request.tipoPeca());
        String userMessage = montarUserMessage(request);
        String respostaIA = claudeApi.enviarMensagem(systemPrompt, userMessage);

        return parsearRespostaParaDocumento(respostaIA, request);
    }

    private void validarRequest(PeticaoAiRequest request) {
        if (request.enderecamento() == null || request.enderecamento().isBlank()) {
            throw new BusinessRuleException("Endereçamento é obrigatório.");
        }
        if (request.tipoPeca() == null || request.tipoPeca().isBlank()) {
            throw new BusinessRuleException("Tipo de peça é obrigatório.");
        }
        if (tipoPecaUsaTemplateFixo(request.tipoPeca())) {
            throw new BusinessRuleException(
                    "Procuração e documentos com modelo fixo não usam IA. Use POST /api/documentos/procuracao.");
        }
        if (request.fatos() == null || request.fatos().isBlank()) {
            throw new BusinessRuleException("Fatos do caso são obrigatórios.");
        }
    }

    private static boolean tipoPecaUsaTemplateFixo(String tipoPeca) {
        String t = tipoPeca.trim().toLowerCase();
        return t.contains("procura") || t.contains("mandato") || t.contains("substabelecimento");
    }

    static boolean isPeticaoInterlocutoria(String tipoPeca) {
        if (tipoPeca == null) {
            return false;
        }
        return tipoPeca.trim().toLowerCase().contains("interlocut");
    }

    private String montarSystemPrompt(String tipoPeca) {
        String base = """
                Você é um advogado brasileiro experiente, especializado em Direito do Consumidor,
                Direito Civil e Direito Processual Civil. Você trabalha no escritório Villa Real
                e Advogados Associados, em Anápolis-GO.

                Sua tarefa é redigir o conteúdo de uma %s.

                REGRAS DE FORMATAÇÃO:
                1. Responda EXCLUSIVAMENTE em formato JSON válido, sem markdown, sem backticks.
                2. O JSON deve ter esta estrutura exata:
                {
                    "preambulo": "texto HTML da qualificação das partes...",
                    "secoes": [
                        {
                            "titulo": "DOS FATOS",
                            "conteudo": "<p>Parágrafo 1...</p><p>Parágrafo 2...</p>"
                        },
                        {
                            "titulo": "DO DIREITO",
                            "conteudo": "<p>Fundamentação jurídica...</p>"
                        }
                    ],
                    "pedidos": [
                        "Primeiro pedido...",
                        "Segundo pedido...",
                        "Terceiro pedido..."
                    ]
                }
                3. Cada parágrafo do conteúdo deve ser envolvido em tags <p></p>.
                4. Nomes de partes em negrito: <strong>NOME DA PARTE</strong>.
                5. Citações de jurisprudência devem ficar em <div class="citacao"><p>texto</p></div>.
                6. Citações de legislação em itálico: <em>texto do artigo</em>.
                7. Use linguagem jurídica formal, com referências a artigos de lei, doutrina e
                   jurisprudência quando aplicável.
                8. Os pedidos devem ser específicos, mensuráveis e juridicamente fundamentados.
                9. NÃO inclua o endereçamento (juízo), número do processo, fecho (nestes termos),
                   data nem assinatura — esses são gerados automaticamente pelo sistema.
                10. Os títulos das seções devem conter APENAS o nome (ex: "DOS FATOS", "DO DIREITO"),
                    SEM numeração própria (não use "I –", "II –", "1.", etc.) — a numeração é adicionada
                    automaticamente pelo sistema.
                11. Os pedidos devem ser texto PURO, sem tags HTML (<strong>, <em>, etc.).
                """.formatted(tipoPeca);

        if (isPeticaoInterlocutoria(tipoPeca)) {
            base += """

                    QUALIFICAÇÃO REDUZIDA (peça interlocutória):
                    12. Esta é uma petição interlocutória, apresentada em processo já em curso. NÃO faça a
                        qualificação completa das partes (não inclua nacionalidade, estado civil, profissão,
                        CPF/CNPJ, endereço, etc.).
                    13. No preâmbulo, cite cada parte apenas pelo nome completo em negrito
                        (<strong>NOME DA PARTE</strong>), seguido de:
                        - "já devidamente qualificada nos autos" quando a parte for do gênero feminino;
                        - "já devidamente qualificado nos autos" quando a parte for do gênero masculino.
                    14. Determine o gênero de cada parte a partir do nome. Para pessoa jurídica
                        (empresa, instituição, etc.), use "já devidamente qualificada nos autos".
                    """;
        }

        return base;
    }

    private String montarUserMessage(PeticaoAiRequest request) {
        StringBuilder sb = new StringBuilder();
        boolean interlocutoria = isPeticaoInterlocutoria(request.tipoPeca());

        sb.append("TIPO DE PEÇA: ").append(request.tipoPeca()).append("\n\n");

        if (request.nomeAutor() != null) {
            sb.append("AUTOR/REQUERENTE: ").append(request.nomeAutor()).append("\n");
            if (!interlocutoria && request.qualificacaoAutor() != null) {
                sb.append("QUALIFICAÇÃO DO AUTOR: ").append(request.qualificacaoAutor()).append("\n");
            }
        }

        if (request.nomeReu() != null) {
            sb.append("RÉU/REQUERIDO: ").append(request.nomeReu()).append("\n");
            if (!interlocutoria && request.qualificacaoReu() != null) {
                sb.append("QUALIFICAÇÃO DO RÉU: ").append(request.qualificacaoReu()).append("\n");
            }
        }

        sb.append("\nFATOS DO CASO:\n").append(request.fatos()).append("\n");

        if (request.fundamentacaoAdicional() != null && !request.fundamentacaoAdicional().isBlank()) {
            sb.append("\nFUNDAMENTAÇÃO ADICIONAL:\n").append(request.fundamentacaoAdicional()).append("\n");
        }

        if (request.valorCausa() != null && !request.valorCausa().isBlank()) {
            sb.append("\nVALOR DA CAUSA: R$ ").append(request.valorCausa()).append("\n");
        }

        if (request.pedidosEspecificos() != null && !request.pedidosEspecificos().isEmpty()) {
            sb.append("\nPEDIDOS ESPECÍFICOS QUE DEVEM CONSTAR:\n");
            request.pedidosEspecificos().forEach(p -> sb.append("- ").append(p).append("\n"));
        }

        if (request.modeloBase() != null && !request.modeloBase().isBlank()) {
            sb.append("\nMODELO BASE (use como referência de estrutura e estilo):\n");
            sb.append(request.modeloBase()).append("\n");
        }

        if (request.instrucoesAdicionais() != null && !request.instrucoesAdicionais().isBlank()) {
            sb.append("\nINSTRUÇÕES ADICIONAIS:\n").append(request.instrucoesAdicionais()).append("\n");
        }

        return sb.toString();
    }

    private DocumentoGerarRequest parsearRespostaParaDocumento(String respostaIA, PeticaoAiRequest request) {
        String jsonLimpo = limparJsonMarkdown(respostaIA);
        PeticaoAiConteudoJson conteudo;
        try {
            conteudo = objectMapper.readValue(jsonLimpo, PeticaoAiConteudoJson.class);
        } catch (Exception e) {
            throw new BusinessRuleException("Resposta da IA não é um JSON válido: " + e.getMessage());
        }

        validarConteudo(conteudo);

        List<DocumentoGerarRequest.SecaoPeticao> secoes = conteudo.secoes().stream()
                .map(s -> new DocumentoGerarRequest.SecaoPeticao(s.titulo().trim(), s.conteudo().trim()))
                .collect(Collectors.toList());

        String cidadeEstado = request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                ? request.cidadeEstado()
                : "Anápolis, estado de Goiás";
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();

        return new DocumentoGerarRequest(
                request.enderecamento(),
                request.numeroProcesso(),
                conteudo.preambulo().trim(),
                secoes,
                conteudo.pedidos().stream()
                        .map(p -> removerTagsHtml(p.trim()))
                        .collect(Collectors.toList()),
                cidadeEstado,
                data,
                request.processoId());
    }

    private void validarConteudo(PeticaoAiConteudoJson conteudo) {
        if (conteudo.preambulo() == null || conteudo.preambulo().isBlank()) {
            throw new BusinessRuleException("Resposta da IA sem preâmbulo.");
        }
        if (conteudo.secoes() == null || conteudo.secoes().isEmpty()) {
            throw new BusinessRuleException("Resposta da IA sem seções.");
        }
        for (PeticaoAiConteudoJson.SecaoJson secao : conteudo.secoes()) {
            if (secao.titulo() == null || secao.titulo().isBlank()) {
                throw new BusinessRuleException("Resposta da IA com seção sem título.");
            }
            if (secao.conteudo() == null || secao.conteudo().isBlank()) {
                throw new BusinessRuleException("Resposta da IA com seção sem conteúdo: " + secao.titulo());
            }
        }
        if (conteudo.pedidos() == null || conteudo.pedidos().isEmpty()) {
            throw new BusinessRuleException("Resposta da IA sem pedidos.");
        }
        for (String pedido : conteudo.pedidos()) {
            if (pedido == null || pedido.isBlank()) {
                throw new BusinessRuleException("Resposta da IA com pedido vazio.");
            }
        }
    }

    static String removerTagsHtml(String texto) {
        if (texto == null || texto.isBlank()) {
            return texto;
        }
        return texto.replaceAll("<[^>]+>", "").trim();
    }

    static String limparJsonMarkdown(String texto) {
        String t = texto.trim();
        if (t.startsWith("```")) {
            int primeiraLinha = t.indexOf('\n');
            if (primeiraLinha > 0) {
                t = t.substring(primeiraLinha + 1);
            } else {
                t = t.replaceFirst("^```(?:json)?\\s*", "");
            }
            int fim = t.lastIndexOf("```");
            if (fim >= 0) {
                t = t.substring(0, fim);
            }
        }
        return t.trim();
    }
}
