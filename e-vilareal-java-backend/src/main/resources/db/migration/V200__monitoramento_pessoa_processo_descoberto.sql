-- Monitoramento de pessoas por CPF/CNPJ no PROJUDI (descoberta de processos novos).
--
-- pessoa: usa o flag existente marcado_monitoramento como interruptor; adiciona o polo
-- monitorado e o instante em que a baseline (primeira varredura completa) foi concluída.
ALTER TABLE pessoa
    ADD COLUMN polo_monitorado VARCHAR(10) NOT NULL DEFAULT 'AMBOS',
    ADD COLUMN baseline_em DATETIME NULL;

-- processo: coluna de busca com o CNJ só-dígitos (20 dígitos), para o dedupe da varredura
-- casar reduzido+ano contra o acervo sem depender da máscara livre de numero_cnj.
-- Backfill: apenas quando o resultado tem exatamente 20 dígitos (CNJ padrão); numerações
-- antigas/livres ficam NULL — elas não participam do dedupe por CNJ.
ALTER TABLE processo
    ADD COLUMN numero_cnj_digitos VARCHAR(20) NULL;

UPDATE processo
SET numero_cnj_digitos = NULLIF(REGEXP_REPLACE(IFNULL(numero_cnj, ''), '[^0-9]', ''), '')
WHERE numero_cnj IS NOT NULL
  AND CHAR_LENGTH(REGEXP_REPLACE(IFNULL(numero_cnj, ''), '[^0-9]', '')) = 20;

CREATE INDEX idx_processo_numero_cnj_digitos ON processo (numero_cnj_digitos);

-- Linha da lista do BuscaProcesso vista para uma pessoa monitorada. A lista só traz o
-- número REDUZIDO (sequencial-dv) + data de distribuição; o CNJ completo/classe/serventia
-- são preenchidos apenas quando o detalhe é aberto (candidatos a NOVO).
CREATE TABLE processo_descoberto (
    id BIGINT NOT NULL AUTO_INCREMENT,
    pessoa_id BIGINT NOT NULL,
    numero_reduzido VARCHAR(20) NOT NULL,
    ano_distribuicao INT NOT NULL,
    data_distribuicao DATETIME NULL,
    -- Sufixo de 12 dígitos do Id_Processo (estável entre sessões; o token completo NÃO é).
    -- Gravado para estudo — NÃO é chave de dedupe até provarmos unicidade (WARN em log).
    id_processo_sufixo VARCHAR(12) NULL,
    numero_cnj VARCHAR(100) NULL,
    classe VARCHAR(255) NULL,
    serventia VARCHAR(255) NULL,
    -- ATIVO | PASSIVO | AMBOS | INDETERMINADO (comparação de nome, assimétrica pró-alerta)
    polo_da_pessoa VARCHAR(15) NOT NULL DEFAULT 'INDETERMINADO',
    partes_ativo TEXT NULL,
    partes_passivo TEXT NULL,
    -- BASELINE | NOVO | IGNORADO | VINCULADO
    situacao VARCHAR(12) NOT NULL,
    processo_id BIGINT NULL,
    primeiro_visto_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    -- Chave natural do dedupe: reduzido repete entre anos, mas não dentro do mesmo ano.
    UNIQUE KEY uk_processo_descoberto_pessoa_num_ano (pessoa_id, numero_reduzido, ano_distribuicao),
    KEY idx_processo_descoberto_situacao (situacao),
    KEY idx_processo_descoberto_sufixo (id_processo_sufixo),

    CONSTRAINT fk_processo_descoberto_pessoa
        FOREIGN KEY (pessoa_id) REFERENCES pessoa (id) ON DELETE CASCADE,
    CONSTRAINT fk_processo_descoberto_processo
        FOREIGN KEY (processo_id) REFERENCES processo (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico de varreduras por pessoa (baseline e incrementais).
CREATE TABLE varredura_pessoa (
    id BIGINT NOT NULL AUTO_INCREMENT,
    pessoa_id BIGINT NOT NULL,
    inicio DATETIME(3) NOT NULL,
    fim DATETIME(3) NULL,
    -- EXECUTANDO | SUCESSO | PARCIAL | ERRO
    status VARCHAR(20) NOT NULL,
    paginas_lidas INT NOT NULL DEFAULT 0,
    encontrados INT NOT NULL DEFAULT 0,
    novos INT NOT NULL DEFAULT 0,
    qtd_segredo INT NOT NULL DEFAULT 0,
    erro_codigo VARCHAR(40) NULL,
    erro_mensagem TEXT NULL,

    PRIMARY KEY (id),
    KEY idx_varredura_pessoa_pessoa (pessoa_id, inicio),

    CONSTRAINT fk_varredura_pessoa_pessoa
        FOREIGN KEY (pessoa_id) REFERENCES pessoa (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Linhas de segredo de justiça são opacas (sem número/partes/link) e não deduplicam:
-- monitoramos a CONTAGEM por serventia; aumento gera alerta de verificação manual.
CREATE TABLE segredo_justica_contagem (
    pessoa_id BIGINT NOT NULL,
    serventia VARCHAR(255) NOT NULL,
    qtd INT NOT NULL DEFAULT 0,
    atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (pessoa_id, serventia),

    CONSTRAINT fk_segredo_contagem_pessoa
        FOREIGN KEY (pessoa_id) REFERENCES pessoa (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
