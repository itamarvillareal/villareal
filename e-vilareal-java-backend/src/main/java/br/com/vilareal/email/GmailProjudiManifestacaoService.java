package br.com.vilareal.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Movimentações do Projudi TJGO ({@code sistema-projudi@tjgo.jus.br}) — delega ao
 * {@link GmailMovimentacaoEmailEngine} com o parser específico do Projudi.
 *
 * <p>A query Gmail é configurável por {@code vilareal.email.projudi.query}. O padrão é por ASSUNTO
 * ({@code "subject:[PROJUDI]"}) e não por remetente, porque os emails chegam REENCAMINHADOS: o
 * índice {@code from:sistema-projudi@tjgo.jus.br} só casa os recebidos diretamente, enquanto o
 * assunto é sempre preservado. Isso também evita puxar os demais emails do domínio {@code tjgo.jus.br}
 * que não são do Projudi (presidência, precatórios, etc.) — o parser os ignoraria, mas seria desperdício.
 */
@Service
public class GmailProjudiManifestacaoService {

    private final GmailMovimentacaoEmailEngine engine;
    private final FonteMovimentacaoEmail fonte;

    public GmailProjudiManifestacaoService(
            GmailMovimentacaoEmailEngine engine,
            @Value("${vilareal.email.projudi.query:subject:[PROJUDI]}") String queryBase) {
        this.engine = engine;
        this.fonte = new FonteMovimentacaoEmail(
                EmailImportacaoSyncTipo.PROJUDI,
                queryBase,
                "Projudi",
                "projudi-gmail-",
                ProjudiManifestacaoTextoImportacaoParser::parseHtmlProjudi);
    }

    public boolean isDisponivel() {
        return engine.isDisponivel();
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarManifestacoes() throws IOException {
        return engine.processarIncremental(fonte);
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarManifestacoesManual(boolean forcarAtualizacaoCompleta)
            throws IOException {
        return buscarEProcessarManifestacoesManual(forcarAtualizacaoCompleta, null);
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarManifestacoesManual(
            boolean forcarAtualizacaoCompleta, java.time.Instant desdeOverride) throws IOException {
        return engine.processarManual(fonte, forcarAtualizacaoCompleta, desdeOverride);
    }
}
