import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterX, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { getLinhasRelatorioCalculosConsolidado } from '../data/relatorioCalculosData.js';

/** Ordem e rótulos exatos solicitados. */
const COLUNAS = [
  { id: 'codigo', label: 'Cód.', minW: '96px' },
  { id: 'reu', label: 'Réu', minW: '180px' },
  { id: 'unidade', label: 'Unidade', minW: '120px' },
  { id: 'dataVencimento', label: 'Data de Vencimento', minW: '110px' },
  { id: 'dataPagamento', label: 'Data de Pagamento', minW: '110px' },
  { id: 'valor', label: 'Valor', minW: '100px' },
  { id: 'valorHonorarios', label: 'Valor Honorários', minW: '110px' },
  { id: 'obs', label: 'Obs', minW: '140px' },
  { id: 'parcela', label: 'Parcela', minW: '72px' },
  { id: 'proc', label: 'Proc.', minW: '56px' },
  { id: 'calculoAceito', label: 'Cálculo Aceito', minW: '110px' },
  { id: 'cliente', label: 'Cliente', minW: '180px' },
  { id: 'dataVencHonorarios', label: 'Data Venc. Honorários', minW: '120px' },
  { id: 'valorDosHonorarios', label: 'Valor dos Honorários', minW: '120px' },
  { id: 'dataPagHonorarios', label: 'Data de Pag. Honorários', minW: '130px' },
  {
    id: 'obsPagamentoHonorarios',
    label: 'Observação de Pagamento de Honorários',
    minW: '200px',
  },
  { id: 'reciboAConfeccionar', label: 'Recibo à Confeccionar', minW: '140px' },
  { id: 'dimensao', label: 'Dimensão', minW: '72px' },
  { id: 'situacao', label: 'Situação', minW: '88px' },
  { id: 'qtdDimensoes', label: 'Quant. Dimensões', minW: '110px' },
  { id: 'codBaixaContaCorrente', label: 'Cod. Baixa Conta Corrente', minW: '160px' },
];

const COLUNAS_ORDENACAO_NUMERICA = new Set([
  'codigo',
  'proc',
  'dimensao',
  'parcela',
  'qtdDimensoes',
]);

/** Dimensão 0 = branco; 1, 2, … = cinzas cada vez mais escuros (HSL neutro, teto de leitura). */
function corFundoLinhaPorDimensao(dimensao) {
  const n = Number.parseInt(String(dimensao ?? '').trim(), 10);
  const d = Number.isFinite(n) && n >= 0 ? n : 0;
  if (d === 0) return '#ffffff';
  const l = Math.max(80, 100 - 2 - (d - 1) * 3.75);
  return `hsl(0, 0%, ${l}%)`;
}

function estadoFiltrosVazio() {
  return Object.fromEntries(COLUNAS.map((c) => [c.id, '']));
}

export function RelatorioCalculos() {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState(() => getLinhasRelatorioCalculosConsolidado());
  const [filtrosPorColuna, setFiltrosPorColuna] = useState(estadoFiltrosVazio);
  const [ordenarPor, setOrdenarPor] = useState(null);
  const [ordemAsc, setOrdemAsc] = useState(true);

  const recarregar = useCallback(() => {
    setLinhas(getLinhasRelatorioCalculosConsolidado());
  }, []);

  useEffect(() => {
    recarregar();
    const h = () => recarregar();
    window.addEventListener('vilareal:calculos-rodadas-atualizadas', h);
    window.addEventListener('vilareal:cliente-config-calculo-atualizado', h);
    window.addEventListener('storage', h);
    return () => {
      window.removeEventListener('vilareal:calculos-rodadas-atualizadas', h);
      window.removeEventListener('vilareal:cliente-config-calculo-atualizado', h);
      window.removeEventListener('storage', h);
    };
  }, [recarregar]);

  const limparFiltros = () => {
    setFiltrosPorColuna(estadoFiltrosVazio());
    setOrdenarPor(null);
    setOrdemAsc(true);
  };

  const dadosFiltrados = useMemo(() => {
    return linhas.filter((row) =>
      COLUNAS.every((col) => {
        const filtro = String(filtrosPorColuna[col.id] ?? '').trim().toLowerCase();
        if (!filtro) return true;
        const valor = String(row[col.id] ?? '').toLowerCase();
        return valor.includes(filtro);
      })
    );
  }, [linhas, filtrosPorColuna]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenarPor) return dadosFiltrados;
    return [...dadosFiltrados].sort((a, b) => {
      if (COLUNAS_ORDENACAO_NUMERICA.has(ordenarPor)) {
        let na;
        let nb;
        if (ordenarPor === 'codigo') {
          na = Number(String(a.codigo ?? a.codCliente ?? '').replace(/\D/g, '')) || 0;
          nb = Number(String(b.codigo ?? b.codCliente ?? '').replace(/\D/g, '')) || 0;
        } else if (ordenarPor === 'parcela') {
          na = Number(a.indiceParcela) || 0;
          nb = Number(b.indiceParcela) || 0;
        } else {
          na = Number(String(a[ordenarPor] ?? '').replace(/\D/g, '')) || 0;
          nb = Number(String(b[ordenarPor] ?? '').replace(/\D/g, '')) || 0;
        }
        const cmp = na === nb ? 0 : na < nb ? -1 : 1;
        return ordemAsc ? cmp : -cmp;
      }
      const va = a[ordenarPor] ?? '';
      const vb = b[ordenarPor] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return ordemAsc ? cmp : -cmp;
    });
  }, [dadosFiltrados, ordenarPor, ordemAsc]);

  const toggleOrdenacao = (id) => {
    if (ordenarPor === id) setOrdemAsc((v) => !v);
    else {
      setOrdenarPor(id);
      setOrdemAsc(true);
    }
  };

  return (
    <div className="min-h-full bg-slate-200 flex flex-col">
      <div className="flex-1 min-h-0 p-3 flex flex-col">
        <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Relatório Cálculos</h1>
            <p className="text-sm text-slate-600 mt-0.5 max-w-3xl">
              Uma linha por parcela do parcelamento (Cálculos), com réu, cliente, datas, valores, honorários e vínculo com
              Conta Corrente quando houver baixa com mesma data e valor. Duplo clique abre a rodada em Cálculos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={recarregar}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-400 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-400 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm"
              title="Zera filtros e ordenação"
            >
              <FilterX className="w-4 h-4 shrink-0" aria-hidden />
              Limpar filtros
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 bg-white rounded border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-teal-700 text-white">
                  {COLUNAS.map((col) => (
                    <th
                      key={col.id}
                      className="px-2 py-2 text-left font-semibold border-b border-teal-800 border-r border-teal-600/50 last:border-r-0"
                      style={{ minWidth: col.minW }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleOrdenacao(col.id)}
                        className="inline-flex items-center gap-1 w-full text-left hover:bg-teal-600/40 rounded px-1 -mx-1 py-0.5"
                      >
                        <span>{col.label}</span>
                        {ordenarPor === col.id ? (
                          ordemAsc ? (
                            <ArrowDownAZ className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
                          ) : (
                            <ArrowUpAZ className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
                          )
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-100">
                  {COLUNAS.map((col) => (
                    <th key={`${col.id}-f`} className="px-1.5 py-1 border-b border-r border-slate-300 last:border-r-0">
                      <input
                        type="text"
                        value={filtrosPorColuna[col.id] ?? ''}
                        onChange={(e) =>
                          setFiltrosPorColuna((prev) => ({ ...prev, [col.id]: e.target.value }))
                        }
                        placeholder="Filtrar..."
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dadosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={COLUNAS.length} className="px-3 py-8 text-center text-slate-500">
                      {linhas.length === 0
                        ? 'Nenhuma parcela encontrada (sem quantidade de parcelas ou linhas preenchidas nas rodadas de Cálculos).'
                        : 'Nenhuma linha corresponde aos filtros.'}
                    </td>
                  </tr>
                ) : (
                  dadosOrdenados.map((row) => (
                    <tr
                      key={`${row.rodadaKey}|${row.indiceParcela}`}
                      className="border-b border-slate-200 cursor-pointer transition-[filter] duration-150 hover:brightness-[0.97]"
                      style={{ backgroundColor: corFundoLinhaPorDimensao(row.dimensao) }}
                      title="Duplo clique: abrir em Cálculos"
                      onDoubleClick={() =>
                        navigate('/calculos', {
                          replace: false,
                          state: {
                            codCliente: row.navigateCodCliente ?? row.codCliente,
                            proc: row.navigateProc ?? row.proc,
                            dimensao: row.navigateDimensao ?? row.dimensao,
                          },
                        })
                      }
                    >
                      {COLUNAS.map((col) => (
                        <td
                          key={col.id}
                          className="px-2 py-1.5 border-r border-slate-200 last:border-r-0 text-slate-800"
                          style={{ minWidth: col.minW }}
                        >
                          {String(row[col.id] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
