#!/usr/bin/env node
/**
 * Importa conteúdo dos .txt em Dropbox «Banco de Dados/Tópicos» para SQL (tabela `topico`).
 *
 * Uso:
 *   node scripts/import-topicos-conteudo.mjs
 *   node scripts/import-topicos-conteudo.mjs --base="~/Dropbox/Banco de Dados/Tópicos"
 *   node scripts/import-topicos-conteudo.mjs --saida=~/Downloads/import_topicos_conteudo.sql
 *
 * Depois:
 *   docker exec -i vilareal-db mysql -uroot -proot vilareal < ~/Downloads/import_topicos_conteudo.sql
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';

const SEPARADOR_BLOCO = '8*&*@&#(*@&93837942';
const TAG_FORMATACAO = /\("([^"]+)"\)/gi;

function parseArgs(argv) {
  const home = os.homedir();
  const out = {
    base: path.join(resolverBaseBancoDados(), 'Tópicos'),
    saida: path.join(home, 'Downloads', 'import_topicos_conteudo.sql'),
  };
  for (const a of argv) {
    if (a.startsWith('--base=')) out.base = a.slice(7).replace(/^~/, home);
    else if (a.startsWith('--saida=')) out.saida = a.slice(8).replace(/^~/, home);
  }
  return out;
}

function normalizarLabel(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncar(s, max) {
  const t = String(s ?? '');
  return t.length <= max ? t : t.slice(0, max);
}

function parseMetadados(nomeArquivo) {
  let stem = String(nomeArquivo ?? '').trim();
  if (stem.toLowerCase().endsWith('.txt')) stem = stem.slice(0, -4);
  const partes = stem.split('=').map(normalizarLabel).filter(Boolean);
  if (partes.length < 2) {
    throw new Error(`Nome inválido (mínimo 2 segmentos): ${nomeArquivo}`);
  }
  const categoria = truncar(partes[0], 200);
  const nome = truncar(partes[partes.length - 1], 300);
  const subcategoria =
    partes.length > 2 ? truncar(partes.slice(1, -1).join(' › '), 200) : null;
  return {
    categoria,
    subcategoria,
    nome,
    chaveNavegacao: truncar(stem, 500),
  };
}

function pareceMojibake(s) {
  return /Ã|â€/.test(s);
}

function utf8Valido(buffer) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function decodificarConteudo(buffer) {
  const utf8 = buffer.toString('utf8');
  if (pareceMojibake(utf8) || !utf8Valido(buffer)) {
    return new TextDecoder('windows-1252').decode(buffer);
  }
  return utf8;
}

function detectarTipoFormatacao(bloco) {
  TAG_FORMATACAO.lastIndex = 0;
  const m = TAG_FORMATACAO.exec(bloco);
  if (!m) return null;
  const tag = m[1].replace(/[\r\n]+/g, ' ').trim().toUpperCase().replace(/\s+/g, ' ');
  if ((tag.includes('TÍTULO') || tag.includes('TITULO')) && (tag.includes('CLAUSULA') || tag.includes('CLÁUSULA'))) {
    return 'TITULO_CLAUSULA';
  }
  if (tag.includes('CABECALHO') || tag.includes('CABEÇALHO')) return 'CABECALHO';
  if (tag.includes('CLAUSULA') || tag.includes('CLÁUSULA')) return 'CLAUSULA';
  if (tag.includes('TITULO') || tag.includes('TÍTULO')) return 'TITULO';
  return null;
}

function parseBlocos(conteudoBruto) {
  const conteudo = String(conteudoBruto ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!conteudo.trim()) return [];
  const partes = conteudo.split(SEPARADOR_BLOCO);
  const out = [];
  let idx = 0;
  for (const parte of partes) {
    const bloco = parte.trim();
    if (!bloco) continue;
    out.push({ blocoIndice: idx, conteudo: bloco, tipoFormatacao: detectarTipoFormatacao(bloco) });
    idx += 1;
  }
  if (!out.length && conteudo.trim()) {
    out.push({ blocoIndice: 0, conteudo: conteudo.trim(), tipoFormatacao: detectarTipoFormatacao(conteudo) });
  }
  return out;
}

function sqlEscape(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''");
}

function sqlNullable(s) {
  if (s == null || s === '') return 'NULL';
  return `'${sqlEscape(s)}'`;
}

function gerarInsert(meta, bloco) {
  return (
    'INSERT INTO topico (categoria, subcategoria, nome, chave_navegacao, bloco_indice, conteudo_template, tipo_formatacao, ordem, ativo) VALUES (' +
    `'${sqlEscape(meta.categoria)}', ` +
    `${sqlNullable(meta.subcategoria)}, ` +
    `'${sqlEscape(meta.nome)}', ` +
    `'${sqlEscape(meta.chaveNavegacao)}', ` +
    `${bloco.blocoIndice}, ` +
    `'${sqlEscape(bloco.conteudo)}', ` +
    `${sqlNullable(bloco.tipoFormatacao)}, ` +
    `${bloco.blocoIndice}, ` +
    `TRUE) ON DUPLICATE KEY UPDATE conteudo_template = VALUES(conteudo_template), tipo_formatacao = VALUES(tipo_formatacao), ordem = VALUES(ordem), ativo = TRUE;`
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.base)) {
    console.error(`Pasta não encontrada: ${args.base}`);
    process.exit(1);
  }

  const arquivos = fs.readdirSync(args.base).filter((n) => n.toLowerCase().endsWith('.txt')).sort();
  const inserts = [];
  const categorias = new Set();
  const erros = [];
  let totalBlocos = 0;

  for (const nome of arquivos) {
    const full = path.join(args.base, nome);
    try {
      const buffer = fs.readFileSync(full);
      const meta = parseMetadados(nome);
      const conteudo = decodificarConteudo(buffer);
      const blocos = parseBlocos(conteudo);
      if (!blocos.length) {
        erros.push(`${nome}: conteúdo vazio`);
        continue;
      }
      categorias.add(meta.categoria);
      for (const bloco of blocos) {
        inserts.push(gerarInsert(meta, bloco));
        totalBlocos += 1;
      }
    } catch (e) {
      erros.push(`${nome}: ${e.message}`);
    }
  }

  const header = `-- Importação de tópicos — gerado em ${new Date().toISOString()}
-- Fonte: ${args.base}
-- Arquivos: ${arquivos.length} | Blocos: ${totalBlocos} | Erros: ${erros.length}

SET NAMES utf8mb4;

-- Idempotente: adiciona coluna/constraint se ainda não existirem (Flyway V70 também cobre)
SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'topico' AND COLUMN_NAME = 'bloco_indice'
);
SET @sql_col := IF(
  @col_exists = 0,
  'ALTER TABLE topico ADD COLUMN bloco_indice INT NOT NULL DEFAULT 0 AFTER chave_navegacao',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

SET @uk_old := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'topico' AND INDEX_NAME = 'uk_topico_chave_navegacao'
);
SET @sql_drop_old := IF(
  @uk_old > 0,
  'ALTER TABLE topico DROP INDEX uk_topico_chave_navegacao',
  'SELECT 1'
);
PREPARE stmt_drop FROM @sql_drop_old;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;

SET @uk_new := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'topico' AND INDEX_NAME = 'uk_topico_chave_bloco'
);
SET @sql_uk := IF(
  @uk_new = 0,
  'ALTER TABLE topico ADD UNIQUE KEY uk_topico_chave_bloco (chave_navegacao(400), bloco_indice)',
  'SELECT 1'
);
PREPARE stmt_uk FROM @sql_uk;
EXECUTE stmt_uk;
DEALLOCATE PREPARE stmt_uk;

`;

  fs.mkdirSync(path.dirname(args.saida), { recursive: true });
  fs.writeFileSync(args.saida, header + inserts.join('\n\n') + '\n', 'utf8');

  console.log('Importação de tópicos — resumo');
  console.log(`  Pasta:              ${args.base}`);
  console.log(`  SQL gerado:         ${args.saida}`);
  console.log(`  Arquivos lidos:     ${arquivos.length}`);
  console.log(`  Arquivos com erro:  ${erros.length}`);
  console.log(`  Blocos (INSERTs):   ${totalBlocos}`);
  console.log(`  Categorias:         ${categorias.size}`);
  for (const c of [...categorias].sort()) {
    console.log(`    - ${c}`);
  }
  if (erros.length) {
    console.log('\nErros:');
    for (const e of erros.slice(0, 20)) console.log(`  ${e}`);
    if (erros.length > 20) console.log(`  … e mais ${erros.length - 20}`);
  }
}

main();
