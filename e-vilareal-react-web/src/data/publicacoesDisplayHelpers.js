/**
 * Helpers de exibição para vínculo publicação ↔ processo.
 * Partes na grade: `parteCliente` × `parteOposta` (não o nome do cliente contratante).
 */

function str(v) {
  return String(v ?? '').trim();
}

/** Nome do titular/sujeito do processo (`processo.pessoa_id`). */
export function obterTitularNomeLinha(row) {
  return str(row?.titularNome ?? row?.parteCliente);
}

/** Nome agregado da parte do lado do escritório (polo autor/requerente em `processo_parte`). */
export function obterParteClienteNomeLinha(row) {
  return str(row?.parteCliente);
}

/** Parte(s) oposta(s) agregada(s) do processo vinculado. */
export function obterParteOpostaLinha(row) {
  return str(row?.reu ?? row?.parteOposta);
}

/**
 * Chave curta: código do cliente contratante + id do processo (+ nº interno quando existir).
 * Ex.: `00000703 / id 8536 (nº 2)`
 */
export function formatarChaveProcessoVinculo(row) {
  const cod = str(row?.codCliente);
  const pid = row?._processoId ?? row?.processoId;
  const procId = pid != null && Number(pid) > 0 ? String(Math.floor(Number(pid))) : '';
  const procInt = str(row?.procInterno);
  if (!cod && !procId) return '—';
  const partes = [];
  if (cod) partes.push(cod);
  if (procId) partes.push(`id ${procId}`);
  let chave = partes.join(' / ');
  if (procInt) chave += ` (nº ${procInt})`;
  return chave;
}

/**
 * Rótulo principal do vínculo: chave desambiguada + titular × parte oposta.
 * Ex.: `00000600 / id 8536 (nº 192) — MEGA ELITE × GLEISMAR`
 */
export function formatarRotuloVinculoPartes(row) {
  const parteCliente = obterParteClienteNomeLinha(row);
  const oposta = obterParteOpostaLinha(row);
  const partesNomes =
    parteCliente && oposta ? `${parteCliente} × ${oposta}` : parteCliente || oposta || '—';
  const temProcesso = row?._processoId != null || row?.processoId != null || str(row?.codCliente);
  if (!temProcesso && row?.statusVinculo !== 'vinculado') {
    return partesNomes;
  }
  const chave = formatarChaveProcessoVinculo(row);
  if (chave === '—') return partesNomes;
  return `${chave} — ${partesNomes}`;
}

/** Uma linha só com a chave (coluna código/proc). */
export function formatarLinhaChaveVinculo(row) {
  return formatarChaveProcessoVinculo(row);
}
