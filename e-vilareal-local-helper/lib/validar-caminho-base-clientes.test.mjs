import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validarCaminhoBaseClientes } from './validar-caminho-base-clientes.mjs';

test('validarCaminhoBaseClientes aceita pasta existente', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilareal-base-'));
  const r = validarCaminhoBaseClientes(tmp);
  assert.equal(r.ok, true);
  assert.equal(r.caminho, tmp);
});

test('validarCaminhoBaseClientes rejeita caminho vazio', () => {
  const r = validarCaminhoBaseClientes('');
  assert.equal(r.ok, false);
});
