ALTER TABLE contrato_honorarios_importacao
    MODIFY hash_pdf VARCHAR(64) NOT NULL,
    MODIFY hash_pdf_ativo VARCHAR(64) NULL;
