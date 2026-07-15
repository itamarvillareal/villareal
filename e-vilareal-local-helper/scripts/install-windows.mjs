#!/usr/bin/env node
/**
 * Instalador Windows — copia o agente para AppData e registra na pasta Inicializar.
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { helperRootDir } from './launchagent-config.mjs';
import { resolverBaseClientesInterativo } from './prompt-base-clientes.mjs';
import { copiarHelperPara, diretorioInstalacaoPadrao } from '../lib/instalar-arquivos-helper.mjs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function encerrarProcessoNaPorta(porta) {
  try {
    const saida = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
    const pid = saida
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha.includes(`:${porta}`) && /LISTENING/i.test(linha))
      .map((linha) => linha.split(/\s+/).pop())
      .find((valor) => /^\d+$/.test(String(valor ?? '')));
    if (pid) {
      execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
    }
  } catch {
    /* ignorar */
  }
}

if (process.platform !== 'win32') {
  fail('Este instalador é para Windows. No macOS use install-launchagent.mjs');
}

const origem = helperRootDir();
const installDir = diretorioInstalacaoPadrao();
copiarHelperPara(installDir, origem);

const serverPath = path.join(installDir, 'server.mjs');
if (!fs.existsSync(serverPath)) {
  fail(`Falha ao copiar agente para ${installDir}`);
}

const baseClientes = await resolverBaseClientesInterativo();
const configDir = path.join(os.homedir(), '.vilareal');
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(
  path.join(configDir, 'local-helper.env.json'),
  JSON.stringify({ VILAREAL_DRIVE_CLIENTES_BASE: baseClientes }, null, 2),
  'utf8',
);

const logPath = path.join(configDir, 'local-helper.log');
const startupDir = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
);
fs.mkdirSync(startupDir, { recursive: true });

const batPath = path.join(startupDir, 'VillaReal-LocalHelper.bat');
const bat = [
  '@echo off',
  `cd /d "${installDir.replace(/"/g, '""')}"`,
  `set "VILAREAL_DRIVE_CLIENTES_BASE=${baseClientes.replace(/"/g, '""')}"`,
  `start "" /MIN node server.mjs 1>> "${logPath.replace(/"/g, '""')}" 2>&1`,
  '',
].join('\r\n');
fs.writeFileSync(batPath, bat, 'utf8');

const porta = Number(process.env.VILAREAL_LOCAL_HELPER_PORT || 9876);
encerrarProcessoNaPorta(porta);

spawn(process.execPath, [serverPath], {
  cwd: installDir,
  env: { ...process.env, VILAREAL_DRIVE_CLIENTES_BASE: baseClientes },
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
}).unref();

console.log('Agente local instalado no Windows.');
console.log(`  Pasta:   ${installDir}`);
console.log(`  Startup: ${batPath}`);
console.log(`  Base:    ${baseClientes}`);
console.log(`  Log:     ${logPath}`);
console.log('  O serviço sobe automaticamente a cada login.');
