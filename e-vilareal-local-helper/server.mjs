#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  detectarBaseClientesDrive,
  resolverPastaClienteDrive,
} from './lib/resolver-pasta-cliente-drive.mjs';

function carregarConfigPersistida() {
  try {
    const configPath = path.join(os.homedir(), '.vilareal', 'local-helper.env.json');
    if (!fs.existsSync(configPath)) return;
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed ?? {})) {
      if (value != null && String(value).trim() !== '' && !process.env[key]) {
        process.env[key] = String(value).trim();
      }
    }
  } catch {
    /* ignorar config inválida */
  }
}

carregarConfigPersistida();

const PORT = Number(process.env.VILAREAL_LOCAL_HELPER_PORT || 9876);
const HOST = process.env.VILAREAL_LOCAL_HELPER_HOST || '127.0.0.1';

let baseClientesCache = detectarBaseClientesDrive();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...corsHeaders(),
  });
  res.end(payload);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
  };
}

function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function abrirNoSistema(caminho) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(caminho)) {
      reject(new Error(`Caminho não existe: ${caminho}`));
      return;
    }
    let cmd;
    let args;
    if (process.platform === 'darwin') {
      cmd = 'open';
      args = [caminho];
    } else if (process.platform === 'win32') {
      cmd = path.join(process.env.SystemRoot || 'C:\\Windows', 'explorer.exe');
      args = [caminho];
    } else {
      cmd = 'xdg-open';
      args = [caminho];
    }
    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (process.platform === 'win32') {
        resolve();
        return;
      }
      if (code === 0) resolve();
      else reject(new Error(`Falha ao abrir pasta (código ${code})`));
    });
  });
}

async function handleAbrirPastaCliente(body) {
  const codigoCliente = String(body.codigoCliente ?? '').trim();
  if (!codigoCliente) throw new Error('codigoCliente é obrigatório');

  baseClientesCache = detectarBaseClientesDrive();
  const caminho = resolverPastaClienteDrive({
    baseDir: baseClientesCache,
    codigoCliente,
    nomeCliente: body.nomeCliente,
    numeroInterno: body.numeroInterno,
  });
  await abrirNoSistema(caminho);
  return { ok: true, caminho, baseClientes: baseClientesCache };
}

async function handleAbrirCaminho(body) {
  const caminho = String(body.caminho ?? '').trim();
  if (!caminho) throw new Error('caminho é obrigatório');
  await abrirNoSistema(caminho);
  return { ok: true, caminho };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      baseClientesCache = detectarBaseClientesDrive();
      json(res, 200, {
        ok: true,
        plataforma: process.platform,
        baseClientes: baseClientesCache,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/abrir-pasta-cliente') {
      const body = await lerCorpoJson(req);
      const result = await handleAbrirPastaCliente(body);
      json(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/abrir-caminho') {
      const body = await lerCorpoJson(req);
      const result = await handleAbrirCaminho(body);
      json(res, 200, result);
      return;
    }

    json(res, 404, { ok: false, erro: 'Rota não encontrada' });
  } catch (err) {
    json(res, 400, { ok: false, erro: err?.message || 'Erro interno' });
  }
});

server.listen(PORT, HOST, () => {
  baseClientesCache = detectarBaseClientesDrive();
  console.log(`[vilareal-local-helper] http://${HOST}:${PORT}`);
  console.log(
    baseClientesCache
      ? `[vilareal-local-helper] base clientes: ${baseClientesCache}`
      : '[vilareal-local-helper] base clientes não detectada — defina VILAREAL_DRIVE_CLIENTES_BASE',
  );
});
