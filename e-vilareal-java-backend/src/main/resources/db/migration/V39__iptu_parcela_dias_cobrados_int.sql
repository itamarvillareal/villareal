-- Alinha dias_cobrados com IptuParcelaEntity (Integer / INT); V38 criou como TINYINT.
ALTER TABLE iptu_parcela
    MODIFY COLUMN dias_cobrados INT NOT NULL;
