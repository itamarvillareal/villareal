/** Converte DD/MM/AAAA ou ISO em YYYY-MM-DD para comparação. */
export function dataLancamentoParaIso(dataBrOuIso) {
  const s = String(dataBrOuIso ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/**
 * Saldo acumulado ao fim do dia e movimento no dia (extrato local / UI).
 * @param {object[]} lancamentos
 * @param {string} dataIso YYYY-MM-DD
 */
export function calcularSaldoBancoNaData(lancamentos, dataIso) {
  if (!dataIso || !Array.isArray(lancamentos)) {
    return {
      saldo: 0,
      lancamentosAteData: 0,
      movimentoNoDia: 0,
      lancamentosNoDia: 0,
    };
  }
  let saldo = 0;
  let lancamentosAteData = 0;
  let movimentoNoDia = 0;
  let lancamentosNoDia = 0;
  for (const t of lancamentos) {
    const iso = dataLancamentoParaIso(t?.data);
    if (!iso || iso > dataIso) continue;
    const v = Number(t?.valor) || 0;
    saldo += v;
    lancamentosAteData += 1;
    if (iso === dataIso) {
      movimentoNoDia += v;
      lancamentosNoDia += 1;
    }
  }
  return { saldo, lancamentosAteData, movimentoNoDia, lancamentosNoDia };
}

function ultimoDiaDoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

function isoDia(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Saldo ao fim de cada dia do mês (todos os dias do calendário).
 * @param {object[]} lancamentos
 * @param {number} ano
 * @param {number} mes 1–12
 */
export function calcularSaldoBancoPorMes(lancamentos, ano, mes) {
  const y = Number(ano);
  const m = Number(mes);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { saldoInicial: 0, dias: [] };
  }

  const inicioMes = isoDia(y, m, 1);
  const ultimo = ultimoDiaDoMes(y, m);
  const fimMes = isoDia(y, m, ultimo);

  const movPorDia = new Map();
  const countPorDia = new Map();

  for (const t of lancamentos || []) {
    const iso = dataLancamentoParaIso(t?.data);
    if (!iso) continue;
    const v = Number(t?.valor) || 0;
    if (iso < inicioMes) continue;
    if (iso > fimMes) continue;
    movPorDia.set(iso, (movPorDia.get(iso) || 0) + v);
    countPorDia.set(iso, (countPorDia.get(iso) || 0) + 1);
  }

  const diaAnteriorIso = (() => {
    const d = new Date(y, m - 1, 0);
    return isoDia(d.getFullYear(), d.getMonth() + 1, d.getDate());
  })();
  const saldoInicial = calcularSaldoBancoNaData(lancamentos, diaAnteriorIso).saldo;

  let acumulado = saldoInicial;
  const dias = [];
  for (let d = 1; d <= ultimo; d += 1) {
    const data = isoDia(y, m, d);
    const movimento = movPorDia.get(data) || 0;
    acumulado += movimento;
    dias.push({
      data,
      movimento,
      saldo: acumulado,
      lancamentosNoDia: countPorDia.get(data) || 0,
    });
  }

  return { saldoInicial, dias };
}

/** Mês atual YYYY-MM para input type="month". */
export function mesAtualIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMesIso(mesIso) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mesIso ?? '').trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  return { ano, mes };
}

export function formatarDataBrDeIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return iso ?? '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function labelMesAnoPt(mesIso) {
  const p = parseMesIso(mesIso);
  if (!p) return mesIso ?? '';
  const nomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${nomes[p.mes - 1]} de ${p.ano}`;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function diaSemanaAbrev(isoData) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoData ?? '').trim());
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return DIAS_SEMANA[d.getDay()] ?? '';
}
