import { Calendar } from 'lucide-react';

const MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function labelMesAno(yyyyMm) {
  if (!yyyyMm) return 'Período';
  const [y, m] = String(yyyyMm).split('-');
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return yyyyMm;
  return `${MESES[mi]}/${y.slice(-2)}`;
}

export function PeriodoSelector({ value, onChange }) {
  const now = new Date();
  const atual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <label className="inline-flex items-center gap-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1">
      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden />
      <select
        value={value ?? atual}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 text-sm focus:outline-none cursor-pointer"
        aria-label="Período mês/ano"
      >
        {buildOpcoes(24).map((opt) => (
          <option key={opt} value={opt}>
            {labelMesAno(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildOpcoes(qtdMeses) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < qtdMeses; i += 1) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
