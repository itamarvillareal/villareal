import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { X } from 'lucide-react';
import {
  obterIndicesMensais,
  obterIndicesMensaisINPC,
  obterIndicesMensaisIPCA,
  nomeCanonicoIndice,
} from '../../services/monetaryIndicesService.js';
import {
  calcularIntervaloIndicesRodada,
  formatCompetenciaLabel,
  montarLinhasIndicesConferencia,
  INDICES_SERIE_OUTROS,
} from '../../utils/calculosIndicesConferencia.js';

/**
 * Janela flutuante: índices mês a mês usados na atualização monetária (duplo clique no índice).
 */
export function IndicesAtualizacaoConferenciaModal({
  open,
  onClose,
  indice,
  titulos = [],
  dataCalculo,
  aceitarPagamento,
  hojeBR,
  indicesMensaisINPC,
  indicesMensaisIPCA,
  indicesMensaisOutros,
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mapInpc, setMapInpc] = useState(null);
  const [mapIpca, setMapIpca] = useState(null);
  const [mapOutros, setMapOutros] = useState(null);

  const intervalo = useMemo(
    () =>
      calcularIntervaloIndicesRodada({
        titulos,
        dataCalculo,
        aceitarPagamento,
        hoje: hojeBR?.(),
      }),
    [titulos, dataCalculo, aceitarPagamento, hojeBR],
  );

  const carregarSeries = useCallback(async () => {
    const idx = String(indice ?? '').toUpperCase();
    setErro('');
    setCarregando(true);
    try {
      let inpc = indicesMensaisINPC;
      let ipca = indicesMensaisIPCA;

      const precisaInpc =
        idx === 'INPC' ||
        titulos.some((t) => String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase() === 'INPC');
      const precisaIpca =
        idx === 'IPCA' ||
        titulos.some((t) => String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase() === 'IPCA');

      if (precisaInpc && (!inpc || typeof inpc !== 'object')) {
        inpc = await obterIndicesMensaisINPC(intervalo.inicio, intervalo.fim);
      }
      if (precisaIpca && (!ipca || typeof ipca !== 'object')) {
        ipca = await obterIndicesMensaisIPCA(intervalo.inicio, intervalo.fimIpca);
      }

      // IGPM / SELIC / CDI / TR / POUPANÇA: série mensal real via backend.
      let outros = indicesMensaisOutros;
      const idxCanonico = nomeCanonicoIndice(idx);
      if (INDICES_SERIE_OUTROS.includes(idxCanonico) && !(outros && typeof outros === 'object' && outros[idxCanonico])) {
        const serie = await obterIndicesMensais(idxCanonico, intervalo.inicio, intervalo.fim);
        outros = { ...(outros || {}), [idxCanonico]: serie };
      }

      setMapInpc(inpc ?? {});
      setMapIpca(ipca ?? {});
      setMapOutros(outros ?? {});
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar índices.');
      setMapInpc({});
      setMapIpca({});
      setMapOutros({});
    } finally {
      setCarregando(false);
    }
  }, [indice, titulos, intervalo, indicesMensaisINPC, indicesMensaisIPCA, indicesMensaisOutros]);

  useCloseOnEscape(open, onClose);

  useEffect(() => {
    if (!open) return undefined;
    setMapInpc(indicesMensaisINPC);
    setMapIpca(indicesMensaisIPCA);
    setMapOutros(indicesMensaisOutros ?? null);
    carregarSeries();
  }, [open, carregarSeries, indicesMensaisINPC, indicesMensaisIPCA, indicesMensaisOutros]);

  const tabela = useMemo(() => {
    if (!open) return null;
    const inpc = mapInpc ?? indicesMensaisINPC ?? {};
    const ipca = mapIpca ?? indicesMensaisIPCA ?? {};
    const outros = mapOutros ?? indicesMensaisOutros ?? {};
    return montarLinhasIndicesConferencia(indice, inpc, ipca, intervalo, outros);
  }, [open, indice, mapInpc, mapIpca, mapOutros, indicesMensaisINPC, indicesMensaisIPCA, indicesMensaisOutros, intervalo]);

  if (!open) return null;

  const periodoLabel = `${formatCompetenciaLabel(
    `${intervalo.inicio.getFullYear()}-${String(intervalo.inicio.getMonth() + 1).padStart(2, '0')}`,
  )} → ${formatCompetenciaLabel(
    `${intervalo.fim.getFullYear()}-${String(intervalo.fim.getMonth() + 1).padStart(2, '0')}`,
  )}`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/45"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="indices-conferencia-titulo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <h2 id="indices-conferencia-titulo" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Índices de atualização — {indice}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Período considerado: {periodoLabel}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Duplo clique no índice abre esta conferência.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 shrink-0">
          {carregando ? 'Carregando série mensal…' : null}
          {erro ? <span className="text-red-600">{erro}</span> : null}
          {!carregando && !erro && tabela?.nota ? <span>{tabela.nota}</span> : null}
        </div>

        <div className="flex-1 overflow-auto min-h-0 px-2 pb-3">
          {!carregando && tabela?.linhas?.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 text-center">Nenhuma competência no intervalo.</p>
          ) : null}
          {tabela?.linhas?.length > 0 ? (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                <tr>
                  <th className="text-left px-2 py-2 font-medium text-slate-700 dark:text-slate-200 border-b">
                    Competência
                  </th>
                  {tabela.tipo === 'serie' && tabela.indice === 'INPC' ? (
                    <>
                      <th className="text-right px-2 py-2 font-medium text-slate-700 dark:text-slate-200 border-b">
                        BCB (%)
                      </th>
                      <th className="text-right px-2 py-2 font-medium text-slate-700 dark:text-slate-200 border-b">
                        Usado no cálculo (%)
                      </th>
                    </>
                  ) : (
                    <th className="text-right px-2 py-2 font-medium text-slate-700 dark:text-slate-200 border-b">
                      Variação (%)
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {tabela.linhas.map((linha) => (
                  <tr
                    key={linha.competencia}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-2 py-1.5 tabular-nums text-slate-800 dark:text-slate-100">
                      {linha.competenciaLabel}
                    </td>
                    {tabela.tipo === 'serie' && tabela.indice === 'INPC' ? (
                      <>
                        <td className="px-2 py-1.5 text-right tabular-nums">{linha.bcbLabel}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">{linha.usadoLabel}</td>
                      </>
                    ) : (
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{linha.valorLabel}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
