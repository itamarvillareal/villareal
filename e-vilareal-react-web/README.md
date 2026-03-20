# VILA real – Projeto Jurídico (Web)

Interface web do projeto jurídico **VILA real**, baseada no layout do sistema existente (quadro Kanban por responsável).

## Stack

- **React 19** + **Vite 7**
- **Tailwind CSS** (v4) – estilização
- **React Router DOM** – navegação
- **Lucide React** – ícones

## Estrutura

- **Sidebar**: Início, Clientes, Processos, Agenda, Relatório, Pendências, Diligências, Dativos
- **Área principal**: colunas por responsável (Dr. Itamar, Karla, ISABELLA, Thalita) com cards de tarefas
- **Dados**: todos mockados em `src/data/mockData.js`

## Como rodar

```bash
npm install
npm run dev
```

Acesse o endereço exibido no terminal (geralmente `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview   # preview da build
```

## Pastas principais

- `src/components/` – Sidebar, Board, Column, TaskCard
- `src/data/mockData.js` – dados mockados (menu, colunas, tarefas)

## Diagnósticos e processos (localStorage)

Na primeira carga, o app chama `ensureHistoricoDemonstracaoDiagnostico()` (`src/data/processosHistoricoData.js`), que grava no **localStorage** (`vilareal:processos-historico:v1`) registros alinhados ao mock `getMockProcesso10x10` (clientes **1–10**, processos **1–10**):

- **Datas sugeridas** na tela: **19/03/2026** (consultas e prazo fatal) e **20/03/2026** (histórico extra).
- **Cliente 00000001**, processos **1–6**: uma fase diferente em cada um (Documentos, Peticionar, Verificação, Protocolo/Movimentação, Providência, Proc. Adm.).
- **Busca pessoa**: código **2** (vínculo demo no proc. 1 do cliente 1).
- **Reaplicar dados demo**: botão na tela Diagnósticos ou `reaplicarDemonstracaoDiagnostico()` no console.

Chaves já existentes **não são sobrescritas** no seed automático; use o botão de reset para forçar o pacote completo.
