-- Guarda o .p7s assinado também no Google Drive (fonte durável). Se o arquivo local sumir
-- (ex.: recreate de container), o protocolo baixa o .p7s do Drive por este id.

ALTER TABLE projudi_peticao_arquivo
    ADD COLUMN p7s_drive_file_id VARCHAR(120) NULL AFTER drive_file_id;
