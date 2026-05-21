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
  let log = '';
  let usarMtime = false;
  let aplicar = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pasta' && argv[i + 1]) pasta = argv[++i];
    else if (a === '--data' && argv[i + 1]) data = argv[++i];
    else if (a === '--log' && argv[i + 1]) log = argv[++i];
    else if (a === '--usar-mtime') usarMtime = true;
    else if (a === '--aplicar') aplicar = true;
    else if (a === '--dry-run') aplicar = false;
  }

  const parts = parseDataArg(data);
  if (!log) {
    const tag = `${parts.ano}-${String(parts.mes).padStart(2, '0')}-${String(parts.dia).padStart(2, '0')}`;
    log = path.join(__dirname, '..', 'tmp', `eliminados-txt-hc-duplicados-${tag}.txt`);
  }

  return { pasta, parts, log: path.resolve(log), usarMtime, aplicar };
}

function main() {
  const opts = parseArgv(process.argv.slice(2));
  const { inicio, fim } = intervaloDiaLocal(opts.parts);
  const porConteudo = new Map();
  let total = 0;
  let errosLeitura = 0;
  const t0 = Date.now();

  varrerTxtCriadosNoDia(opts.pasta, inicio, fim, opts.usarMtime, ({ abs }) => {
    total++;
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      errosLeitura++;
      return;
    }
    const chave = buf.toString('base64');
    let paths = porConteudo.get(chave);
    if (!paths) {
      paths = [];
      porConteudo.set(chave, paths);
    }
    paths.push(abs);
    if (total % 50000 === 0) {
      process.stderr.write(`… ${total} lidos (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    }
  });

  const aEliminar = [];
  const aManter = [];

  for (const paths of porConteudo.values()) {
    paths.sort((a, b) => a.localeCompare(b));
    aManter.push(paths[0]);
    for (let i = 1; i < paths.length; i++) aEliminar.push(paths[i]);
  }

  fs.mkdirSync(path.dirname(opts.log), { recursive: true });
  const cabecalho = [
    `# ${opts.aplicar ? 'Eliminados' : 'Simulação — a eliminar'} — .txt HC duplicados por conteúdo`,
    `# Pasta: ${path.resolve(opts.pasta)}`,
    `# Data criação: ${opts.parts.dia}/${opts.parts.mes}/${opts.parts.ano}`,
    `# Gerado: ${new Date().toISOString()}`,
    `# Modo: ${opts.aplicar ? 'APLICAR' : 'dry-run'}`,
    `# Total lidos: ${total}`,
    `# A manter: ${aManter.length}`,
    `# A eliminar: ${aEliminar.length}`,
    '',
  ];

  let eliminados = 0;
  let errosDelete = 0;
  const linhasLog = [...cabecalho];

  for (const abs of aEliminar) {
    if (opts.aplicar) {
      try {
        fs.unlinkSync(abs);
        eliminados++;
      } catch {
        errosDelete++;
        linhasLog.push(`ERRO\t${abs}`);
        continue;
      }
    }
    linhasLog.push(abs);
  }

  fs.writeFileSync(opts.log, linhasLog.join('\n'), 'utf8');

  console.log(`Modo: ${opts.aplicar ? 'APLICAR (eliminados)' : 'dry-run (simulação)'}`);
  console.log(`Total lidos: ${total}`);
  console.log(`Erros leitura: ${errosLeitura}`);
  console.log(`Conteúdos distintos: ${porConteudo.size}`);
  console.log(`A manter (1 por conteúdo): ${aManter.length}`);
  console.log(`A eliminar (cópias redundantes): ${aEliminar.length}`);
  if (opts.aplicar) {
    console.log(`Eliminados com sucesso: ${eliminados}`);
    console.log(`Erros ao eliminar: ${errosDelete}`);
  }
  console.log(`Log: ${opts.log}`);
  console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (!opts.aplicar) {
    console.log('\nPara eliminar de verdade: node scripts/eliminar-txt-hc-conteudo-duplicado.mjs --data 25/05/2022 --aplicar');
  }
}

main();
