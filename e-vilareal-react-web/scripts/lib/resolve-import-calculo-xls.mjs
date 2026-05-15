/**
 * Caminho por defeito de `import-calculo.xls`, alinhado ao import legado e ao histórico
 * (`Dropbox/sistema/...` no Windows; no macOS/Linux tenta `~/Dropbox/sistema/...`).
 *
 * Override: argumento CLI, ou env `VILAREAL_IMPORT_CALCULO_XLS`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** Mesmo valor que `import-calculos-planilha.mjs` (layout legado). */
const DEFAULT_WINDOWS = 'C:\\Users\\jrvill\\Dropbox\\sistema\\import-calculo.xls';

/**
 * @param {string | null | undefined} explicit — caminho passado na CLI (opcional)
 * @returns {string | null} primeiro caminho absoluto que existir, ou null
 */
export function resolveImportCalculoXlsPath(explicit) {
  const fromEnv = process.env.VILAREAL_IMPORT_CALCULO_XLS?.trim();
  const home = os.homedir();

  const candidatos = [
    explicit?.trim() || null,
    fromEnv || null,
    path.join(process.cwd(), 'sistema', 'import-calculo.xls'),
    path.join(process.cwd(), '..', 'sistema', 'import-calculo.xls'),
    ...(process.platform === 'win32' ? [DEFAULT_WINDOWS] : []),
    path.join(home, 'Dropbox', 'sistema', 'import-calculo.xls'),
    path.join(home, 'Library', 'CloudStorage', 'Dropbox', 'sistema', 'import-calculo.xls'),
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

/** Para mensagens de erro: lista sucinta de caminhos tentados. */
export function candidatosImportCalculoXlsParaLog(explicit) {
  const fromEnv = process.env.VILAREAL_IMPORT_CALCULO_XLS?.trim();
  const home = os.homedir();
  const uniq = [];
  const push = (p) => {
    if (!p) return;
    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (!uniq.includes(abs)) uniq.push(abs);
  };
  push(explicit?.trim());
  push(fromEnv);
  push(path.join(process.cwd(), 'sistema', 'import-calculo.xls'));
  push(path.join(process.cwd(), '..', 'sistema', 'import-calculo.xls'));
  if (process.platform === 'win32') push(DEFAULT_WINDOWS);
  push(path.join(home, 'Dropbox', 'sistema', 'import-calculo.xls'));
  push(path.join(home, 'Library', 'CloudStorage', 'Dropbox', 'sistema', 'import-calculo.xls'));
  return uniq;
}
