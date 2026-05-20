#!/usr/bin/env node
/**
 * @deprecated Preferir `scripts/sync-prazos-fatais-dropbox.mjs` ou `./scripts/sync-prazos-fatais-dropbox.sh`
 *
 * Mantido por compatibilidade; delega para o mesmo motor de sincronização.
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { runPrazoFatalDropboxCli } from './lib/prazo-fatal-dropbox-sync.mjs';

runPrazoFatalDropboxCli(process.argv.slice(2)).catch((e) => {
  console.error(e);
  process.exit(1);
});
