#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseDataArg,
  intervaloDiaLocal,
  varrerTxtCriadosNoDia,
} from './listar-txt-hc-por-data-criacao.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function pastaHcPadrao() {
  if (process.platform === 'win32') {
    return 'C:\\Users\\itamar\\Dropbox\\Banco de Dados\\HC';
  }
  return '/Users/itamar/Dropbox/Banco de Dados/HC';
}

function parseArgv(argv) {
  let pasta = pastaHcPadrao();
  let data = '25/05/2022';
  let saida = '';
  let usarMtime = false;
  let top = 30;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pasta' && argv[i + 1]) pasta = argv[++i];
    else if (a === '--data' && argv[i + 1]) data = argv[++i];
    else if (a === '--saida' && argv[i + 1]) saida = argv[++i];
    else if (a === '--usar-mtime') usarMtime = true;
    else if (a === '--top' && argv[i + 1]) top = Number(argv[++i]);
  }

  const parts = parseDataArg(data);
  if (!saida) {
    const tag = `${parts.ano}-${String(parts.mes).padStart(2, '0')}-${String(parts.dia).padStart(2, '0')}`;
    saida = path.join(__dirname, '..', 'tmp', `analise-conteudo-duplicado-hc-${tag}.txt`);
  }

  return { pasta, parts, saida: path.resolve(saida), usarMtime, top };
}

function reprConteudo(buf) {
  const s = buf.toString('utf8');
  if (s === '') return '(vazio)';
  if (/^[\x20-\x7E\u00A0-\u024F\n\r\t]*$/.test(s)) return JSON.stringify(s);
  return `<binário ${buf.length} bytes>`;
}

function main() {
  const opts = parseArgv(process.argv.slice(2));
  const { inicio, fim } = intervaloDiaLocal(opts.parts);
  const porConteudo = new Map();
  let total = 0;
  let erros = 0;
  let bytesTotal = 0;
  const t0 = Date.now();

  varrerTxtCriadosNoDia(opts.pasta, inicio, fim, opts.usarMtime, ({ abs }) => {
    total++;
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      erros++;
      return;
    }
    bytesTotal += buf.length;
    const chave = buf.toString('base64');
    let g = porConteudo.get(chave);
    if (!g) {
      g = { buf, count: 0, exemplo: abs };
      porConteudo.set(chave, g);
    }
    g.count++;
    if (total % 50000 === 0) {
      process.stderr.write(`… ${total} ficheiros (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    }
  });

  const grupos = [...porConteudo.values()].sort((a, b) => b.count - a.count);
  const unicos = grupos.length;
  const comDuplicata = grupos.filter((g) => g.count > 1);
  const arquivosEmGruposDuplicados = comDuplicata.reduce((s, g) => s + g.count, 0);
  const arquivosRedundantes = arquivosEmGruposDuplicados - comDuplicata.length;

  const linhas = [
    '# Análise de conteúdo duplicado — ficheiros .txt HC',
    `# Pasta: ${path.resolve(opts.pasta)}`,
    `# Data de criação: ${opts.parts.dia}/${opts.parts.mes}/${opts.parts.ano}`,
    `# Gerado em: ${new Date().toISOString()}`,
    '',
    `Total de ficheiros lidos: ${total}`,
    `Erros de leitura: ${erros}`,
    `Bytes lidos (soma): ${bytesTotal}`,
    `Conteúdos distintos (únicos): ${unicos}`,
    `Grupos com 2+ ficheiros iguais: ${comDuplicata.length}`,
    `Ficheiros que partilham conteúdo com outro(s): ${arquivosEmGruposDuplicados}`,
    `Ficheiros “a mais” (cópias redundantes): ${arquivosRedundantes}`,
    `Ficheiros com conteúdo exclusivo (só 1): ${total - arquivosEmGruposDuplicados}`,
    '',
    `# Top ${opts.top} conteúdos mais repetidos`,
  ];

  for (let i = 0; i < Math.min(opts.top, grupos.length); i++) {
    const g = grupos[i];
    linhas.push(
      '',
      `--- #${i + 1} — ${g.count} ficheiro(s) ---`,
      `Conteúdo: ${reprConteudo(g.buf)}`,
      `Exemplo: ${g.exemplo}`,
    );
  }

  fs.mkdirSync(path.dirname(opts.saida), { recursive: true });
  fs.writeFileSync(opts.saida, linhas.join('\n'), 'utf8');

  console.log(`Total: ${total}`);
  console.log(`Conteúdos distintos: ${unicos}`);
  console.log(`Grupos duplicados (2+ ficheiros): ${comDuplicata.length}`);
  console.log(`Ficheiros com conteúdo repetido: ${arquivosEmGruposDuplicados}`);
  console.log(`Cópias redundantes: ${arquivosRedundantes}`);
  console.log(`Conteúdo exclusivo (1 ficheiro): ${total - arquivosEmGruposDuplicados}`);
  console.log(`Relatório: ${opts.saida}`);
  console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
