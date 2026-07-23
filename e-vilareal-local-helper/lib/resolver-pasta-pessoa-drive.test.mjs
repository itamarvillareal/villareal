import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  formatarNomePastaPessoa,
  resolverPastaPessoaDrive,
} from './resolver-pasta-pessoa-drive.mjs';

test('formatarNomePastaPessoa usa id com 8 dígitos', () => {
  assert.equal(formatarNomePastaPessoa(668, 'Empresa LTDA'), '00000668 - Empresa LTDA');
});

test('resolverPastaPessoaDrive encontra pasta por prefixo do id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilareal-pessoas-'));
  const pessoaDir = path.join(tmp, '00004069 - MI Aluguel Eireli');
  fs.mkdirSync(pessoaDir);
  const caminho = resolverPastaPessoaDrive({
    baseDir: tmp,
    pessoaId: 4069,
    nomePessoa: 'Outro Nome',
  });
  assert.equal(caminho, pessoaDir);
});
