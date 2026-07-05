/** Converte data do extrato (ISO ou DD/MM/AAAA) para YYYY-MM-DD. */
export function dataLancamentoParaIso(raw) {
  const s = String(raw ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return iso[0];
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

/** Valor absoluto formatado para a API de pesquisa (ex.: 10028,20). */
export function valorAbsolutoParaPesquisaApi(valor) {
  const n = Math.abs(Number(valor ?? 0));
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toFixed(2).replace('.', ',');
}

export function naturezaOposta(natureza) {
  return String(natureza ?? '').toUpperCase() === 'DEBITO' ? 'CREDITO' : 'DEBITO';
}

export function pontuacaoCandidatoPareamento(candidato, lancamentoAtual) {
  if (Number(candidato?.id) === Number(lancamentoAtual?.id)) return -999;
  let score = 0;
  if (String(candidato?.natureza ?? '').toUpperCase() === naturezaOposta(lancamentoAtual?.natureza)) {
    score += 10;
  }
  if (String(candidato?.contaCodigo ?? '').trim().toUpperCase() === 'E') score += 5;
  return score;
}

/** Exclui o lançamento atual e prioriza contrapartida E com natureza oposta. */
export function filtrarCandidatosPareamento(candidatos, lancamentoAtual) {
  return (candidatos ?? [])
    .filter((c) => Number(c?.id) !== Number(lancamentoAtual?.id))
    .sort(
      (a, b) =>
        pontuacaoCandidatoPareamento(b, lancamentoAtual) -
        pontuacaoCandidatoPareamento(a, lancamentoAtual),
    );
}
