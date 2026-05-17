import { mapApiLancamentoToExtratoRow } from '../extrato/extratoMappers.js';

export function mapLancamentoInbox(l) {
  return mapApiLancamentoToExtratoRow(l);
}

export function textoOrigemSugestao(sug) {
  if (!sug) return '';
  const origem = String(sug.origem ?? '').toUpperCase();
  if (origem === 'REGRA' && sug.descricaoRegra) {
    return `regra: ${sug.descricaoRegra}`;
  }
  if (origem === 'HISTORICO' && sug.ocorrencias != null) {
    return `histórico: ${sug.ocorrencias} ocorrências`;
  }
  if (origem === 'RECORRENCIA') {
    return 'recorrência mensal';
  }
  return origem.toLowerCase();
}

export function parKey(par) {
  const a = par?.lancamentoA?.id ?? par?.lancamentoIdA;
  const b = par?.lancamentoB?.id ?? par?.lancamentoIdB;
  return `${a}-${b}`;
}

export function valorAssinadoLancamento(l) {
  if (!l) return 0;
  const v = Math.abs(Number(l.valor ?? 0));
  return String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -v : v;
}

export function somaParCompensacao(par) {
  const a = valorAssinadoLancamento(par.lancamentoA);
  const b = valorAssinadoLancamento(par.lancamentoB);
  return Math.round((a + b) * 100) / 100;
}

export function labelTipoPar(tipo) {
  const t = String(tipo ?? '').toUpperCase();
  if (t === 'INTERBANCARIO') return 'Interbancário';
  if (t === 'MESMO_BANCO') return 'Mesmo banco';
  return tipo || '—';
}

export function acaoInconsistencia(sugestao, soma) {
  const s = String(sugestao ?? '').toUpperCase();
  const v = Number(soma);
  switch (s) {
    case 'DIFERENCA_TAXA':
      return { label: `Criar ajuste R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, informativo: true };
    case 'DUPLICADO':
      return { label: 'Revisar duplicatas', informativo: true };
    case 'INCOMPLETO':
      return { label: 'Buscar par', link: '/financeiro/inbox/compensar', informativo: true };
    default:
      return { label: 'Revisar manualmente', informativo: true };
  }
}
