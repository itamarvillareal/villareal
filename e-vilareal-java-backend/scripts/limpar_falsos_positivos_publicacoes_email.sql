-- Remove publicações principais indevidas (CNJs citados apenas no teor)
-- do e-mail Jusbrasil «20 novas publicações…» (messageId 19e5fc3992bae731).
-- Execute após backup: mysql -u root -p vilareal < scripts/limpar_falsos_positivos_publicacoes_email.sql

DELETE FROM publicacoes
WHERE origem_importacao = 'MONITORAMENTO'
  AND arquivo_origem_nome LIKE '%[19e5fc3992bae731]%'
  AND UPPER(numero_processo_encontrado) IN (
    '6047814-82.2025.8.09.0007',
    '6048257-33.2025.8.09.0007',
    '5080120-90.2026.8.09.0006',
    '5827899-34.2025.8.09.0006',
    '5704688-58.2025.8.09.0006',
    '5527532-83.2025.8.09.0006',
    '5139965-53.2026.8.09.0006',
    '5535451-45.2023.8.09.0087'
  );

SELECT ROW_COUNT() AS removidos;
