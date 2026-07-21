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
chcp 65001 >nul
cd /d "%~dp0"
title Villa Real - Pasta local
echo.
echo === Instalador Villa Real (Windows) ===
echo.
for /f "delims=" %%i in ('where node 2^>nul') do (
  set "NODE_EXE=%%i"
  goto :node_ok
)
echo [ERRO] Node.js nao encontrado.
echo Instale a versao LTS em https://nodejs.org
echo Depois feche esta janela e execute este instalador novamente.
echo.
pause
exit /b 1
:node_ok
echo Node.js: %NODE_EXE%
echo.
"%NODE_EXE%" scripts\\install-windows.mjs
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo Instalacao falhou. Veja o log em %%USERPROFILE%%\\.vilareal\\local-helper.log
  pause
  exit /b %ERR%
)
echo Instalacao concluida. Teste http://127.0.0.1:9876/health no navegador.
pause
`;

const DIAGNOSTICAR_WIN = `@echo off
chcp 65001 >nul
title Villa Real - Diagnostico Pasta local
echo.
echo === Diagnostico Villa Real (Windows) ===
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao instalado. Baixe em https://nodejs.org
) else (
  for /f "delims=" %%i in ('where node') do echo Node: %%i
  node --version
)
echo.
echo Porta 9876:
netstat -ano | findstr ":9876" | findstr "LISTENING" || echo   (nenhum processo escutando)
echo.
set "HELPER=%LOCALAPPDATA%\\VillaReal\\local-helper"
if exist "%HELPER%\\Iniciar-Agente-VillaReal.bat" (
  echo Agente encontrado em %HELPER%
  echo Iniciando agente...
  call "%HELPER%\\Iniciar-Agente-VillaReal.bat"
  timeout /t 3 /nobreak >nul
) else (
  echo [AVISO] Agente nao instalado. Execute Instalar-Pasta-Local-VillaReal.bat primeiro.
)
echo.
echo Teste http://127.0.0.1:9876/health no navegador.
echo.
if exist "%USERPROFILE%\\.vilareal\\local-helper.log" (
  echo --- Log ---
  powershell -NoProfile -Command "Get-Content -Path $env:USERPROFILE\\.vilareal\\local-helper.log -Tail 20"
) else (
  echo Log ainda nao existe: %%USERPROFILE%%\\.vilareal\\local-helper.log
)
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

function montarPacote(sufixo, scriptNome, scriptConteudo, extras = []) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), `vilareal-helper-${sufixo}-`));
  for (const rel of ARQUIVOS) {
    copiarArvore(helperRoot, staging, rel);
  }
  const scriptPath = path.join(staging, scriptNome);
  fs.writeFileSync(scriptPath, scriptConteudo, 'utf8');
  for (const extra of extras) {
    fs.writeFileSync(path.join(staging, extra.nome), extra.conteudo, 'utf8');
  }
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
const winZip = montarPacote('windows', 'Instalar-Pasta-Local-VillaReal.bat', INSTALAR_WIN, [
  { nome: 'Diagnosticar-Pasta-Local-VillaReal.bat', conteudo: DIAGNOSTICAR_WIN },
]);

console.log('Instaladores gerados:');
console.log(`  ${macZip}`);
console.log(`  ${winZip}`);
