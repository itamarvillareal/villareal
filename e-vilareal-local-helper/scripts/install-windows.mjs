#!/usr/bin/env node
/**
 * Instalador Windows — copia o agente para AppData e registra na pasta Inicializar.
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
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

function resolverNodeExe() {
  const execPath = String(process.execPath ?? '').trim();
  if (execPath && /node(?:\.exe)?$/i.test(execPath)) return execPath;
  try {
    const saida = execFileSync('where.exe', ['node'], { encoding: 'utf8' });
    const linha = saida
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find(Boolean);
    if (linha) return linha;
  } catch {
    /* ignorar */
  }
  return 'node';
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

function gerarBatIniciarAgente({ installDir, nodeExe, logPath, baseClientes, porta }) {
  const nodeQ = nodeExe.replace(/"/g, '""');
  const installQ = installDir.replace(/"/g, '""');
  const logQ = logPath.replace(/"/g, '""');
  const baseQ = baseClientes.replace(/"/g, '""');
  return [
    '@echo off',
    `cd /d "${installQ}"`,
    `set "VILAREAL_DRIVE_CLIENTES_BASE=${baseQ}"`,
    `for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":${porta}" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1`,
    `start "" /MIN "${nodeQ}" server.mjs 1>> "${logQ}" 2>&1`,
    '',
  ].join('\r\n');
}

function aguardarHealth(porta, tentativas = 12) {
  return new Promise((resolve) => {
    let n = 0;
    const tentar = () => {
      const req = http.get(`http://127.0.0.1:${porta}/health`, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', repetir);
      req.setTimeout(800, () => {
        req.destroy();
        repetir();
      });
    };
    const repetir = () => {
      n += 1;
      if (n >= tentativas) resolve(false);
      else setTimeout(tentar, 500);
    };
    tentar();
  });
}

if (process.platform !== 'win32') {
  fail('Este instalador é para Windows. No macOS use install-launchagent.mjs');
}

const nodeExe = resolverNodeExe();
if (nodeExe === 'node') {
  console.warn('Aviso: caminho completo do Node.js não encontrado — o agente pode falhar ao iniciar com o Windows.');
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
const porta = Number(process.env.VILAREAL_LOCAL_HELPER_PORT || 9876);
const batConteudo = gerarBatIniciarAgente({ installDir, nodeExe, logPath, baseClientes, porta });

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

const startupBat = path.join(startupDir, 'VillaReal-LocalHelper.bat');
const manualBat = path.join(installDir, 'Iniciar-Agente-VillaReal.bat');
fs.writeFileSync(startupBat, batConteudo, 'utf8');
fs.writeFileSync(manualBat, `${batConteudo}echo Agente iniciado. Teste em http://127.0.0.1:${porta}/health\r\necho Log: ${logPath.replace(/"/g, '""')}\r\n`, 'utf8');

encerrarProcessoNaPorta(porta);

spawn(nodeExe, [serverPath], {
  cwd: installDir,
  env: { ...process.env, VILAREAL_DRIVE_CLIENTES_BASE: baseClientes },
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
}).unref();

const ok = await aguardarHealth(porta);
console.log('');
console.log('Agente local instalado no Windows.');
console.log(`  Pasta:   ${installDir}`);
console.log(`  Node:    ${nodeExe}`);
console.log(`  Startup: ${startupBat}`);
console.log(`  Manual:  ${manualBat}`);
console.log(`  Base:    ${baseClientes}`);
console.log(`  Log:     ${logPath}`);
console.log('  O serviço sobe automaticamente a cada login.');
if (ok) {
  console.log(`  Status:  OK em http://127.0.0.1:${porta}/health`);
} else {
  console.log('  Status:  não respondeu — abra Iniciar-Agente-VillaReal.bat ou veja o log.');
}
