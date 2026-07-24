import { useEffect, useMemo, useState } from 'react';
import { listarComparadorApi } from '../../repositories/patrimonioRepository.js';
import { fmtBRL, fmtPct } from './patrimonioFormat.js';

export function PatrimonioComparador() {
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState('');
  const [ord, setOrd] = useState('taxa');

  useEffect(() => {
    listarComparadorApi()
      .then(setItens)
      .catch((e) => setErro(e?.message || 'Erro'));
  }, []);

  const ordenados = useMemo(() => {
    const copy = [...itens];
    if (ord === 'taxa') {
      copy.sort((a, b) => Number(b.taxaLiquidaAa ?? -999) - Number(a.taxaLiquidaAa ?? -999));
    } else {
      copy.sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0));
    }
    return copy;
  }, [itens, ord]);

  return (
    <div className="space-y-4 max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Comparador universal</h1>
          <p className="text-sm text-slate-500">
            Ativos e dívidas na mesma métrica: % ao ano líquido. Ativo a 9% e dívida a 13% na mesma lista.
          </p>
        </div>
        <select
          className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
          value={ord}
          onChange={(e) => setOrd(e.target.value)}
        >
          <option value="taxa">Ordenar por taxa</option>
          <option value="valor">Ordenar por valor</option>
        </select>
      </header>

      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="p-2">Lado</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Nome</th>
              <th className="p-2">Valor</th>
              <th className="p-2">% a.a. líquido</th>
              <th className="p-2">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((i) => (
              <tr
                key={`${i.lado}-${i.tipo}-${i.id}`}
                className={`border-b border-slate-100 dark:border-slate-800 ${
                  i.lado === 'PASSIVO' ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                }`}
              >
                <td className="p-2 font-medium">{i.lado}</td>
                <td className="p-2">{i.tipo}</td>
                <td className="p-2">{i.nome}</td>
                <td className="p-2 tabular-nums">{fmtBRL(i.valor)}</td>
                <td className="p-2 tabular-nums font-semibold">
                  {i.taxaLiquidaAa == null ? '—' : fmtPct(i.taxaLiquidaAa)}
                </td>
                <td className="p-2 text-slate-500">{i.observacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ordenados.length === 0 && !erro ? (
          <p className="p-4 text-sm text-slate-500">Cadastre ativos e passivos para popular o comparador.</p>
        ) : null}
      </div>
    </div>
  );
}
