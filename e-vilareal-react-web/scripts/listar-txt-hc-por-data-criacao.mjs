#!/usr/bin/env node
/**
 * Varre a pasta HC (e subpastas), lista ficheiros .txt criados num dia e grava o conteúdo.
 *
 * Uso:
 *   node scripts/listar-txt-hc-por-data-criacao.mjs --data 25/05/2022
 *   node scripts/listar-txt-hc-por-data-criacao.mjs --data 2022-05-25 --pasta "/Users/itamar/Dropbox/Banco de Dados/HC"
 *   node scripts/listar-txt-hc-por-data-criacao.mjs --data 25/05/2022 --somente-lista
 *   node scripts/listar-txt-hc-por-data-criacao.mjs --data 25/05/2022 --usar-mtime
 *
 * Windows (Dropbox):
 *   node scripts/listar-txt-hc-por-data-criacao.mjs --data 25/05/2022 --pasta "C:\\Users\\itamar\\Dropbox\\Banco de Dados\\HC"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function pastaHcPadrao() {
  if (process.platform === 'win32') {
    return 'C:\\Users\\itamar\\Dropbox\\Banco de Dados\\HC';
  }
  return '/Users/itamar/Dropbox/Banco de Dados/HC';
}

/**
 * @param {string} raw — DD/MM/AAAA ou AAAA-MM-DD
 */
export function parseDataArg(raw) {
  const s = String(raw ?? '').trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return { dia: Number(m[1]), mes: Number(m[2]), ano: Number(m[3]) };
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return { dia: Number(m[3]), mes: Number(m[2]), ano: Number(m[1]) };
  throw new Error(`Data inválida (use DD/MM/AAAA ou AAAA-MM-DD): ${s}`);
}

/**
 * @param {{ dia: number, mes: number, ano: number }} parts
 */
export function intervaloDiaLocal(parts) {
  const inicio = new Date(parts.ano, parts.mes - 1, parts.dia, 0, 0, 0, 0);
  const fim = new Date(parts.ano, parts.mes - 1, parts.dia + 1, 0, 0, 0, 0);
  return { inicio, fim };
}

/**
 * @param {fs.Stats} st
 * @param {Date} inicio
 * @param {Date} fim
 * @param {boolean} usarMtime
 */
export function arquivoCriadoNoDia(st, inicio, fim, usarMtime = false) {
  const ms = usarMtime
    ? st.mtimeMs
    : Number.isFinite(st.birthtimeMs)
      ? st.birthtimeMs
      : st.birthtime.getTime();
  return ms >= inicio.getTime() && ms < fim.getTime();
}

function formatarDataHora(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * @param {string} raiz
 * @param {Date} inicio
 * @param {Date} fim
 * @param {boolean} usarMtime
 * @param {(info: { abs: string, rel: string, st: fs.Stats }) => void} onMatch
 */
export function varrerTxtCriadosNoDia(raiz, inicio, fim, usarMtime, onMatch) {
  const raizNorm = path.resolve(raiz);

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;
      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!arquivoCriadoNoDia(st, inicio, fim, usarMtime)) continue;
      const rel = path.relative(raizNorm, abs).split(path.sep).join('/');
      onMatch({ abs, rel, st });
    }
  }

  if (!fs.existsSync(raizNorm)) {
    throw new Error(`Pasta não encontrada: ${raizNorm}`);
  }
  walk(raizNorm);
}

function parseArgv(argv) {
  let pasta = pastaHcPadrao();
  let data = '25/05/2022';
  let saida = '';
  let somenteLista = false;
  let usarMtime = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pasta' && argv[i + 1]) {
      pasta = argv[++i];
    } else if (a === '--data' && argv[i + 1]) {
      data = argv[++i];
    } else if (a === '--saida' && argv[i + 1]) {
      saida = argv[++i];
    } else if (a === '--somente-lista') {
      somenteLista = true;
    } else if (a === '--usar-mtime') {
      usarMtime = true;
    } else if (a === '--help' || a === '-h') {
      console.log(`Uso: node scripts/listar-txt-hc-por-data-criacao.mjs [opções]

  --data DD/MM/AAAA   Dia de criação (padrão: 25/05/2022)
  --pasta PATH        Raiz HC (padrão: Dropbox …/Banco de Dados/HC)
  --saida PATH        Ficheiro de saída (padrão: tmp/listagem-txt-hc-AAAA-MM-DD.txt)
  --somente-lista     Só caminhos e metadados, sem conteúdo
  --usar-mtime        Usar data de modificação em vez de criação
`);
      process.exit(0);
    } else if (a.startsWith('-')) {
      throw new Error(`Opção desconhecida: ${a}`);
    }
  }

  const parts = parseDataArg(data);
  if (!saida) {
    const tag = `${parts.ano}-${String(parts.mes).padStart(2, '0')}-${String(parts.dia).padStart(2, '0')}`;
    saida = path.join(__dirname, '..', 'tmp', `listagem-txt-hc-${tag}.txt`);
  }

  return { pasta, parts, saida, somenteLista, usarMtime };
}

function main() {
  const opts = parseArgv(process.argv.slice(2));
  const { inicio, fim } = intervaloDiaLocal(opts.parts);
  const pasta = path.resolve(opts.pasta);
  const saida = path.resolve(opts.saida);

  fs.mkdirSync(path.dirname(saida), { recursive: true });
  const out = fs.createWriteStream(saida, { encoding: 'utf8' });

  const dataLabel = `${String(opts.parts.dia).padStart(2, '0')}/${String(opts.parts.mes).padStart(2, '0')}/${opts.parts.ano}`;
  const campoData = opts.usarMtime ? 'modificação' : 'criação';

  out.write(
    [
      '# Listagem de ficheiros .txt — pasta HC',
      `# Pasta: ${pasta}`,
      `# Data de ${campoData}: ${dataLabel} (intervalo local 00:00–24:00)`,
      `# Gerado em: ${new Date().toISOString()}`,
      `# Modo: ${opts.somenteLista ? 'somente listagem' : 'listagem + conteúdo'}`,
      '',
    ].join('\n')
  );

  let total = 0;
  let bytesTotal = 0;
  const t0 = Date.now();

  varrerTxtCriadosNoDia(pasta, inicio, fim, opts.usarMtime, ({ abs, rel, st }) => {
    total += 1;
    bytesTotal += st.size;
    const criado = opts.usarMtime ? st.mtime : st.birthtime;

    out.write('\n');
    out.write(`${'='.repeat(80)}\n`);
    out.write(`# ${total} — ${rel}\n`);
    out.write(`# Caminho absoluto: ${abs}\n`);
    out.write(`# Tamanho: ${st.size} bytes\n`);
    out.write(`# Criação (birth): ${formatarDataHora(st.birthtime)}\n`);
    out.write(`# Modificação (mtime): ${formatarDataHora(st.mtime)}\n`);
    out.write(`# Critério (${campoData}): ${formatarDataHora(criado)}\n`);
    out.write(`${'─'.repeat(80)}\n`);

    if (!opts.somenteLista) {
      try {
        const conteudo = fs.readFileSync(abs, 'utf8');
        out.write(conteudo);
        if (!conteudo.endsWith('\n')) out.write('\n');
      } catch (e) {
        out.write(`[ERRO ao ler conteúdo: ${e?.message || e}]\n`);
      }
    }

    if (total % 5000 === 0) {
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.error(`… ${total} ficheiros (${sec}s)`);
    }
  });

  out.write('\n');
  out.write(`${'='.repeat(80)}\n`);
  out.write('# RESUMO\n');
  out.write(`# Total de ficheiros .txt: ${total}\n`);
  out.write(`# Soma dos tamanhos: ${bytesTotal} bytes\n`);
  out.write(`# Ficheiro de saída: ${saida}\n`);
  out.end();

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Concluído: ${total} ficheiro(s) .txt com ${campoData} em ${dataLabel}`);
  console.log(`Saída: ${saida}`);
  console.log(`Tempo: ${sec}s`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    main();
  } catch (e) {
    console.error(e?.message || e);
    process.exit(1);
  }
}
