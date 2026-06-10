#!/usr/bin/env node
/**
 * Sincroniza unidades dos processos a partir de ficheiros `0.88.*` em Calculos.
 *
 * Fonte: `Calculos/{1000|2000}/{Centena}/{Cliente}/00000NNN.0.88.1.<proc>.txt`
 * Destino: coluna `processo.unidade` (via API ou `--mysql`).
 *
 * Uso:
 *   node scripts/sync-unidades-calculos-dropbox.mjs
 *   node scripts/sync-unidades-calculos-dropbox.mjs --aplicar
 *   node scripts/sync-unidades-calculos-dropbox.mjs --aplicar --cliente=299
 *   node scripts/sync-unidades-calculos-dropbox.mjs --aplicar --mysql
 *
 * Opções:
 *   --aplicar              Grava na base (sem isto: só relatório dry-run)
 *   --mysql                UPDATE directo em MySQL (sem API)
 *   --base=PATH            Raiz Calculos (defeito: ~/Dropbox/Banco de Dados/Calculos)
 *   --cliente=N            Só um código cliente
 *   --apenas-diferentes    Não regrava se a unidade na base já coincide
 *   --relatorio=JSON
 *   --login= --senha=      Ou VILAREAL_IMPORT_SENHA / .env.import.local
 *   --base-url=            Defeito: VILAREAL_API_BASE ou http://localhost:8080
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { runUnidadeCalculosDropboxCli } from './lib/unidade-calculos-dropbox-sync.mjs';

runUnidadeCalculosDropboxCli(process.argv.slice(2)).catch((e) => {
  console.error(e);
  process.exit(1);
});
