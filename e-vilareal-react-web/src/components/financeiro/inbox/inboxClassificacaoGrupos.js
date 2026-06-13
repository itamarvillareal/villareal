const ORDEM_CONFIANCA = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

export const LETRA_SUGESTAO_TODAS = 'TODAS';
export const LETRA_SUGESTAO_SEM = 'SEM';

/** Conta N = ainda sem classificação conhecida — não deve ser sugerida para aprovação. */
export function contaContabilDesconhecida(codigo) {
  return String(codigo ?? '').trim().toUpperCase() === 'N';
}

export function filtrarSugestoesClassificacao(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter((s) => s?.contaContabilId && !contaContabilDesconhecida(s.contaCodigo));
}

export function melhorSugestao(lista) {
  const util = filtrarSugestoesClassificacao(lista);
  if (!util.length) return null;
  return [...util].sort(
    (a, b) =>
      (ORDEM_CONFIANCA[String(a.confianca).toUpperCase()] ?? 9) -
      (ORDEM_CONFIANCA[String(b.confianca).toUpperCase()] ?? 9),
  )[0];
}

export function chaveGrupoClassificacao(lanc, sugestao) {
  const desc = String(lanc.descricao ?? '').trim().toUpperCase();
  const nb = lanc.numeroBanco ?? '';
  const conta = sugestao?.contaContabilId ?? '';
  return `${desc}|${nb}|${conta}`;
}

function sortPorDataDesc(a, b) {
  return String(b.dataLancamento ?? '').localeCompare(String(a.dataLancamento ?? ''));
}

/**
 * Agrupa lançamentos com mesma descrição, banco e sugestão de conta.
 * @returns {{ grupos: object[], individuais: object[], semSugestao: object[] }}
 */
export function agruparLancamentosClassificacao(lancamentos, sugestoesMap) {
  const gruposMap = {};
  const semSugestao = [];
  const individuais = [];

  for (const lanc of lancamentos) {
    const sugestao = melhorSugestao(sugestoesMap[lanc.id]);
    if (!sugestao?.contaContabilId || contaContabilDesconhecida(sugestao.contaCodigo)) {
      semSugestao.push(lanc);
      continue;
    }
    const chave = chaveGrupoClassificacao(lanc, sugestao);
    if (!gruposMap[chave]) {
      gruposMap[chave] = {
        chave,
        descricao: lanc.descricao,
        banco: lanc.bancoNome,
        numeroBanco: lanc.numeroBanco,
        sugestao,
        lancamentos: [],
      };
    }
    gruposMap[chave].lancamentos.push(lanc);
  }

  const grupos = [];
  for (const g of Object.values(gruposMap)) {
    g.lancamentos.sort(sortPorDataDesc);
    if (g.lancamentos.length >= 2) {
      grupos.push(g);
    } else {
      individuais.push(...g.lancamentos);
    }
  }

  grupos.sort((a, b) => b.lancamentos.length - a.lancamentos.length);
  individuais.sort(sortPorDataDesc);
  semSugestao.sort(sortPorDataDesc);

  return { grupos, individuais, semSugestao };
}

export function codigoLetraSugestaoLancamento(lanc, sugestoesMap) {
  const sug = melhorSugestao(sugestoesMap[lanc?.id]);
  if (!sug?.contaCodigo || contaContabilDesconhecida(sug.contaCodigo)) {
    return null;
  }
  return String(sug.contaCodigo).trim().toUpperCase();
}

/**
 * Filtra grupos/individuais/semSugestao pela letra da melhor sugestão.
 * @param {string} letraFiltro LETRA_SUGESTAO_TODAS | LETRA_SUGESTAO_SEM | A..Z
 */
export function filtrarClassificacaoPorLetra(agrupada, letraFiltro, sugestoesMap) {
  const filtro = String(letraFiltro ?? LETRA_SUGESTAO_TODAS).trim().toUpperCase();
  if (filtro === LETRA_SUGESTAO_TODAS) {
    return agrupada;
  }
  if (filtro === LETRA_SUGESTAO_SEM) {
    return { grupos: [], individuais: [], semSugestao: agrupada.semSugestao ?? [] };
  }

  const grupos = (agrupada.grupos ?? []).filter(
    (g) => String(g.sugestao?.contaCodigo ?? '').trim().toUpperCase() === filtro,
  );
  const individuais = (agrupada.individuais ?? []).filter(
    (l) => codigoLetraSugestaoLancamento(l, sugestoesMap) === filtro,
  );
  return { grupos, individuais, semSugestao: [] };
}

export function contagemPorLetraSugestao(lancamentos, sugestoesMap) {
  const porLetra = {};
  let sem = 0;
  for (const l of lancamentos ?? []) {
    const cod = codigoLetraSugestaoLancamento(l, sugestoesMap);
    if (!cod) {
      sem += 1;
      continue;
    }
    porLetra[cod] = (porLetra[cod] ?? 0) + 1;
  }
  return { porLetra, sem };
}

export function coletarIdsClassificacaoVisivel(agrupada) {
  const ids = [];
  for (const g of agrupada.grupos ?? []) {
    for (const l of g.lancamentos ?? []) {
      ids.push(l.id);
    }
  }
  for (const l of agrupada.individuais ?? []) {
    ids.push(l.id);
  }
  for (const l of agrupada.semSugestao ?? []) {
    ids.push(l.id);
  }
  return ids;
}

function formatDataBr(iso) {
  const s = String(iso ?? '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function resumoPeriodoGrupo(lancamentos) {
  const datas = lancamentos.map((l) => l.dataLancamento).filter(Boolean).sort();
  if (!datas.length) return '—';
  const ini = formatDataBr(datas[0]);
  const fim = formatDataBr(datas[datas.length - 1]);
  return ini === fim ? ini : `${ini} a ${fim}`;
}

export function resumoValoresGrupo(lancamentos) {
  const valores = lancamentos.map((l) => Math.abs(Number(l.valor ?? 0)));
  if (!valores.length) return { min: 0, max: 0, total: 0 };
  return {
    min: Math.min(...valores),
    max: Math.max(...valores),
    total: valores.reduce((s, v) => s + v, 0),
  };
}

const fmtMoeda = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoeda(v) {
  return fmtMoeda.format(Number(v) || 0);
}
