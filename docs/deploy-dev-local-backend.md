# Deploy DEV-local do backend (container `vilareal-backend`)

> Ambiente **DEV LOCAL** (não é a produção do portal `villarealadvocacia.adv.br`,
> que roda em outro host via `scripts/deploy-vps.sh`).
> Aqui o `db:3306` (porta interna do container MySQL) é o **mesmo** banco `vilareal`
> publicado no host como `localhost:3307`. Este ambiente **usa PROJUDI** (integração
> ativa, com credenciais reais no banco), então a `PROJUDI_CRED_KEY` pertence a ele.

## Como o container roda hoje

Container standalone (`docker run`, não gerenciado pelo compose), na rede
`villareal_default` com alias `backend`, porta host `8081` → `8080` interna,
`--add-host host.docker.internal:host-gateway`, volume `gmail-tokens` e variáveis
**apenas da aplicação** (`SPRING_PROFILES_ACTIVE=dev`, `SPRING_DATASOURCE_*` apontando
para `db:3306`, `JWT_SECRET`, `GMAIL_TOKENS_DIRECTORY`, `PROJUDI_CRED_KEY`).
O locale/`PATH`/`JAVA_HOME` devem vir **da imagem** — não sobrescrever `LANG`/`LC_ALL`
(senão `sun.jnu.encoding` deixa de ser UTF-8 e o class-load de `ImoveisPlanilhaImportService`
quebra com `InvalidPathException` no caminho acentuado "Administração").

O container antigo fica parado como `vilareal-backend-old` para rollback rápido.

## Fail-fast intencional da `PROJUDI_CRED_KEY` (manter como está)

`ProjudiCredencialService.validarChaveNaInicializacao` (`@EventListener(ApplicationReadyEvent)`)
**impede a subida** quando há credenciais PROJUDI no banco mas a chave do cofre não está
configurada — sem ela as senhas não poderiam ser decifradas. **Não** remover a chave nem
as credenciais para "subir sem segredo": isso quebra o PROJUDI. O TOTP, por outro lado,
**não** tem fail-fast de partida (o cofre só falha quando efetivamente usado).

## Checklist (pendências — NÃO executar agora)

1. **Próximo rebuild natural:** fornecer a `PROJUDI_CRED_KEY` **montando** o arquivo
   `e-vilareal-java-backend/.projudi-cred-key.local` no container (como o profile `dev`
   já espera, via `projudi.cred.key-file=.projudi-cred-key.local` resolvido em `/app`),
   em vez de passar a chave inline no `docker run --env-file`. Mantém o segredo fora do
   histórico de shell e do `docker inspect`.
   Ex.: `-v /Users/itamar/Documents/villareal/e-vilareal-java-backend/.projudi-cred-key.local:/app/.projudi-cred-key.local:ro`
   (e remover `PROJUDI_CRED_KEY` do env-file).

2. **Pré-produção** (antes de levar ao portal `.adv.br`): **trocar a senha do PROJUDI**
   e **regenerar a `PROJUDI_CRED_KEY`** — a senha foi exposta em testes anteriores.
   Após regenerar a chave, recadastrar a credencial PROJUDI
   (`e-vilareal-java-backend/scripts/projudi-recadastrar-credencial.sh`).
