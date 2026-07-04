-- Origem da cobrança automática por cliente (payload_json.entradaCobranca).
-- Default implícito no backend/front: XLS_INADIMPLENCIA.
INSERT INTO calculo_cliente_config (codigo_cliente, payload_json)
VALUES (
    '00000928',
    JSON_OBJECT(
        'honorariosTipo', 'fixos',
        'honorariosValor', '0 %',
        'honorariosVariaveisTexto', '> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%',
        'juros', '1 %',
        'multa', '0 %',
        'indice', 'INPC',
        'periodicidade', 'mensal',
        'modeloListaDebitos', '01',
        'entradaCobranca', 'PDF_CONDO_ID'
    )
)
ON DUPLICATE KEY UPDATE
    payload_json = JSON_SET(payload_json, '$.entradaCobranca', 'PDF_CONDO_ID');
