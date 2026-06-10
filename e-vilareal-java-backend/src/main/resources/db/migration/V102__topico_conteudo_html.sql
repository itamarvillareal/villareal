-- Conteúdo no formato novo (HTML + tokens {{...}}) gerado por TopicoLegadoConversor.
-- conteudo_template (legado) permanece intacto como fonte de verdade/backup.
ALTER TABLE topico ADD COLUMN conteudo_html LONGTEXT NULL;
ALTER TABLE topico ADD COLUMN classe_html VARCHAR(40) NULL;
