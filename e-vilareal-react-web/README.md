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
