/**
 * Helpers de exibição para vínculo publicação ↔ processo.
 * Prioriza titular real (`titularNome` / `cliente`) e desambigua com `processo.id`.
 */

function str(v) {
  return String(v ?? '').trim();
}

/** Nome do titular do processo vinculado (não confundir com parte autora em `processo_parte`). */
export function obterTitularNomeLinha(row) {
  return str(row?.titularNome ?? row?.cliente ?? row?.parteCliente);
}

/** Parte(s) oposta(s) agregada(s) do processo vinculado. */
export function obterParteOpostaLinha(row) {
  return str(row?.reu ?? row?.parteOposta);
}

/**
 * Chave curta: código do titular + id do processo (+ nº interno quando existir).
 * Ex.: `00000600 / id 8536 (nº 192)`
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
  const titular = obterTitularNomeLinha(row);
  const oposta = obterParteOpostaLinha(row);
  const partesNomes =
    titular && oposta ? `${titular} × ${oposta}` : titular || oposta || '—';
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
