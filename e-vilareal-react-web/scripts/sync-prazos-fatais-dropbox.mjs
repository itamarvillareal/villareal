#!/usr/bin/env node
/**
 * Sincroniza prazos fatais do Dropbox (Gerais/145.1) com a base SQL via API.
 *
 * Cada ficheiro `00000NNN.145.1.<proc>.txt` contém a data (dd/mm/aaaa).
 * A pasta ano/mês mais recente vence em caso de duplicata (como o legado VB).
 *
 * Uso:
 *   node scripts/sync-prazos-fatais-dropbox.mjs
 *   node scripts/sync-prazos-fatais-dropbox.mjs --aplicar
 *   ./scripts/sync-prazos-fatais-dropbox.sh --aplicar
 *
 * Opções:
 *   --aplicar              Grava na API (sem isto: só relatório dry-run)
 *   --dry-run              Igual ao defeito sem --aplicar
 *   --base=PATH            Raiz 145.1 (defeito: ~/Dropbox/Banco de Dados/Gerais/145.1)
 *   --cliente=N            Só um código cliente
 *   --ano-min= --ano-max=
 *   --apenas-diferentes    Não regrava se a data na API já coincide
 *   --relatorio=JSON       Caminho do relatório (defeito: tmp/relatorio-prazos-fatais-….json)
 *   --login= --senha=      Ou VILAREAL_IMPORT_SENHA / ~/.vilareal-import-env
 *   --base-url=            Defeito: VILAREAL_API_BASE ou http://localhost:8081
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_LOGIN
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { runPrazoFatalDropboxCli } from './lib/prazo-fatal-dropbox-sync.mjs';

runPrazoFatalDropboxCli(process.argv.slice(2)).catch((e) => {
  console.error(e);
  process.exit(1);
});
