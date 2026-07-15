#!/usr/bin/env node
/**
 * Instalador Windows — cria atalho na pasta Startup e grava caminho da base de clientes.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { helperRootDir } from './launchagent-config.mjs';
import { resolverBaseClientesInterativo } from './prompt-base-clientes.mjs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.platform !== 'win32') {
  fail('Este instalador é para Windows. No macOS use install-launchagent.mjs');
}

const root = helperRootDir();
const serverPath = path.join(root, 'server.mjs');
if (!fs.existsSync(serverPath)) {
  fail(`Arquivo não encontrado: ${serverPath}`);
}

const baseClientes = await resolverBaseClientesInterativo();
const configDir = path.join(os.homedir(), '.vilareal');
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(
  path.join(configDir, 'local-helper.env.json'),
  JSON.stringify({ VILAREAL_DRIVE_CLIENTES_BASE: baseClientes }, null, 2),
  'utf8',
);

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
const bat = `@echo off\r\nset VILAREAL_DRIVE_CLIENTES_BASE=${baseClientes.replace(/"/g, '""')}\r\nstart "" /MIN "${process.execPath}" "${serverPath.replace(/"/g, '""')}"\r\n`;
fs.writeFileSync(batPath, bat, 'utf8');

spawn(process.execPath, [serverPath], {
  env: { ...process.env, VILAREAL_DRIVE_CLIENTES_BASE: baseClientes },
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
}).unref();

console.log('Agente local instalado no Windows.');
console.log(`  Startup: ${batPath}`);
console.log(`  Base:    ${baseClientes}`);
console.log('  O serviço sobe automaticamente a cada login.');
