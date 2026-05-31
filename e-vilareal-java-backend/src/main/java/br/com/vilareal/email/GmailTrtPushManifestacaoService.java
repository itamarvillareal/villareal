package br.com.vilareal.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Movimentações PUSH dos TRTs (PJe), ex.: {@code nao-responda@trt18.jus.br}.
 * Delega ao {@link GmailMovimentacaoEmailEngine} com o parser específico do TRT.
 *
 * <p>A query Gmail é configurável por {@code vilareal.email.trt.query}. O padrão combina o domínio
 * com o marcador do assunto ({@code "from:trt18.jus.br OR subject:[TRT18]"}) porque os PUSH chegam
 * REENCAMINHADOS: o índice {@code from:endereço-exato} do Gmail aponta para a conta que reencaminhou,
 * então só o domínio + assunto capturam todos. Para monitorar várias regiões, acrescente OR, ex.:
 * {@code "from:trt18.jus.br OR from:trt10.jus.br OR subject:[PUSH]"}.
 */
@Service
public class GmailTrtPushManifestacaoService {

    private final GmailMovimentacaoEmailEngine engine;
    private final FonteMovimentacaoEmail fonte;

    public GmailTrtPushManifestacaoService(
            GmailMovimentacaoEmailEngine engine,
            @Value("${vilareal.email.trt.query:from:trt18.jus.br OR subject:[TRT18]}") String queryBase) {
        this.engine = engine;
        this.fonte = new FonteMovimentacaoEmail(
                EmailImportacaoSyncTipo.TRT,
                queryBase,
                "TRT",
                "trt-push-gmail-",
                TrtPushManifestacaoTextoImportacaoParser::parse);
    }

    public boolean isDisponivel() {
        return engine.isDisponivel();
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarManifestacoes() throws IOException {
        return engine.processarIncremental(fonte);
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarManifestacoesManual(boolean forcarAtualizacaoCompleta)
            throws IOException {
        return engine.processarManual(fonte, forcarAtualizacaoCompleta);
    }
}
