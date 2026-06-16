-- Etapa atual do protocolo em andamento (login, busca, upload de arquivo, concluir...),
-- exibida ao vivo na fila "2. Protocolar" enquanto a petição está em PROTOCOLANDO.

ALTER TABLE projudi_peticao
    ADD COLUMN protocolo_etapa VARCHAR(160) NULL AFTER protocolo_mensagem;
