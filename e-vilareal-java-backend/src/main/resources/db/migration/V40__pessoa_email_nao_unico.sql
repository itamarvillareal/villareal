-- Permite o mesmo endereço de e-mail em várias linhas de pessoa (importação / uso partilhado).
ALTER TABLE pessoa DROP INDEX uk_pessoa_email;
