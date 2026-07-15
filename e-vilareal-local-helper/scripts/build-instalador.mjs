#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const helperRoot = path.resolve(__dirname, '..');
const webPublic = path.resolve(helperRoot, '../e-vilareal-react-web/public/instaladores');

const ARQUIVOS = [
  'server.mjs',
  'package.json',
  'lib/resolver-pasta-cliente-drive.mjs',
  'lib/validar-caminho-base-clientes.mjs',
  'lib/expandir-caminho-usuario.mjs',
  'lib/instalar-arquivos-helper.mjs',
  'scripts/install-launchagent.mjs',
  'scripts/install-windows.mjs',
  'scripts/prompt-base-clientes.mjs',
  'scripts/launchagent-config.mjs',
];

const INSTALAR_MAC = `#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Instale Node.js (nodejs.org) e execute este instalador novamente." buttons {"OK"} default button 1 with title "Villa Real — Pasta local"' 2>/dev/null || true
  echo "Node.js não encontrado. Instale em https://nodejs.org"
  read -r -p "Pressione Enter para fechar..."
  exit 1
fi
node scripts/install-launchagent.mjs
echo ""
read -r -p "Pressione Enter para fechar..."
`;

const INSTALAR_WIN = `@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js em https://nodejs.org e execute este instalador novamente.
  pause
  exit /b 1
)
node scripts\\install-windows.mjs
echo.
pause
`;

function copiarArvore(origem, destino, relativo) {
  const src = path.join(origem, relativo);
  const dst = path.join(destino, relativo);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function criarZip(origem, zipPath) {
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  if (process.platform === 'darwin') {
    execFileSync('zip', ['-r', zipPath, '.'], { cwd: origem, stdio: 'pipe' });
    return;
  }
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${origem.replace(/'/g, "''")}/*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
  ], { stdio: 'pipe' });
}

function montarPacote(sufixo, scriptNome, scriptConteudo) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), `vilareal-helper-${sufixo}-`));
  for (const rel of ARQUIVOS) {
    copiarArvore(helperRoot, staging, rel);
  }
  const scriptPath = path.join(staging, scriptNome);
  fs.writeFileSync(scriptPath, scriptConteudo, 'utf8');
  if (sufixo === 'macos') {
    fs.chmodSync(scriptPath, 0o755);
  }
  fs.mkdirSync(webPublic, { recursive: true });
  const zipPath = path.join(webPublic, `vilareal-local-helper-${sufixo}.zip`);
  criarZip(staging, zipPath);
  fs.rmSync(staging, { recursive: true, force: true });
  return zipPath;
}

const macZip = montarPacote('macos', 'Instalar-Pasta-Local-VillaReal.command', INSTALAR_MAC);
const winZip = montarPacote('windows', 'Instalar-Pasta-Local-VillaReal.bat', INSTALAR_WIN);

console.log('Instaladores gerados:');
console.log(`  ${macZip}`);
console.log(`  ${winZip}`);
