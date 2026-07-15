import os from 'node:os';
import path from 'node:path';

/** Expande ~, %USERPROFILE% e variáveis simples de caminho. */
export function expandirCaminhoUsuario(caminho) {
  let s = String(caminho ?? '').trim();
  if (!s) return s;

  if (s.startsWith('~/')) {
    return path.join(os.homedir(), s.slice(2));
  }
  if (process.platform === 'win32') {
    const home = os.homedir();
    s = s.replace(/%USERPROFILE%/gi, home);
    s = s.replace(/%HOMEDRIVE%%HOMEPATH%/gi, home);
    s = s.replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'));
  }
  return s;
}
