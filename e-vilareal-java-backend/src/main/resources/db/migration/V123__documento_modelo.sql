-- Modelos de petição por responsável (timbrado: cabeçalho, rodapé, nome/OAB).
-- Um modelo ativo por usuário responsável.

CREATE TABLE documento_modelo (
    id BIGINT NOT NULL AUTO_INCREMENT,
    label VARCHAR(120) NOT NULL,
    usuario_responsavel_id BIGINT NOT NULL,
    advogado_nome VARCHAR(255) NOT NULL,
    advogado_oab VARCHAR(80) NOT NULL,
    rodape_texto TEXT NOT NULL,
    cabecalho_imagem LONGBLOB NULL,
    cabecalho_content_type VARCHAR(100) NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_documento_modelo_usuario
        FOREIGN KEY (usuario_responsavel_id) REFERENCES usuarios (id),
    CONSTRAINT uq_documento_modelo_usuario UNIQUE (usuario_responsavel_id)
);

CREATE INDEX idx_documento_modelo_ativo ON documento_modelo (ativo);

-- Modelo padrão Itamar (login itamar) — espelha TemaDocumento.padrao() atual.
INSERT INTO documento_modelo (
    label,
    usuario_responsavel_id,
    advogado_nome,
    advogado_oab,
    rodape_texto,
    cabecalho_imagem,
    cabecalho_content_type,
    ativo
)
SELECT
    'Padrão Villa Real (Itamar)',
    u.id,
    'Dr. Itamar Alexandre Felix Villa Real Junior',
    'OAB/GO 33.329',
    CONCAT(
        'Av. Pinheiro Chagas, nº 232, Bairro Jundiaí, Anápolis-GO, CEP n 75.110-580.',
        CHAR(10),
        'Telefones: 62-3321-2374 (fixo), 62-98129-6212 (tim)',
        CHAR(10),
        'E-mail: villareal@villarealadvocacia.adv.br',
        CHAR(10),
        'www.villarealadvocacia.adv.br'
    ),
    NULL,
    NULL,
    1
FROM usuarios u
WHERE u.login = 'itamar'
  AND NOT EXISTS (
      SELECT 1 FROM documento_modelo dm WHERE dm.usuario_responsavel_id = u.id
  )
LIMIT 1;
