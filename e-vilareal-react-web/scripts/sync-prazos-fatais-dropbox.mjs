#!/usr/bin/env node
/**
 * Sincroniza prazos fatais do Dropbox (Gerais, regra VB subpasta) com a base SQL via API.
 *
 * Fonte: `Gerais/{1000|2000}/{Centena}/{Unidade}/00000NNN.145.1.<proc>.txt`
 * Não usa `Gerais/145.1/aaaa/mm/` (histórico mensal).
 *
 * Uso:
 *   node scripts/sync-prazos-fatais-dropbox.mjs
 *   node scripts/sync-prazos-fatais-dropbox.mjs --aplicar
 *   ./scripts/sync-prazos-fatais-dropbox.sh --aplicar
 *
 * Opções:
 *   --aplicar              Grava na API (sem isto: só relatório dry-run)
 *   --base=PATH            Raiz Gerais (defeito: ~/Dropbox/Banco de Dados/Gerais)
 *   --cliente=N            Só um código cliente
 *   --apenas-diferentes    Não regrava se a data na API já coincide
 *   --relatorio=JSON
 *   --login= --senha=      Ou VILAREAL_IMPORT_SENHA / ~/.vilareal-import-env
 *   --base-url=            Defeito: VILAREAL_API_BASE ou http://localhost:8081
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { runPrazoFatalDropboxCli } from './lib/prazo-fatal-dropbox-sync.mjs';

runPrazoFatalDropboxCli(process.argv.slice(2)).catch((e) => {
  console.error(e);
  process.exit(1);
});
