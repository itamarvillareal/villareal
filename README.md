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

## Observação sobre índices monetários

O cálculo de atualização monetária busca índices mensais via APIs públicas (por exemplo, Banco Central do Brasil) para algumas opções. Isso não depende do backend Java.

