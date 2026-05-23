#!/usr/bin/env node
/**
 * Importa imóveis: export Administração Itamar (.xls) ou .xlsx canónico → API Java.
 * .xls legado: converte com map_administracao_imoveis_to_imoveis_xlsx.py (xlrd) antes do POST.
 *
 * Uso:
 *   node scripts/import-imoveis-planilha.mjs [caminho-planilha]
 *   node scripts/import-imoveis-planilha.mjs --path="$HOME/Dropbox/sistema/....xls"
 *
 * Variáveis: VILAREAL_API_BASE / VILAREAL_API_BASE_URL, VILAREAL_IMPORT_LOGIN, VILAREAL_IMPORT_SENHA
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './lib/load-vilareal-import-env.mjs';
import { loginImportApi } from './lib/prazo-fatal-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const BACKEND_SCRIPTS = path.join(REPO_ROOT, 'e-vilareal-java-backend/scripts');
const MAP_SCRIPT = path.join(BACKEND_SCRIPTS, 'map_administracao_imoveis_to_imoveis_xlsx.py');

const PLANILHA_PADRAO =
  process.env.VILAREAL_IMPORT_IMOVEIS_PLANILHA_PATH ||
  path.join(os.homedir(), 'Dropbox/sistema/Villa Real - Administração de Imóveis - Itamar.xls');

function parseArgs(argv) {
  let planilha = PLANILHA_PADRAO;
  let baseUrl = process.env.VILAREAL_API_BASE_URL || process.env.VILAREAL_API_BASE || 'http://localhost:8080';
  for (const a of argv) {
    if (a.startsWith('--path=')) planilha = a.slice(7);
    else if (a.startsWith('--base-url=')) baseUrl = a.slice(11);
    else if (!a.startsWith('-')) planilha = a;
  }
  return { planilha: path.resolve(planilha), baseUrl: baseUrl.replace(/\/$/, '') };
}

function converterXlsAdministracao(entrada) {
  if (!fs.existsSync(MAP_SCRIPT)) {
    throw new Error(`Script não encontrado: ${MAP_SCRIPT}`);
  }
  const saida = path.join(os.tmpdir(), `vilareal-import-imoveis-${process.pid}.xlsx`);
  const r = spawnSync('python3', [MAP_SCRIPT, entrada, saida], { encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.status !== 0) {
    throw new Error(`Conversão Python falhou (exit ${r.status}): ${out.slice(0, 500)}`);
  }
  if (!fs.existsSync(saida)) {
    throw new Error(`Conversão não gerou ficheiro: ${saida}`);
  }
  return { saida, out, temporario: true };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const login = process.env.VILAREAL_IMPORT_LOGIN || 'itamar';
  const senha = process.env.VILAREAL_IMPORT_SENHA || '';
  if (!senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA (ou ~/.vilareal-import-env).');
    process.exit(1);
  }
  if (!fs.existsSync(opts.planilha)) {
    console.error(`Planilha não encontrada: ${opts.planilha}`);
    process.exit(1);
  }

  let importPath = opts.planilha;
  let tempXlsx = null;
  const ext = path.extname(opts.planilha).toLowerCase();
  if (ext === '.xls') {
    console.log('[imóveis] Convertendo .xls legado → .xlsx canónico…');
    const conv = converterXlsAdministracao(opts.planilha);
    importPath = conv.saida;
    tempXlsx = conv.saida;
    console.log(`[imóveis] ${conv.out}`);
  }

  const token = await loginImportApi(opts.baseUrl, login, senha);
  const url = `${opts.baseUrl}/api/import/imoveis-planilha?path=${encodeURIComponent(importPath)}`;
  console.log(`[imóveis] POST ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (tempXlsx) {
    try {
      fs.unlinkSync(tempXlsx);
    } catch {
      /* ignore */
    }
  }
  if (!res.ok) {
    console.error(`Import falhou ${res.status}: ${text.slice(0, 800)}`);
    process.exit(1);
  }
  const json = JSON.parse(text);
  console.log(
    `[imóveis] OK=${json.linhasProcessadasComSucesso} erros=${json.linhasComErro} ignoradas=${json.linhasIgnoradas}`,
  );
  console.log(json.arquivo || opts.planilha);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
