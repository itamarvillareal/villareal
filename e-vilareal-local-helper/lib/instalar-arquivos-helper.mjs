import fs from 'node:fs';
import path from 'node:path';

const ARQUIVOS_HELPER = [
  'server.mjs',
  'package.json',
  'lib/resolver-pasta-cliente-drive.mjs',
  'lib/validar-caminho-base-clientes.mjs',
  'lib/expandir-caminho-usuario.mjs',
  'scripts/prompt-base-clientes.mjs',
  'scripts/launchagent-config.mjs',
  'scripts/install-launchagent.mjs',
  'scripts/install-windows.mjs',
];

export function copiarHelperPara(destino, origem) {
  fs.mkdirSync(destino, { recursive: true });
  for (const rel of ARQUIVOS_HELPER) {
    const src = path.join(origem, rel);
    const dst = path.join(destino, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

export function diretorioInstalacaoPadrao() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    return path.join(base, 'VillaReal', 'local-helper');
  }
  return path.join(process.env.HOME || '', '.vilareal', 'local-helper');
}
