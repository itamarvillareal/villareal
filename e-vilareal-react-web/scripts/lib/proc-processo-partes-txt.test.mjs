import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  isNomeArquivoPessoaCliente151,
  POLO_PROCESSO_PARTE_CLIENTE,
  POLO_PROCESSO_PARTE_OPOSTA,
  poloApiDesdeSlotVba,
  TXT_PESSOA_CLIENTE_CADASTRO,
} from './legado-pessoa-cliente-vs-partes-processo.mjs';
import {
  lerPartesProcessoTxtDir,
  parsePessoaIdLegadoTxt,
  parteTxtParaApiBody,
} from './proc-processo-partes-txt.mjs';

function testParsePessoaId() {
  assert.equal(parsePessoaIdLegadoTxt('1637'), 1637);
  assert.equal(parsePessoaIdLegadoTxt(' 1591 '), 1591);
  assert.equal(parsePessoaIdLegadoTxt(''), null);
}

function testNaoConfundir151Com90() {
  assert.equal(isNomeArquivoPessoaCliente151('00000257.151.1.0.txt'), true);
  assert.equal(isNomeArquivoPessoaCliente151('00000257.90.37.01.txt'), false);
  assert.equal(TXT_PESSOA_CLIENTE_CADASTRO, '151.1.0');
}

function testLerPartesDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'partes-txt-'));
  const dir = path.join(tmp, '257');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '00000257.90.37.01.txt'), '1637\n');
  fs.writeFileSync(path.join(dir, '00000257.95.37.01.txt'), '1591\n');
  fs.writeFileSync(path.join(dir, '00000257.95.37.02.txt'), '3904\n');
  fs.writeFileSync(path.join(dir, '00000257.91.37.01.txt'), '1\n');
  fs.writeFileSync(path.join(dir, '00000257.151.1.0.txt'), '9999\n');

  const partes = lerPartesProcessoTxtDir(dir, '00000257', 37);
  assert.equal(partes.length, 3);

  const autor = partes.find((p) => p.ladoVba === POLO_PROCESSO_PARTE_CLIENTE && p.ordem === 1);
  assert.equal(autor?.pessoaId, 1637);

  const reus = partes
    .filter((p) => p.ladoVba === POLO_PROCESSO_PARTE_OPOSTA)
    .sort((a, b) => a.ordem - b.ordem);
  assert.equal(reus.length, 2);
  assert.equal(reus[0].pessoaId, 1591);
  assert.equal(reus[1].pessoaId, 3904);

  const body = parteTxtParaApiBody(autor);
  assert.equal(body.polo, POLO_PROCESSO_PARTE_CLIENTE);
  assert.equal(body.pessoaId, 1637);

  const bodyRequerido = parteTxtParaApiBody(autor, 'REQUERIDO');
  assert.equal(bodyRequerido.polo, POLO_PROCESSO_PARTE_OPOSTA);
  assert.equal(poloApiDesdeSlotVba(POLO_PROCESSO_PARTE_CLIENTE, 'REQUERIDO'), 'REU');
  assert.equal(poloApiDesdeSlotVba(POLO_PROCESSO_PARTE_OPOSTA, 'REQUERIDO'), 'AUTOR');
}

function main() {
  testParsePessoaId();
  testNaoConfundir151Com90();
  testLerPartesDir();
  console.log('proc-processo-partes-txt.test.mjs: ok');
}

main();
