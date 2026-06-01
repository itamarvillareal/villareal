# villareal (Frontend com dados mockados)

Este repositório contém um frontend React (Vite) e um backend Java (Spring). O objetivo principal deste projeto é permitir que o frontend rode **sem backend**, usando dados mockados.

## Como o projeto roda com mock

- O frontend está em `e-vilareal-react-web/`.
- Os mocks usados pelo frontend ficam em `e-vilareal-react-web/src/data/`.
- Existe também a pasta padrão `e-vilareal-react-web/src/mocks/` (criada para manter uma estrutura organizada).
- Por padrão, a tela de cadastro de pessoas usa mock quando a variável de ambiente `VITE_USE_MOCK_CADASTRO_PESSOAS` está como `true`.
  - Arquivo incluído no repositório: `e-vilareal-react-web/.env.development`

## Onde ficam os mocks

- `e-vilareal-react-web/src/data/`
  - Exemplos: `mockData.js`, `cadastroPessoasMock.js`, `processosMock.js` e outros arquivos de mock.
- `e-vilareal-react-web/src/mocks/`
  - Estrutura vazia com `.gitkeep` (placeholder).

## Como alterar os dados mock

Edite os arquivos em `e-vilareal-react-web/src/data/` diretamente.

## Rodar localmente (sem backend)

1. Abra um terminal e entre na pasta do frontend:
   - `cd e-vilareal-react-web`
2. Instale dependências:
   - `npm install`
3. Inicie o dev server:
   - `npm run dev`

O backend não é necessário para a execução do frontend com mocks.

## Fonte de dados: sempre a VPS

- **Onde vivem os dados:** MySQL na **VPS** (é o que o **portal** usa). Não há um “segundo banco oficial” no Mac.
- **Trabalhar localmente:** abre o **túnel SSH** (`localhost:3308` → MySQL na VPS) e corre o backend apontando para esse túnel (ver `.env.docker` e `./scripts/dev-up.sh`). Assim, o teu `localhost:8081` lê e grava **no mesmo sítio** que o portal.
- **Importações em Node** (`import-*-planilha.mjs`): para garantir que nada fica só na máquina, define sempre a API de produção, por exemplo  
  `export VILAREAL_API_BASE='https://portal.villarealadvocacia.adv.br'`  
  (ajusta o URL se o teu domínio for outro). Assim os `POST` vão para o backend da VPS e os dados caem na base certa.
- **MySQL só em Docker no Mac** (`docker-compose.local-db.yml`): apenas para testes pontuais / legado — **não** usar como destino de cargas reais se quiseres paridade com o portal.

## Rodar tudo com Docker (backend ligado ao MySQL na VPS)

O stack por defeito **não** inclui MySQL em Docker: o backend usa o servidor na VPS através de um **túnel SSH** (`localhost:3308` → MySQL na VPS).

1. Copiar credenciais do Compose: `cp .env.docker.example .env.docker` e editar `VILLAREAL_COMPOSE_JDBC_PASSWORD` (utilizador MySQL remoto na VPS, ex. `villareal_remote`).
2. Abrir o túnel e subir os containers:

```bash
./scripts/dev-up.sh
```

Ou manualmente: `ssh -N -L 3308:127.0.0.1:3306 root@SEU_HOST` e noutro terminal  
`docker compose --env-file .env.docker up --build -d`.

Serviços:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8081`
- Dados: MySQL na VPS (via túnel na porta **3308**)

Para parar:

```bash
./scripts/dev-down.sh
```

MySQL local em Docker (opcional, legado):

```bash
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up --build -d
```

## Observação sobre índices monetários

O cálculo de atualização monetária busca índices mensais via APIs públicas (por exemplo, Banco Central do Brasil) para algumas opções. Isso não depende do backend Java.

## Documentação

Documentação técnica e operacional fica em [`docs/`](docs/). Destaques:

### Júlia (triagem por IA)

- [**Retrato da Júlia**](docs/julia/retrato-da-julia.md) — design da assistente-IA de triagem processual, princípios de autonomia, motor de triagem e plano faseado de implementação (documento vivo).

Outros tópicos (homologação, fases de banco, frontend): ver arquivos em [`docs/`](docs/) (ex.: [`homologation-quick-start.md`](docs/homologation-quick-start.md), [`database-phases.md`](docs/database-phases.md)).

