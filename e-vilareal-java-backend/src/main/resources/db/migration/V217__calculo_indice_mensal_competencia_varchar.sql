-- Hibernate valida competencia como VARCHAR(7); V216 criou CHAR(7).
ALTER TABLE calculo_indice_mensal
    MODIFY competencia VARCHAR(7) NOT NULL COMMENT 'yyyy-MM';
