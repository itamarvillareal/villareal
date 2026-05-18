#!/usr/bin/env node
/**
 * Relatório: clientes com dados txt (3.1) que ainda faltam importar via import-real.
 *
 *   node scripts/relatorio-clientes-faltam-importar.mjs
 *   node scripts/relatorio-clientes-faltam-importar.mjs --relatorio=tmp/relatorio-clientes-faltam-importar.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  SEGMENTO_MIL,
} from './lib/historico-local-txt-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, 'tmp');

function parseArgs(argv) {
  const out = {
    base: resolverBaseBancoDados(),
    relatorio: path.join(TMP, 'relatorio-clientes-faltam-importar.json'),
    clienteMin: 1,
    clienteMax: 999,
  };
  for (const a of argv) {
    if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max=')) out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
  }
  return out;
}

/** @param {string} dir */
function listarClientesNaPastaMil(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = new Set();
  for (const cent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!cent.isDirectory()) continue;
    for (const cli of fs.readdirSync(path.join(dir, cent.name), { withFileTypes: true })) {
      if (!cli.isDirectory()) continue;
      const n = Number.parseInt(cli.name, 10);
      if (Number.isFinite(n) && n >= 1) out.add(n);
    }
  }
  return [...out];
}

/** @param {string} base @param {number} codNum */
function contarProcessosCom31(base, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const dir = path.join(base, 'Proc', SEGMENTO_MIL, String(cent), pastaCli);
  if (!fs.existsSync(dir)) return 0;

  const re = new RegExp(`^${cod8}\\.3\\.1\\.(\\d+)\\.txt$`, 'i');
  const procs = new Set();
  for (const f of fs.readdirSync(dir)) {
    const m = re.exec(f);
    if (m) procs.add(Number.parseInt(m[1], 10));
  }
  return procs.size;
}

/**
 * @param {object} j
 * @returns {boolean}
 */
function relatorioImportOk(j) {
  if (!j || j.modo !== 'aplicar') return false;
  if (Array.isArray(j.falhas) && j.falhas.length > 0) return false;
  const p = j.etapas?.processos;
  if (!p || p.fail > 0) return false;
  if (j.etapas?.pessoaCliente === 'falhou') return false;
  const hist = j.etapas?.historico;
  if (hist === 'falhou' || (typeof hist === 'object' && hist.fail > 0)) return false;
  return (p.ok ?? 0) > 0;
}

/**
 * @param {string} nome
 * @returns {{ cliente: number, parcial: boolean, procMin?: number, procMax?: number }}
 */
function parseNomeRelatorio(nome) {
  let m = /^relatorio-import-real-cliente-(\d+)(?:-proc-(\d+)-(\d+))?\.json$/i.exec(nome);
  if (m) {
    return {
      cliente: Number(m[1]),
      parcial: Boolean(m[2]),
      procMin: m[2] ? Number(m[2]) : undefined,
      procMax: m[3] ? Number(m[3]) : undefined,
    };
  }
  m = /^import-real-cliente-(\d+)\.json$/i.exec(nome);
  if (m) return { cliente: Number(m[1]), parcial: false };
  m = /^import-real-(\d+)\.json$/i.exec(nome);
  if (m) return { cliente: Number(m[1]), parcial: false };
  m = /^cliente-(\d+)\.json$/i.exec(nome);
  if (m) return { cliente: Number(m[1]), parcial: false };
  return { cliente: 0, parcial: false };
}

/** @param {string} dir */
function* iterJsonRecursivo(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* iterJsonRecursivo(abs);
    else if (ent.name.endsWith('.json')) yield abs;
  }
}

/** @param {string} dir */
function carregarRelatoriosImport(dir) {
  /** @type {Map<number, { completos: object[], parciais: object[] }>} */
  const porCliente = new Map();

  for (const abs of iterJsonRecursivo(dir)) {
    const nome = path.basename(abs);
    const meta = parseNomeRelatorio(nome);
    if (!meta.cliente) continue;

    let j;
    try {
      j = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch {
      continue;
    }
    if (j.cliente != null && Number(j.cliente) !== meta.cliente) continue;
    if (!relatorioImportOk(j)) continue;

    if (!porCliente.has(meta.cliente)) {
      porCliente.set(meta.cliente, { completos: [], parciais: [] });
    }
    const slot = porCliente.get(meta.cliente);
    const relPath = path.relative(dir, abs);
    const entry = { ...j, _arquivo: relPath, _procMin: meta.procMin, _procMax: meta.procMax };
    if (meta.parcial) slot.parciais.push(entry);
    else slot.completos.push(entry);
  }

  return porCliente;
}

/** @param {string} resumoPath */
function carregarResumo201300(resumoPath) {
  /** @type {Map<number, 'ok' | 'fail'>} */
  const map = new Map();
  if (!fs.existsSync(resumoPath)) return map;
  for (const line of fs.readFileSync(resumoPath, 'utf8').split(/\r?\n/)) {
    const m = /^cliente=(\d+)\s+status=(\w+)/.exec(line.trim());
    if (m) map.set(Number(m[1]), m[2] === 'ok' ? 'ok' : 'fail');
  }
  return map;
}

/**
 * @param {number} totalCom31
 * @param {{ completos: object[], parciais: object[] }} rel
 */
function estimarImportados(totalCom31, rel) {
  if (!rel) return { importados: 0, fonte: null, arquivo: undefined, arquivos: [] };

  let parcial = 0;
  /** @type {string[]} */
  const arquivosParciais = [];
  for (const p of rel.parciais) {
    parcial += p.processosAlvo ?? p.etapas?.processos?.ok ?? 0;
    arquivosParciais.push(p._arquivo);
  }

  // Relatórios por faixa (--processo-min/max) têm prioridade sobre um "completo" antigo.
  if (parcial > 0 && parcial < totalCom31) {
    return {
      importados: Math.min(parcial, totalCom31),
      fonte: 'parcial',
      arquivos: arquivosParciais,
    };
  }

  for (const c of rel.completos) {
    const ok = c.etapas?.processos?.ok ?? 0;
    const alvo = c.processosAlvo ?? ok;
    const com31 = c.processosCom31 ?? totalCom31;
    if (ok >= alvo && alvo >= totalCom31 && com31 >= totalCom31) {
      return { importados: totalCom31, fonte: 'completo', arquivo: c._arquivo, arquivos: [] };
    }
  }

  if (parcial >= totalCom31) {
    return {
      importados: totalCom31,
      fonte: 'parcial',
      arquivos: arquivosParciais,
    };
  }

  for (const c of rel.completos) {
    const ok = c.etapas?.processos?.ok ?? 0;
    if (ok > 0) {
      return {
        importados: Math.min(ok, totalCom31),
        fonte: 'completo_parcial',
        arquivo: c._arquivo,
        arquivos: [],
      };
    }
  }

  return { importados: 0, fonte: null, arquivo: undefined, arquivos: [] };
}

function classificarCliente(cod, totalCom31, importados, resumo201300) {
  if (totalCom31 === 0) {
    if (resumo201300?.get(cod) === 'fail') return 'sem_dados';
    return 'sem_dados';
  }

  if (importados >= totalCom31) return 'completo';
  if (importados > 0) return 'parcial';
  if (resumo201300?.get(cod) === 'ok') return 'completo';
  if (resumo201300?.get(cod) === 'fail') return 'sem_dados';
  return 'pendente';
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const procMil = path.join(opts.base, 'Proc', SEGMENTO_MIL);
  const clientes = listarClientesNaPastaMil(procMil).filter(
    (c) => c >= opts.clienteMin && c <= opts.clienteMax
  );

  const relatorios = carregarRelatoriosImport(TMP);
  const resumo201300 = carregarResumo201300(path.join(TMP, 'import-real-201-300-resumo.txt'));

  /** @type {object[]} */
  const linhas = [];

  for (const cod of clientes) {
    const totalCom31 = contarProcessosCom31(opts.base, cod);
    const rel = relatorios.get(cod);
    const { importados, fonte, arquivo, arquivos } = estimarImportados(totalCom31, rel);
    const status = classificarCliente(cod, totalCom31, importados, resumo201300);
    const faltam = status === 'completo' || status === 'sem_dados' ? 0 : totalCom31 - importados;

    linhas.push({
      cliente: cod,
      status,
      processosCom31: totalCom31,
      processosImportados: importados,
      processosFaltam: faltam,
      fonteImport: fonte,
      relatorios: arquivo ? [arquivo] : arquivos ?? [],
    });
  }

  const comDados = linhas.filter((l) => l.processosCom31 > 0);
  const completos = comDados.filter((l) => l.status === 'completo');
  const parciais = comDados.filter((l) => l.status === 'parcial');
  const pendentes = comDados.filter((l) => l.status === 'pendente');
  const semDados = linhas.filter((l) => l.status === 'sem_dados');

  const relatorio = {
    geradoEm: new Date().toISOString(),
    base: opts.base,
    intervaloClientes: [opts.clienteMin, opts.clienteMax],
    resumo: {
      clientesComPasta: clientes.length,
      comDados31: comDados.length,
      importadosCompletos: completos.length,
      importadosParciais: parciais.length,
      pendentes: pendentes.length,
      semDadosTxt: semDados.length,
      processosCom31Total: comDados.reduce((s, l) => s + l.processosCom31, 0),
      processosFaltamTotal: [...parciais, ...pendentes].reduce((s, l) => s + l.processosFaltam, 0),
      clientesFaltamImportar: parciais.length + pendentes.length,
    },
    clientesCompletos: completos.map((l) => l.cliente).sort((a, b) => a - b),
    clientesFaltamImportar: [...parciais, ...pendentes]
      .map((l) => ({
        cliente: l.cliente,
        status: l.status,
        processosCom31: l.processosCom31,
        processosImportados: l.processosImportados,
        processosFaltam: l.processosFaltam,
      }))
      .sort((a, b) => b.processosFaltam - a.processosFaltam || b.processosCom31 - a.processosCom31),
    clientesParciais: parciais
      .map((l) => ({
        cliente: l.cliente,
        processosCom31: l.processosCom31,
        processosImportados: l.processosImportados,
        processosFaltam: l.processosFaltam,
        relatorios: l.relatorios,
      }))
      .sort((a, b) => b.processosFaltam - a.processosFaltam),
    clientesPendentes: pendentes
      .map((l) => ({
        cliente: l.cliente,
        processosCom31: l.processosCom31,
        processosFaltam: l.processosFaltam,
      }))
      .sort((a, b) => b.processosCom31 - a.processosCom31),
    detalhe: linhas.sort((a, b) => a.cliente - b.cliente),
  };

  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');

  console.log('\n=== Clientes — faltam importar ===\n');
  console.log(`Base: ${opts.base}`);
  console.log(`Com dados (3.1): ${relatorio.resumo.comDados31}`);
  console.log(`  · completos: ${relatorio.resumo.importadosCompletos}`);
  console.log(`  · parciais:  ${relatorio.resumo.importadosParciais}`);
  console.log(`  · pendentes: ${relatorio.resumo.pendentes}`);
  console.log(`Processos ainda por importar: ${relatorio.resumo.processosFaltamTotal}`);
  console.log(`\nRelatório: ${opts.relatorio}\n`);

  if (pendentes.length) {
    console.log('Pendentes (top 20 por volume):');
    for (const p of pendentes.slice(0, 20)) {
      console.log(`  cliente ${p.cliente}: ${p.processosCom31} processo(s)`);
    }
    if (pendentes.length > 20) console.log(`  … +${pendentes.length - 20} cliente(s)`);
    console.log('');
  }

  if (parciais.length) {
    console.log('Parciais (top 15):');
    for (const p of parciais.slice(0, 15)) {
      console.log(
        `  cliente ${p.cliente}: ${p.processosImportados}/${p.processosCom31} importados, faltam ${p.processosFaltam}`
      );
    }
    console.log('');
  }
}

main();
