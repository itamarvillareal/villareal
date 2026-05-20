/**
 * Caminho por defeito de `Extratos Bancos - Itamar.xls` (pasta Dropbox/sistema).
 * Override: argumento CLI, ou env `VILAREAL_EXTRATO_BANCOS_XLS`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export const NOME_FICHEIRO_EXTRATO_BANCOS = 'Extratos Bancos - Itamar.xls';

/**
 * @param {string | null | undefined} explicit
 * @returns {string | null}
 */
export function resolveExtratoBancosPlanilhaXlsPath(explicit) {
  const fromEnv = process.env.VILAREAL_EXTRATO_BANCOS_XLS?.trim();
  const home = os.homedir();

  const candidatos = [
    explicit?.trim() || null,
    fromEnv || null,
    path.join(home, 'Dropbox', 'sistema', NOME_FICHEIRO_EXTRATO_BANCOS),
    path.join(home, 'Library', 'CloudStorage', 'Dropbox', 'sistema', NOME_FICHEIRO_EXTRATO_BANCOS),
    path.join(process.cwd(), 'sistema', NOME_FICHEIRO_EXTRATO_BANCOS),
    path.join(process.cwd(), '..', 'sistema', NOME_FICHEIRO_EXTRATO_BANCOS),
    `/Users/itamar/Dropbox/sistema/${NOME_FICHEIRO_EXTRATO_BANCOS}`,
  ].filter(Boolean);

  const vistos = new Set();
  for (const c of candidatos) {
    const abs = path.isAbsolute(c) ? c : path.resolve(process.cwd(), c);
    if (vistos.has(abs)) continue;
    vistos.add(abs);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

/** @param {string | null | undefined} explicit */
export function candidatosExtratoBancosPlanilhaXlsParaLog(explicit) {
  const fromEnv = process.env.VILAREAL_EXTRATO_BANCOS_XLS?.trim();
  const home = os.homedir();
  const uniq = [];
  const push = (p) => {
    if (!p) return;
    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (!uniq.includes(abs)) uniq.push(abs);
  };
  push(explicit?.trim());
  push(fromEnv);
  push(path.join(home, 'Dropbox', 'sistema', NOME_FICHEIRO_EXTRATO_BANCOS));
  push(path.join(home, 'Library', 'CloudStorage', 'Dropbox', 'sistema', NOME_FICHEIRO_EXTRATO_BANCOS));
  push(`/Users/itamar/Dropbox/sistema/${NOME_FICHEIRO_EXTRATO_BANCOS}`);
  return uniq;
}

/**
 * @param {string | null | undefined} explicit
 * @returns {string}
 */
export function requireExtratoBancosPlanilhaXlsPath(explicit) {
  const p = resolveExtratoBancosPlanilhaXlsPath(explicit);
  if (p) return p;
  throw new Error(
    `Planilha não encontrada. Tentados:\n${candidatosExtratoBancosPlanilhaXlsParaLog(explicit).map((x) => `  ${x}`).join('\n')}`,
  );
}
