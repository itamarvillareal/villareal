-- Simplifica tipos de pessoa_documento_drive para DOCUMENTOS e ASSINADOS.

UPDATE pessoa_documento_drive
SET tipo = 'DOCUMENTOS'
WHERE tipo IN ('PROCURACOES', 'CONTRATOS', 'DECLARACOES');

ALTER TABLE pessoa_documento_drive
    DROP CHECK chk_pessoa_documento_drive_tipo;

ALTER TABLE pessoa_documento_drive
    ADD CONSTRAINT chk_pessoa_documento_drive_tipo CHECK (
        tipo IN ('DOCUMENTOS', 'ASSINADOS')
    );
