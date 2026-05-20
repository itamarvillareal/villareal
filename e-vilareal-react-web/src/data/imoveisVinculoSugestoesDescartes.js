const STORAGE_KEY = 'vilareal:imoveis-vinculo-sugestoes-descartes';

function lerRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.descartes) ? parsed.descartes : [];
  } catch {
    return [];
  }
}

function gravarRaw(descartes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ descartes, atualizadoEm: new Date().toISOString() }));
}

/** Chave do par Cod.+Proc. (somente dígitos). */
export function chaveParCodProcVinculoImovel(codigoCliente, proc) {
  const cod = String(codigoCliente ?? '').replace(/\D/g, '');
  const p = String(proc ?? '').replace(/\D/g, '');
  return `${cod}|${p}`;
}

/** Chave composta lançamento + par (descarte por vínculo sugerido, não global). */
export function chaveDescarteVinculoImovel(lancamentoId, codigoCliente, proc) {
  return `${Number(lancamentoId)}|${chaveParCodProcVinculoImovel(codigoCliente, proc)}`;
}

/**
 * @returns {Set<string>} chaves `lancamentoId|cod|proc`
 */
export function chavesDescartesVinculoImovel() {
  const out = new Set();
  for (const d of lerRaw()) {
    const id = Number(d.lancamentoId);
    if (!Number.isFinite(id) || id <= 0) continue;
    const par = chaveParCodProcVinculoImovel(d.codigoCliente, d.proc);
    if (par && par !== '|') {
      out.add(`${id}|${par}`);
    } else {
      /** Legado: sem par gravado — oculta o lançamento em qualquer sugestão. */
      out.add(`${id}|*`);
    }
  }
  return out;
}

/** @deprecated use chavesDescartesVinculoImovel — ids globais (legado). */
export function idsLancamentosDescartadosVinculoImovel() {
  const ids = new Set();
  for (const d of lerRaw()) {
    const id = Number(d.lancamentoId);
    if (!Number.isFinite(id) || id <= 0) continue;
    const par = chaveParCodProcVinculoImovel(d.codigoCliente, d.proc);
    if (!par || par === '|') ids.add(id);
  }
  return ids;
}

export function listarDescartesVinculoImovel() {
  return lerRaw().sort((a, b) => String(b.descartadoEm || '').localeCompare(String(a.descartadoEm || '')));
}

export function sugestaoVinculoDescartadaParaPar(sugestao) {
  const id = Number(sugestao?.lancamentoId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const chave = chaveDescarteVinculoImovel(id, sugestao.codigoCliente, sugestao.proc);
  const chaves = chavesDescartesVinculoImovel();
  if (chaves.has(chave)) return true;
  return chaves.has(`${id}|*`);
}

/**
 * Descarte permanente para este lançamento **e** par Cod.+Proc. (outros pares podem voltar a sugerir).
 */
export function descartarSugestaoVinculoImovel(meta) {
  const id = Number(meta.lancamentoId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const par = chaveParCodProcVinculoImovel(meta.codigoCliente, meta.proc);
  const chave = `${id}|${par}`;
  const lista = lerRaw().filter((d) => {
    const k = `${Number(d.lancamentoId)}|${chaveParCodProcVinculoImovel(d.codigoCliente, d.proc)}`;
    return k !== chave;
  });
  lista.push({
    lancamentoId: id,
    descartadoEm: new Date().toISOString(),
    codigoCliente: meta.codigoCliente != null ? String(meta.codigoCliente).replace(/\D/g, '') : '',
    proc: meta.proc != null ? String(meta.proc).replace(/\D/g, '') : '',
    imovelId: meta.imovelId != null ? Number(meta.imovelId) : null,
    data: meta.data != null ? String(meta.data) : '',
    valor: meta.valor != null ? Number(meta.valor) : null,
  });
  gravarRaw(lista);
  return true;
}

/** Remove descarte do par (ou todos os pares do lançamento se cod/proc omitidos). */
export function restaurarSugestaoVinculoImovel(lancamentoId, codigoCliente = null, proc = null) {
  const id = Number(lancamentoId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const antes = lerRaw().length;
  const parAlvo =
    codigoCliente != null && proc != null ? chaveParCodProcVinculoImovel(codigoCliente, proc) : null;
  gravarRaw(
    lerRaw().filter((d) => {
      if (Number(d.lancamentoId) !== id) return true;
      if (!parAlvo) return false;
      return chaveParCodProcVinculoImovel(d.codigoCliente, d.proc) !== parAlvo;
    }),
  );
  return lerRaw().length < antes;
}

export function filtrarSugestoesSemDescartadas(sugestoes) {
  return (sugestoes || []).filter((s) => !sugestaoVinculoDescartadaParaPar(s));
}
