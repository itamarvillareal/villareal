import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  ANO_MINIMO_PADRAO,
  anoAtual,
  isPeriodoAnoInteiro,
  mesAtualIso,
  modoPeriodo,
} from './periodoFinanceiro.js';

const MES_MINIMO_PADRAO = `${ANO_MINIMO_PADRAO}-01`;

/**
 * Seletor de período: mês (YYYY-MM) ou ano completo (YYYY).
 * O valor emitido em modo ano é só o ano (ex.: "2025"); em modo mês, YYYY-MM.
 */
export function PeriodoSelector({ value, onChange, minMes = MES_MINIMO_PADRAO, maxMes }) {
  const max = maxMes ?? mesAtualIso();
  const maxAno = Number(max.slice(0, 4)) || Number(anoAtual());
  const valor = value ?? mesAtualIso();
  const [modo, setModo] = useState(() => modoPeriodo(valor));

  useEffect(() => {
    setModo(modoPeriodo(valor));
  }, [valor]);

  const anoValor = isPeriodoAnoInteiro(valor)
    ? valor
    : String(valor).slice(0, 4) || anoAtual();
  const mesValor = isPeriodoAnoInteiro(valor) ? `${anoValor}-01` : valor;

  const trocarModo = (novoModo) => {
    setModo(novoModo);
    if (novoModo === 'ano') {
      onChange(String(mesValor).slice(0, 4));
    } else {
      onChange(isPeriodoAnoInteiro(valor) ? `${anoValor}-01` : mesValor);
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <select
        value={modo}
        onChange={(e) => trocarModo(e.target.value)}
        className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
        aria-label="Tipo de período"
      >
        <option value="mes">Mês</option>
        <option value="ano">Ano</option>
      </select>
      <label className="inline-flex items-center gap-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1">
        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden />
        {modo === 'mes' ? (
          <input
            type="month"
            value={mesValor}
            min={minMes}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent border-0 text-sm focus:outline-none cursor-pointer"
            aria-label="Período mês/ano"
          />
        ) : (
          <input
            type="number"
            value={anoValor}
            min={ANO_MINIMO_PADRAO}
            max={maxAno}
            step={1}
            onChange={(e) => {
              const y = e.target.value;
              if (y && Number(y) >= ANO_MINIMO_PADRAO) onChange(String(y));
            }}
            className="bg-transparent border-0 text-sm w-[4.5rem] focus:outline-none"
            aria-label="Ano"
          />
        )}
      </label>
    </div>
  );
}
