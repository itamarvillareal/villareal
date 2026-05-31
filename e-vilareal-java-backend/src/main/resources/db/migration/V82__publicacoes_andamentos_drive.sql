-- Feedback visual: andamentos PROJUDI arquivados no Drive (modo somente Drive).
ALTER TABLE publicacoes
    ADD COLUMN andamentos_no_drive TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Andamentos arquivados na pasta Movimentações do Drive'
        AFTER observacao,
    ADD COLUMN drive_folder_url VARCHAR(512) NULL
        COMMENT 'URL da pasta Movimentações no Google Drive'
        AFTER andamentos_no_drive,
    ADD COLUMN andamentos_no_drive_em DATETIME(3) NULL
        COMMENT 'Momento do último arquivamento Drive bem-sucedido'
        AFTER drive_folder_url,
    ADD COLUMN qtd_arquivos_drive INT NULL
        COMMENT 'Arquivos enviados na última execução somente Drive'
        AFTER andamentos_no_drive_em;
