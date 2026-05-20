/** @typedef {Record<string, string>} LinhaRelatorioImoveis */

export const FILTROS_RELATORIO_IMOVEIS_INICIAL = {
  busca: '',
  diaRepasse: '',
  diaPagAluguel: '',
  soOcupados: false,
  somenteComVinculo: false,
};

export function diaDoMesAmanha(ref = new Date()) {
  const d = new Date(ref);
  d.setDate(d.getDate() + 1);
  return d.getDate();
}

export function parseDiaCampo(val) {
  const n = Number(String(val ?? '').replace(/\D/g, ''));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
}

/**
 * @param {LinhaRelatorioImoveis} row
 * @param {typeof FILTROS_RELATORIO_IMOVEIS_INICIAL} filtros
 */
export function linhaPassaFiltrosRelatorioImoveis(row, filtros) {
  if (filtros.soOcupados && row.ocupado !== 'Sim') return false;

  if (filtros.somenteComVinculo) {
    const cod = String(row.codigoPadded ?? '').trim();
    const proc = String(row.proc ?? '').trim();
    if (!cod || !proc) return false;
  }

  const diaRep = parseDiaCampo(filtros.diaRepasse);
  if (diaRep != null) {
    const naLinha = parseDiaCampo(row.diaRepasse);
    if (naLinha !== diaRep) return false;
  }

  const diaPag = parseDiaCampo(filtros.diaPagAluguel);
  if (diaPag != null) {
    const naLinha = parseDiaCampo(row.diaPagAluguel);
    if (naLinha !== diaPag) return false;
  }

  const busca = String(filtros.busca ?? '').trim().toLowerCase();
  if (busca) {
    const haystack = [
      row.id,
      row.codigoPadded,
      row.proc,
      row.endereco,
      row.condominio,
      row.unidade,
      row.inquilino,
      row.proprietario,
      row.titular,
      row.banco,
    ]
      .map((x) => String(x ?? '').toLowerCase())
      .join(' ');
    if (!haystack.includes(busca)) return false;
  }

  return true;
}

/** Colunas úteis na rotina de repasse ao proprietário. */
export const COLUNAS_MODO_REPASSE = [
  'id',
  'codigoPadded',
  'proc',
  'unidade',
  'condominio',
  'ocupado',
  'valorLocacao',
  'diaPagAluguel',
  'diaRepasse',
  'titular',
  'banco',
  'agencia',
  'conta',
  'chavePix',
  'inquilino',
];
