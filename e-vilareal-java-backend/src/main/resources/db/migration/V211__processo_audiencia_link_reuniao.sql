ALTER TABLE processo
    ADD COLUMN audiencia_link_reuniao VARCHAR(500) NULL COMMENT 'Link da reunião virtual (audiência online)' AFTER audiencia_tipo;
