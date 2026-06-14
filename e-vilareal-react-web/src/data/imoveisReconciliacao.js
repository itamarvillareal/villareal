/**
 * Reconciliação do financeiro de imóveis (Fase B) — camada pura de apresentação.
 * A VERDADE dos números vem do backend (/api/locacoes/{contratoId}/resultado e .../sugestoes);
 * aqui só há formatação, rótulos e montagem de payloads. Nenhuma heurística de valor.
 */

export const PAPEIS_RECONCILIACAO = ['ALUGUEL', 'REPASSE', 'DESPESA'];

export function rotuloPapelReconciliacao(papel) {
  switch (String(papel ?? '').toUpperCase()) {
    case 'ALUGUEL':
      return 'Aluguel';
    case 'REPASSE':
      return 'Repasse';
    case 'DESPESA':
      return 'Despesa';
    default:
      return '—';
  }
}

/** Estilo do selo de confiança da sugestão (ALTA/MEDIA/BAIXA). */
export function confiancaInfo(confianca) {
  switch (String(confianca ?? '').toUpperCase()) {
    case 'ALTA':
      return { label: 'Alta', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    case 'MEDIA':
      return { label: 'Média', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
    case 'BAIXA':
      return { label: 'Baixa', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    default:
      return { label: '—', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  }
}

export const STATUS_REPASSE = { FEITO: 'FEITO', PENDENTE: 'PENDENTE', DIVERGENTE: 'DIVERGENTE' };

/** Selo bem visível do status do repasse. FEITO=verde, PENDENTE=cinza, DIVERGENTE=âmbar. */
export function statusRepasseInfo(status) {
  switch (String(status ?? '').toUpperCase()) {
    case 'FEITO':
      return {
        label: 'Repasse feito',
        tone: 'verde',
        cls: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      };
    case 'DIVERGENTE':
      return {
        label: 'Repasse divergente',
        tone: 'ambar',
        cls: 'bg-amber-100 text-amber-900 border-amber-300',
      };
    case 'PENDENTE':
    default:
      return {
        label: 'Repasse pendente',
        tone: 'cinza',
        cls: 'bg-slate-100 text-slate-700 border-slate-300',
      };
  }
}

/** Repasse esperado (recebido − taxa nominal − despesas) para o detalhe de divergência. */
export function repasseEsperado(resultado) {
  if (!resultado) return null;
  const recebido = Number(resultado.aluguelRecebido) || 0;
  const despesas = Number(resultado.despesas) || 0;
  const taxa = Number(resultado.taxaEsperadaPercent) || 0;
  const taxaValor = recebido * (taxa / 100);
  return Math.round((recebido - taxaValor - despesas) * 100) / 100;
}

/** Normaliza as sugestões da API para a tabela de reconciliação. */
export function linhasReconciliacaoFromSugestoes(sugestoes) {
  return (sugestoes || []).map((s) => ({
    lancamentoFinanceiroId: s.lancamentoFinanceiroId,
    data: s.data || null,
    descricao: s.descricao || '',
    valor: Number(s.valor) || 0,
    natureza: s.natureza || null,
    papelSugerido: s.papelSugerido || null,
    confianca: s.confianca || null,
    competenciaSugerida: s.competenciaSugerida || null,
    jaVinculado: !!s.jaVinculado,
    papelVinculado: s.papelVinculado || null,
    vinculoId: s.vinculoId ?? null,
    origem: String(s.origem || 'PROCESSO').toUpperCase(),
    classificaAoConfirmar: !!s.classificaAoConfirmar,
    codigoClienteAlvo: s.codigoClienteAlvo || null,
    processoIdAlvo: s.processoIdAlvo ?? null,
  }));
}

/** true quando a linha é um lançamento órfão que será adotado (classificado) ao confirmar. */
export function ehLinhaAdocao(linha) {
  return !!linha && (linha.origem === 'ORFAO' || linha.classificaAoConfirmar);
}

/**
 * Separa as linhas em dois grupos para o painel:
 * - doImovel: lançamentos já no processo do imóvel;
 * - aAdotar: órfãos (sem processo) que serão classificados ao confirmar.
 */
export function agruparLinhasReconciliacao(linhas) {
  const doImovel = [];
  const aAdotar = [];
  for (const l of linhas || []) {
    if (ehLinhaAdocao(l)) aAdotar.push(l);
    else doImovel.push(l);
  }
  return { doImovel, aAdotar };
}

/** Texto do que será setado ao adotar: "A · {cliente} · proc {n} como {papel}". */
export function descricaoAdocao(linha, papel) {
  if (!linha) return '';
  const cliente = linha.codigoClienteAlvo ? `cliente ${linha.codigoClienteAlvo}` : 'cliente do imóvel';
  const proc = linha.processoIdAlvo != null ? `proc ${linha.processoIdAlvo}` : 'processo do imóvel';
  const papelTxt = rotuloPapelReconciliacao(papel || linha.papelSugerido);
  return `ao confirmar, classifica em A · ${cliente} · ${proc} como ${papelTxt}`;
}

/**
 * Monta o payload de /vincular a partir das linhas escolhidas.
 * Cada item: { lancamentoFinanceiroId, papel, competenciaMes }. Itens sem papel são descartados.
 */
export function montarPayloadVinculos(itens) {
  return (itens || [])
    .filter((s) => s.lancamentoFinanceiroId != null && s.papel)
    .map((s) => ({
      lancamentoFinanceiroId: Number(s.lancamentoFinanceiroId),
      papel: String(s.papel).toUpperCase(),
      competenciaMes: s.competenciaMes || null,
    }));
}

/** Competência atual no formato AAAA-MM. */
export function competenciaAtual(hoje = new Date()) {
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Valida AAAA-MM. */
export function competenciaValida(valor) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(valor ?? '').trim());
}
