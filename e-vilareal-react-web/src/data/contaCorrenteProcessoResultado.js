import { mesReferenciaLancamentoParaRelatorio } from './imoveisAdministracaoFinanceiro.js';

export const PAPEL_ENTRADA = 'entrada';
export const PAPEL_PAGAMENTO = 'pagamento';
export const PAPEL_DESPESA = 'despesa';
export const PAPEL_OUTRO = 'outro';

export const TAG_CC_ENTRADA = '[CC_PROC:ENTRADA]';
export const TAG_CC_PAGAMENTO = '[CC_PROC:PAGAMENTO]';
export const TAG_CC_DESPESA = '[CC_PROC:DESPESA]';
export const TAG_CC_VINC_PREFIX = 'CC_VINC:';

const TAGS_PAPEL = [TAG_CC_ENTRADA, TAG_CC_PAGAMENTO, TAG_CC_DESPESA];
const RE_TAG_VINC = /\[CC_VINC:(\d+)\]/i;

const STORAGE_VINCULO_NUM = 'vilareal.ccProc.vinculoNum.v1';
const STORAGE_PAPEL = 'vilareal.ccProc.papel.v1';

export function chaveLancamentoContaCorrente(t) {
  const banco = String(t?.nomeBanco ?? '').trim();
  const numero = String(t?.numero ?? '').trim();
  const data = String(t?.data ?? '').trim();
  return `${banco}|${numero}|${data}`;
}

export function chaveProcessoContaCorrente(codigoCliente, proc) {
  const cod = String(codigoCliente ?? '').replace(/\D/g, '').replace(/^0+/, '') || '0';
  const p = String(proc ?? '').trim();
  return `${cod.padStart(8, '0')}|${p}`;
}

function textoClassificacao(t) {
  return `${t?.descricao ?? ''} ${t?.descricaoDetalhada ?? ''} ${t?.categoria ?? ''}`.toUpperCase();
}

function papelPorTag(txt) {
  if (txt.includes('CC_PROC:ENTRADA')) return PAPEL_ENTRADA;
  if (txt.includes('CC_PROC:PAGAMENTO')) return PAPEL_PAGAMENTO;
  if (txt.includes('CC_PROC:DESPESA')) return PAPEL_DESPESA;
  return null;
}

export function extrairNumeroVinculoTexto(texto) {
  const m = String(texto ?? '').match(RE_TAG_VINC);
  return m ? normalizarNumeroVinculo(m[1]) : '';
}

export function normalizarNumeroVinculo(raw) {
  const s = String(raw ?? '').replace(/\D/g, '');
  if (!s) return '';
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) return '';
  return String(n);
}

export function removerTagsCcProc(texto) {
  let s = String(texto ?? '');
  for (const tag of TAGS_PAPEL) {
    s = s.split(tag).join(' ');
  }
  s = s.replace(RE_TAG_VINC, ' ');
  return s.replace(/\s{2,}/g, ' ').trim();
}

export function aplicarTagPapelDescricao(descricaoDetalhada, papel) {
  let base = removerTagsCcProc(descricaoDetalhada);
  const tag =
    papel === PAPEL_ENTRADA
      ? TAG_CC_ENTRADA
      : papel === PAPEL_PAGAMENTO
        ? TAG_CC_PAGAMENTO
        : papel === PAPEL_DESPESA
          ? TAG_CC_DESPESA
          : null;
  if (tag) base = base ? `${base} ${tag}` : tag;
  return base;
}

export function aplicarNumeroVinculoDescricao(descricaoDetalhada, numeroVinculo) {
  let base = removerTagsCcProc(descricaoDetalhada);
  const num = normalizarNumeroVinculo(numeroVinculo);
  if (!num) return base;
  const tag = `[${TAG_CC_VINC_PREFIX}${num}]`;
  return base ? `${base} ${tag}` : tag;
}

export function classificarLancamentoContaCorrenteProcesso(t, papelManual) {
  if (papelManual && papelManual !== PAPEL_OUTRO) {
    return { papel: papelManual, motivo: 'manual' };
  }
  const porTag = papelPorTag(textoClassificacao(t));
  if (porTag) return { papel: porTag, motivo: 'tag' };

  const txt = textoClassificacao(t);
  const v = Number(t?.valor) || 0;

  if (v > 0 && /\b(DEPOSITO|DEPÓSITO|JUDICIAL|CREDITO|CRÉDITO|RECEB|HONOR)\b/.test(txt)) {
    return { papel: PAPEL_ENTRADA, motivo: 'heuristica' };
  }
  const parecePagamento =
    v < 0 &&
    (/\b(PIX\s*TRANSF|REPASSE|REPAS\.|PAGAMENTO|PAGTO|PAGO)\b/.test(txt) ||
      /\bTRANSF(?:ER[ÊE]NCIA)?\b/.test(txt));
  if (parecePagamento) {
    return { papel: PAPEL_PAGAMENTO, motivo: 'heuristica' };
  }
  if (v < 0 && /\b(DESP|TAXA|CUSTAS|HONOR|TARIFA)\b/.test(txt)) {
    return { papel: PAPEL_DESPESA, motivo: 'heuristica' };
  }
  if (String(t?.ref ?? '').toUpperCase() === 'R' && v < 0) {
    return { papel: PAPEL_PAGAMENTO, motivo: 'ref_repasse' };
  }
  if (v > 0) return { papel: PAPEL_ENTRADA, motivo: 'padrao_credito' };
  if (v < 0) return { papel: PAPEL_PAGAMENTO, motivo: 'padrao_debito' };
  return { papel: PAPEL_OUTRO, motivo: 'generico' };
}

export function rotuloPapelContaCorrenteProcesso(papel) {
  switch (papel) {
    case PAPEL_ENTRADA:
      return 'Entrada / recebimento';
    case PAPEL_PAGAMENTO:
      return 'Pagamento / repasse';
    case PAPEL_DESPESA:
      return 'Despesa';
    default:
      return 'Outro';
  }
}

function carregarMapa(storageKey, chaveProc) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const all = JSON.parse(raw);
    return all && typeof all === 'object' ? all[chaveProc] || {} : {};
  } catch {
    return {};
  }
}

function gravarMapa(storageKey, chaveProc, mapa) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(storageKey);
    const all = raw ? JSON.parse(raw) : {};
    const next = { ...(all && typeof all === 'object' ? all : {}), [chaveProc]: mapa };
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function lerPapeisManuaisProcesso(codigoCliente, proc) {
  return carregarMapa(STORAGE_PAPEL, chaveProcessoContaCorrente(codigoCliente, proc));
}

export function gravarPapelManualProcesso(codigoCliente, proc, chaveLanc, papel) {
  const chaveProc = chaveProcessoContaCorrente(codigoCliente, proc);
  const mapa = { ...lerPapeisManuaisProcesso(codigoCliente, proc) };
  if (!papel || papel === PAPEL_OUTRO) {
    delete mapa[chaveLanc];
  } else {
    mapa[chaveLanc] = papel;
  }
  gravarMapa(STORAGE_PAPEL, chaveProc, mapa);
  return mapa;
}

export function lerNumerosVinculoProcesso(codigoCliente, proc) {
  return carregarMapa(STORAGE_VINCULO_NUM, chaveProcessoContaCorrente(codigoCliente, proc));
}

export function gravarNumeroVinculoProcesso(codigoCliente, proc, chaveLanc, numeroVinculo) {
  const chaveProc = chaveProcessoContaCorrente(codigoCliente, proc);
  const mapa = { ...lerNumerosVinculoProcesso(codigoCliente, proc) };
  const num = normalizarNumeroVinculo(numeroVinculo);
  if (!num) {
    delete mapa[chaveLanc];
  } else {
    mapa[chaveLanc] = num;
  }
  gravarMapa(STORAGE_VINCULO_NUM, chaveProc, mapa);
  return mapa;
}

export function lerNumeroVinculoLancamento(t, codigoCliente, proc) {
  const chave = chaveLancamentoContaCorrente(t);
  const manual = lerNumerosVinculoProcesso(codigoCliente, proc)[chave];
  if (manual) return manual;
  const fromTag = extrairNumeroVinculoTexto(`${t?.descricaoDetalhada ?? ''} ${t?.categoria ?? ''}`);
  if (fromTag) return fromTag;
  return normalizarNumeroVinculo(t?.eq);
}

export function proximoNumeroVinculoProcesso(codigoCliente, proc, transacoesRaw) {
  const usados = new Set();
  const mapa = lerNumerosVinculoProcesso(codigoCliente, proc);
  for (const n of Object.values(mapa)) {
    const norm = normalizarNumeroVinculo(n);
    if (norm) usados.add(Number(norm));
  }
  for (const t of transacoesRaw || []) {
    const n = lerNumeroVinculoLancamento(t, codigoCliente, proc);
    if (n) usados.add(Number(n));
  }
  let max = 0;
  for (const n of usados) if (n > max) max = n;
  return String(max + 1);
}

export function atribuirNumeroVinculoLancamentos(codigoCliente, proc, chavesLancamento, numeroVinculo) {
  const num = normalizarNumeroVinculo(numeroVinculo);
  if (!num) return '';
  const chaves = [...new Set((chavesLancamento || []).map((c) => String(c).trim()).filter(Boolean))];
  for (const ch of chaves) {
    gravarNumeroVinculoProcesso(codigoCliente, proc, ch, num);
  }
  return num;
}

/**
 * @param {object[]} transacoesRaw
 * @param {string|number} codigoCliente
 * @param {string|number} proc
 */
export function montarPainelResultadoContaCorrenteProcesso(transacoesRaw, codigoCliente, proc) {
  const papeisManuais = lerPapeisManuaisProcesso(codigoCliente, proc);

  const transacoes = (transacoesRaw || []).map((t) => {
    const chave = chaveLancamentoContaCorrente(t);
    const classificacao = classificarLancamentoContaCorrenteProcesso(t, papeisManuais[chave]);
    const numeroVinculo = lerNumeroVinculoLancamento(t, codigoCliente, proc);
    return {
      ...t,
      chave,
      classificacao,
      numeroVinculo,
      eq: numeroVinculo || t.eq || '',
    };
  });

  let totalEntrada = 0;
  let totalPagamento = 0;
  let totalDespesa = 0;
  let lucroProcesso = 0;

  for (const t of transacoes) {
    const { papel } = t.classificacao;
    const v = Number(t.valor) || 0;
    if (papel === PAPEL_OUTRO) continue;
    lucroProcesso += v;
    if (papel === PAPEL_ENTRADA && v > 0) totalEntrada += v;
    if (papel === PAPEL_PAGAMENTO && v < 0) totalPagamento += Math.abs(v);
    if (papel === PAPEL_DESPESA && v < 0) totalDespesa += Math.abs(v);
  }

  const numerosVinculoUsados = [
    ...new Set(transacoes.map((t) => t.numeroVinculo).filter(Boolean)),
  ].sort((a, b) => Number(a) - Number(b));

  const proximoNumeroVinculo = proximoNumeroVinculoProcesso(codigoCliente, proc, transacoes);
  const resumosVinculo = resumirVinculosPorNumero(transacoes);
  const paresSugeridos = sugerirParesParaVinculo(transacoes);

  return {
    transacoes,
    numerosVinculoUsados,
    proximoNumeroVinculo,
    resumosVinculo,
    paresSugeridos,
    totalEntrada,
    totalPagamento,
    totalDespesa,
    lucroProcesso,
    qtdSemVinculo: transacoes.filter((t) => !t.numeroVinculo).length,
    qtdClassificados: transacoes.filter((t) => t.classificacao.papel !== PAPEL_OUTRO).length,
  };
}

/** Agrupa lançamentos já vinculados pelo número (para painel lateral / chips). */
export function resumirVinculosPorNumero(transacoes) {
  const map = new Map();
  for (const t of transacoes || []) {
    const n = normalizarNumeroVinculo(t.numeroVinculo);
    if (!n) continue;
    if (!map.has(n)) {
      map.set(n, { numero: n, linhas: [], soma: 0, qtd: 0 });
    }
    const g = map.get(n);
    g.linhas.push(t);
    g.soma += Number(t.valor) || 0;
    g.qtd += 1;
  }
  return [...map.values()].sort((a, b) => Number(a.numero) - Number(b.numero));
}

/**
 * Sugere pares entrada × pagamento ainda sem vínculo (heurística por valor complementar).
 * @returns {Array<{ id: string, entrada: object, pagamento: object, somaPar: number }>}
 */
export function sugerirParesParaVinculo(transacoes) {
  const sem = (transacoes || []).filter((t) => !t.numeroVinculo);
  const entradas = sem.filter(
    (t) => t.classificacao?.papel === PAPEL_ENTRADA || (Number(t.valor) > 0 && t.classificacao?.papel !== PAPEL_PAGAMENTO),
  );
  const pagamentos = sem.filter(
    (t) => t.classificacao?.papel === PAPEL_PAGAMENTO || Number(t.valor) < 0,
  );
  const usadosPag = new Set();
  const out = [];

  for (const ent of entradas) {
    const vEnt = Number(ent.valor) || 0;
    if (vEnt <= 0) continue;
    let melhor = null;
    let melhorDiff = Infinity;
    for (const pag of pagamentos) {
      if (usadosPag.has(pag.chave)) continue;
      const vPag = Number(pag.valor) || 0;
      if (vPag >= 0) continue;
      const soma = vEnt + vPag;
      const diff = Math.abs(soma);
      if (diff < melhorDiff) {
        melhorDiff = diff;
        melhor = pag;
      }
    }
    if (melhor && melhorDiff < Math.max(800, vEnt * 0.35)) {
      usadosPag.add(melhor.chave);
      out.push({
        id: `${ent.chave}|${melhor.chave}`,
        entrada: ent,
        pagamento: melhor,
        somaPar: (Number(ent.valor) || 0) + (Number(melhor.valor) || 0),
      });
    }
  }
  return out.slice(0, 12);
}

export function linhaRelatorioResultadoProcesso({ codCliente, proc, cliente, processoApiId, transacoes }) {
  const painel = montarPainelResultadoContaCorrenteProcesso(transacoes, codCliente, proc);
  const mesAtual = new Date();
  const chaveMes = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`;
  const noMes = painel.transacoes.filter(
    (t) => mesReferenciaLancamentoParaRelatorio(t)?.chave === chaveMes,
  );
  const painelMes = montarPainelResultadoContaCorrenteProcesso(noMes, codCliente, proc);

  return {
    codCliente,
    proc: String(proc),
    cliente: String(cliente ?? '').trim() || '—',
    processoApiId: processoApiId ?? null,
    qtdLancamentos: painel.transacoes.length,
    qtdClassificados: painel.qtdClassificados,
    qtdVinculos: painel.numerosVinculoUsados.length,
    totalEntrada: painel.totalEntrada,
    totalPagamento: painel.totalPagamento,
    totalDespesa: painel.totalDespesa,
    lucroProcesso: painel.lucroProcesso,
    lucroMesAtual: painelMes.lucroProcesso,
    mesReferenciaLabel: `${String(mesAtual.getMonth() + 1).padStart(2, '0')}/${mesAtual.getFullYear()}`,
  };
}
