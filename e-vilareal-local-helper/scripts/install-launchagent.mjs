#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  buildLaunchAgentPlist,
  helperRootDir,
  launchAgentGuiTarget,
  launchAgentPlistPath,
  logDirPath,
  plistExists,
} from './launchagent-config.mjs';
import { resolverBaseClientesInterativo } from './prompt-base-clientes.mjs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runLaunchctl(args) {
  try {
    execFileSync('launchctl', args, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function collectEnvironment(baseClientes) {
  const env = {};
  if (baseClientes) env.VILAREAL_DRIVE_CLIENTES_BASE = baseClientes;
  for (const key of ['VILAREAL_LOCAL_HELPER_PORT', 'VILAREAL_LOCAL_HELPER_HOST']) {
    const value = process.env[key];
    if (value != null && String(value).trim() !== '') env[key] = String(value).trim();
  }
  return env;
}

if (process.platform !== 'darwin') {
  fail('Instalação automática disponível apenas no macOS. Use install-windows.mjs no Windows.');
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

const logsDir = logDirPath();
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(path.dirname(launchAgentPlistPath()), { recursive: true });

const plist = buildLaunchAgentPlist({
  nodePath: process.execPath,
  serverPath,
  workingDirectory: root,
  stdoutPath: path.join(logsDir, 'local-helper.log'),
  stderrPath: path.join(logsDir, 'local-helper.err.log'),
  environment: collectEnvironment(baseClientes),
});

const plistPath = launchAgentPlistPath();
if (plistExists()) {
  runLaunchctl(['bootout', launchAgentGuiTarget(), plistPath]);
}

fs.writeFileSync(plistPath, plist, 'utf8');

const target = launchAgentGuiTarget();
runLaunchctl(['bootstrap', target, plistPath]);
runLaunchctl(['kickstart', '-k', `${target}/br.adv.villareal.local-helper`]);

console.log('Agente local instalado e iniciado.');
console.log(`  Plist: ${plistPath}`);
console.log(`  Base:  ${baseClientes}`);
console.log(`  Logs:  ${logsDir}`);
console.log('  O serviço sobe automaticamente a cada login.');
console.log('');
console.log('Para remover: npm run local-helper:uninstall');
console.log('           ou bash e-vilareal-local-helper/uninstall.sh');
