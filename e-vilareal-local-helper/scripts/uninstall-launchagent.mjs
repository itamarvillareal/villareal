#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';
import { launchAgentGuiTarget, launchAgentPlistPath, plistExists } from './launchagent-config.mjs';

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

if (process.platform !== 'darwin') {
  fail('Desinstalação automática disponível apenas no macOS.');
}

const plistPath = launchAgentPlistPath();
if (!plistExists()) {
  console.log('Nenhum LaunchAgent instalado.');
  process.exit(0);
}

const target = launchAgentGuiTarget();
runLaunchctl(['bootout', target, plistPath]);
fs.rmSync(plistPath, { force: true });

console.log('Agente local removido do login automático.');
console.log(`  Plist removido: ${plistPath}`);
