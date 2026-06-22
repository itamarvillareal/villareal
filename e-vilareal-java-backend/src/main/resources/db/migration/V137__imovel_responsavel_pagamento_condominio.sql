-- Quem paga o condomínio do imóvel (NULL = ainda não definido).
ALTER TABLE imovel
    ADD COLUMN responsavel_pagamento_condominio ENUM('ESCRITORIO', 'DONO') NULL DEFAULT NULL
        AFTER condominio;
