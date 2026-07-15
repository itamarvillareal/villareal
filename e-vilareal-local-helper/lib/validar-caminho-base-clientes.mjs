import fs from 'node:fs';

/** Valida pasta base `clientes/01 - Ativos` (ou equivalente). */
export function validarCaminhoBaseClientes(caminho) {
  const normalizado = String(caminho ?? '').trim();
  if (!normalizado) {
    return { ok: false, erro: 'Informe o caminho da pasta.' };
  }
  try {
    const stat = fs.statSync(normalizado);
    if (!stat.isDirectory()) {
      return { ok: false, erro: 'O caminho informado não é uma pasta.' };
    }
  } catch {
    return { ok: false, erro: 'Pasta não encontrada. Verifique o caminho e tente novamente.' };
  }
  return { ok: true, caminho: normalizado };
}
