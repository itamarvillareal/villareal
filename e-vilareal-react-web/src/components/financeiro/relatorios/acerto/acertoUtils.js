/** Helpers compartilhados da tela "Acerto do Cliente" (Etapas 5/5b da CONTA ZERO). */

export function fmtDataAcerto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

export function fmtDataHoraAcerto(instante) {
  if (!instante) return '';
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Valor assinado do lançamento (cliente usa valorCliente quando preenchido). */
export function valorAssinadoAcerto(l, visaoCliente = false) {
  const bruto =
    visaoCliente && l.valorCliente != null ? Number(l.valorCliente) : Math.abs(Number(l.valor ?? 0));
  return String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -bruto : bruto;
}

export function refExibicaoAcerto(l) {
  const ni = l.numeroInternoProcesso;
  if (ni != null && ni !== '') return String(ni);
  if (l.processoId != null) return String(l.processoId);
  return String(l.grupoCompensacao ?? '').trim() || '0';
}

export function lancamentoPendente(l) {
  return String(l.grupoCompensacao ?? '').trim() === '';
}

/** Legenda do saldo na convenção da conta de acerto: crédito = devido ao escritório. */
export function legendaSaldoAcerto(saldo) {
  if (Math.abs(saldo) < 0.005) return 'acerto zerado';
  return saldo > 0 ? 'a favor do escritório' : 'a favor do cliente';
}
