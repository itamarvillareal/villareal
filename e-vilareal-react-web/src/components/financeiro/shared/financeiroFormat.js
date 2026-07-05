/** Valor assinado: crédito +, débito −. */
export function signedValorFromApi(l) {
  const v = Math.abs(Number(l?.valor) || 0);
  const n = String(l?.natureza ?? '').toUpperCase();
  return n === 'DEBITO' ? -v : v;
}

export function somaAssinadaLancamentos(lancamentos) {
  return (lancamentos ?? []).reduce((s, l) => s + signedValorFromApi(l), 0);
}

export function formatMoeda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function formatDataCurta(isoOrBr) {
  const s = String(isoOrBr ?? '').trim();
  let y;
  let mo;
  let d;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    mo = iso[2];
    d = iso[3];
  } else {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!br) return s;
    d = br[1];
    mo = br[2];
    y = Number(br[3]);
  }
  const anoAtual = new Date().getFullYear();
  if (y === anoAtual) return `${d}/${mo}`;
  return `${d}/${mo}/${y}`;
}

/** Sempre DD/MM/AAAA (com ano), para recorrências e confirmações. */
export function formatDataBrCompleta(isoOrBr) {
  const s = String(isoOrBr ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const brCurta = /^(\d{2})\/(\d{2})$/.exec(s);
  if (brCurta) return s;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return s;
}

function parseDataFinanceiraParaDate(isoOrBr) {
  const s = String(isoOrBr ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
    return null;
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]);
    const y = Number(br[3]);
    if (y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
  }
  return null;
}

/** Dia da semana abreviado em pt-BR (ex.: seg, ter, sex). */
export function formatDiaSemanaAbreviado(isoOrBr) {
  const date = parseDataFinanceiraParaDate(isoOrBr);
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(date)
    .replace(/\.$/, '')
    .toLowerCase();
}

/** Dia da semana por extenso em pt-BR (ex.: Segunda-feira). */
export function formatDiaSemanaLongo(isoOrBr) {
  const date = parseDataFinanceiraParaDate(isoOrBr);
  if (!date || Number.isNaN(date.getTime())) return '';
  const raw = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** DD/MM/AAAA + dia da semana (ex.: 27/04/2026 (Segunda-feira)). */
export function formatDataBrCompletaComDiaSemana(isoOrBr) {
  const data = formatDataBrCompleta(isoOrBr);
  const dia = formatDiaSemanaLongo(isoOrBr);
  if (!data) return data;
  return dia ? `${data} (${dia})` : data;
}

export function grupoFechado(soma, tolerancia = 0.01) {
  return Math.abs(Number(soma) || 0) <= tolerancia;
}
