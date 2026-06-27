ALTER TABLE contrato_locacao
    ADD COLUMN forma_pagamento_aluguel VARCHAR(40) NULL AFTER dia_vencimento_aluguel;
