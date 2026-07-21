import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  detectarBaseClientesDrive,
  formatarNomePastaCliente,
  formatarNomePastaProcesso,
  resolverPastaClienteDrive,
  sanitizarNomePasta,
} from './resolver-pasta-cliente-drive.mjs';

test('sanitizarNomePasta remove caracteres inválidos', () => {
  assert.equal(sanitizarNomePasta('A/B:C*D'), 'A B C D');
  assert.equal(sanitizarNomePasta(''), 'Sem Cliente');
});

test('formatarNomePastaCliente usa código com 8 dígitos', () => {
  assert.equal(formatarNomePastaCliente('600', 'Mega Elite'), '00000600 - Mega Elite');
});

test('formatarNomePastaProcesso', () => {
  assert.equal(formatarNomePastaProcesso(1), 'Proc. 01');
  assert.equal(formatarNomePastaProcesso(12), 'Proc. 12');
});

test('resolverPastaClienteDrive encontra pasta por prefixo do código', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilareal-drive-'));
  const clienteDir = path.join(tmp, '00000600 - Mega Elite LTDA');
  fs.mkdirSync(clienteDir);
  const caminho = resolverPastaClienteDrive({
    baseDir: tmp,
    codigoCliente: '600',
    nomeCliente: 'Outro Nome',
  });
  assert.equal(caminho, clienteDir);
});

test('resolverPastaClienteDrive abre subpasta Proc. quando existir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilareal-drive-'));
  const clienteDir = path.join(tmp, '00000600 - Cliente Teste');
  const procDir = path.join(clienteDir, 'Proc. 03');
  fs.mkdirSync(procDir, { recursive: true });
  const caminho = resolverPastaClienteDrive({
    baseDir: tmp,
    codigoCliente: '600',
    numeroInterno: 3,
  });
  assert.equal(caminho, procDir);
});

test('detectarBaseClientesDrive respeita VILAREAL_DRIVE_CLIENTES_BASE', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilareal-base-'));
  const prev = process.env.VILAREAL_DRIVE_CLIENTES_BASE;
  process.env.VILAREAL_DRIVE_CLIENTES_BASE = tmp;
  try {
    assert.equal(detectarBaseClientesDrive(), tmp);
  } finally {
    if (prev == null) delete process.env.VILAREAL_DRIVE_CLIENTES_BASE;
    else process.env.VILAREAL_DRIVE_CLIENTES_BASE = prev;
  }
});
