-- Tabela cadastro_pessoas (VilaReal).
-- IF NOT EXISTS: não altera nada se a tabela já existir no banco.
CREATE TABLE IF NOT EXISTS cadastro_pessoas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    telefone VARCHAR(20),
    data_nascimento DATE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_cadastro_pessoas_email UNIQUE (email),
    CONSTRAINT uk_cadastro_pessoas_cpf UNIQUE (cpf)
);
