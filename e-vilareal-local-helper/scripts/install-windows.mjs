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
    const pids = new Set(
      saida
        .split(/\r?\n/)
        .map((linha) => linha.trim())
        .filter((linha) => linha.includes(`:${porta}`) && /LISTENING/i.test(linha))
        .map((linha) => linha.split(/\s+/).pop())
        .filter((valor) => /^\d+$/.test(String(valor ?? ''))),
    );
    for (const pid of pids) {
      execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
    }
  } catch {
    /* ignorar */
  }
}

function escCmd(valor) {
  return String(valor ?? '').replace(/"/g, '""');
}

function gerarVbsIniciarAgente({ installDir, nodeExe, logPath, baseClientes }) {
  const installQ = escCmd(installDir);
  const nodeQ = escCmd(nodeExe);
  const logQ = escCmd(logPath);
  const baseQ = escCmd(baseClientes);
  return [
    'Set sh = CreateObject("WScript.Shell")',
    `cmd = "cmd /c cd /d ""${installQ}"" && set ""VILAREAL_DRIVE_CLIENTES_BASE=${baseQ}"" && ""${nodeQ}"" server.mjs >> ""${logQ}"" 2>&1"`,
    'sh.Run cmd, 0, False',
    '',
  ].join('\r\n');
}

function gerarBatIniciarAgente({ installDir, vbsPath, porta }) {
  const installQ = escCmd(installDir);
  const vbsQ = escCmd(vbsPath);
  return [
    '@echo off',
    `cd /d "${installQ}"`,
    `for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":${porta}" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1`,
    `wscript.exe //nologo "${vbsQ}"`,
    '',
  ].join('\r\n');
}

function registrarTarefaLogin({ startupBat }) {
  try {
    execFileSync(
      'schtasks',
      [
        '/Create',
        '/F',
        '/TN',
        'VillaRealLocalHelper',
        '/TR',
        `"${startupBat.replace(/"/g, '\\"')}"`,
        '/SC',
        'ONLOGON',
        '/RL',
        'LIMITED',
      ],
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

function aguardarHealth(porta, tentativas = 16) {
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

function lerFinalLog(logPath, linhas = 15) {
  try {
    if (!fs.existsSync(logPath)) return '(log ainda não criado)';
    const conteudo = fs.readFileSync(logPath, 'utf8').trim();
    if (!conteudo) return '(log vazio)';
    return conteudo.split(/\r?\n/).slice(-linhas).join('\n');
  } catch {
    return '(não foi possível ler o log)';
  }
}

function iniciarAgente({ nodeExe, serverPath, installDir, baseClientes, logPath }) {
  encerrarProcessoNaPorta(Number(process.env.VILAREAL_LOCAL_HELPER_PORT || 9876));
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] instalador: iniciando agente\n`);
  } catch {
    /* ignorar */
  }
  const child = spawn(nodeExe, [serverPath], {
    cwd: installDir,
    env: { ...process.env, VILAREAL_DRIVE_CLIENTES_BASE: baseClientes },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

if (process.platform !== 'win32') {
  fail('Este instalador é para Windows. No macOS use install-launchagent.mjs');
}

const nodeExe = resolverNodeExe();
if (nodeExe === 'node') {
  fail(
    'Node.js não encontrado no PATH.\n' +
      'Instale em https://nodejs.org (versão LTS), feche este terminal e execute o instalador de novo.',
  );
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
const vbsPath = path.join(installDir, 'iniciar-oculto.vbs');
const batConteudo = gerarBatIniciarAgente({ installDir, vbsPath, porta });
const vbsConteudo = gerarVbsIniciarAgente({ installDir, nodeExe, logPath, baseClientes });

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
fs.writeFileSync(vbsPath, vbsConteudo, 'utf8');
fs.writeFileSync(startupBat, batConteudo, 'utf8');
fs.writeFileSync(
  manualBat,
  `${batConteudo}timeout /t 2 /nobreak >nul\r\necho Teste: http://127.0.0.1:${porta}/health\r\necho Log: ${escCmd(logPath)}\r\n`,
  'utf8',
);

const tarefaOk = registrarTarefaLogin({ startupBat });
iniciarAgente({ nodeExe, serverPath, installDir, baseClientes, logPath });

const ok = await aguardarHealth(porta);
console.log('');
console.log('Agente local instalado no Windows.');
console.log(`  Pasta:   ${installDir}`);
console.log(`  Node:    ${nodeExe}`);
console.log(`  Startup: ${startupBat}`);
console.log(`  Manual:  ${manualBat}`);
console.log(`  Base:    ${baseClientes}`);
console.log(`  Log:     ${logPath}`);
console.log(`  Tarefa:  ${tarefaOk ? 'VillaRealLocalHelper (login)' : 'não registrada — usa Startup'}`);
console.log('  O serviço sobe automaticamente a cada login.');
if (ok) {
  console.log(`  Status:  OK em http://127.0.0.1:${porta}/health`);
  spawn('cmd', ['/c', 'start', '', `http://127.0.0.1:${porta}/health`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
} else {
  console.log('  Status:  NÃO respondeu.');
  console.log('');
  console.log('Últimas linhas do log:');
  console.log(lerFinalLog(logPath));
  console.log('');
  console.log('Tente executar manualmente:');
  console.log(`  ${manualBat}`);
  process.exitCode = 1;
}
