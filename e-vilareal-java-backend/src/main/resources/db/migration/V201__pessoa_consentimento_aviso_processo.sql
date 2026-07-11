-- Consentimento próprio para o AVISO DE PROCESSO NOVO via WhatsApp (Parte 5, Bloco OPT-IN).
--
-- Mora na PESSOA, não no cliente: o monitoramento, os descobertos e a baseline são todos
-- por pessoa; quem consente é o titular (a mesma pessoa pode ter N clientes — consentir
-- por cliente criaria estados contraditórios para o mesmo titular). O telefone de envio
-- continua sendo resolvido no momento do envio (ClienteWhatsApp → contatos → pessoa).
--
-- NÃO herda o fundamento do lembrete_audiencia: este consentimento é explícito e exclusivo
-- para o aviso de processo novo. O Bloco E RECUSA envio no backend quando FALSE.
--
-- As colunas de data/origem registram o ÚLTIMO evento de consentimento (grant ou revogação);
-- histórico completo, se um dia for preciso, será tabela própria.
ALTER TABLE pessoa
    ADD COLUMN aceita_aviso_processo_novo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN aviso_consentimento_em DATETIME NULL,
    ADD COLUMN aviso_consentimento_origem VARCHAR(60) NULL;
