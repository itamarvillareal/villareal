package br.com.vilareal.processo.application.rag;

/**
 * Metadados de um arquivo recém-enviado ao Drive, para indexação RAG incremental.
 *
 * @param driveFileId ID do arquivo no Google Drive
 * @param nomeDrive nome do arquivo na pasta Movimentações
 * @param tipoPeca tipo da movimentação PROJUDI (ex.: Despacho, Sentença)
 * @param dataMov data da movimentação (ISO yyyy-MM-dd, opcional)
 * @param idMovimentacaoArquivo token PROJUDI da movimentação (auditoria)
 */
public record RagArquivoDriveEnviado(
        String driveFileId,
        String nomeDrive,
        String tipoPeca,
        String dataMov,
        String idMovimentacaoArquivo) {

    /** Chave de idempotência no pgvector ({@code chunks.fonte_id}). */
    public String fonteId() {
        return "drive:" + driveFileId;
    }
}
