import assert from 'node:assert/strict';

import { POLO_PROCESSO_PARTE_OPOSTA } from './legado-pessoa-cliente-vs-partes-processo.mjs';
import {
  chaveParteApi,
  chaveParteTxt,
  verificarParteOpostaListagem,
  verificarPartesTxtContraApi,
} from './verificar-partes-processo-pos-import.mjs';

function testVerificarPartesOk() {
  const txt = [
    { ladoVba: 'AUTOR', ordem: 1, pessoaId: 6277, fontes: ['a.txt'] },
    { ladoVba: POLO_PROCESSO_PARTE_OPOSTA, ordem: 1, pessoaId: 7164, fontes: ['b.txt'] },
  ];
  const api = [
    { polo: 'AUTOR', ordem: 1, pessoaId: 6277 },
    { polo: 'REU', ordem: 1, pessoaId: 7164 },
  ];
  assert.equal(chaveParteTxt(txt[0]), chaveParteApi(api[0]));
  const ver = verificarPartesTxtContraApi(txt, api);
  assert.equal(ver.ok, true);
}

function testVerificarPartesFalta() {
  const txt = [{ ladoVba: POLO_PROCESSO_PARTE_OPOSTA, ordem: 1, pessoaId: 7164, fontes: ['b.txt'] }];
  const ver = verificarPartesTxtContraApi(txt, []);
  assert.equal(ver.ok, false);
  assert.equal(ver.faltas.length, 1);
}

function testParteOpostaListagem() {
  const txt = [{ ladoVba: POLO_PROCESSO_PARTE_OPOSTA, ordem: 1, pessoaId: 7164, fontes: [] }];
  const apiPartes = [{ polo: 'REU', ordem: 1, pessoaId: 7164 }];
  assert.equal(verificarParteOpostaListagem(txt, '', apiPartes).ok, true);
  assert.equal(verificarParteOpostaListagem(txt, 'SEU BARBA', []).ok, true);
  assert.equal(verificarParteOpostaListagem(txt, '', []).ok, false);
  assert.equal(verificarParteOpostaListagem([], 'x').ok, true);
}

function main() {
  testVerificarPartesOk();
  testVerificarPartesFalta();
  testParteOpostaListagem();
  console.log('verificar-partes-processo-pos-import.test.mjs: ok');
}

main();
